package com.fearindexalarm

import android.app.*
import android.content.Intent
import android.os.*
import android.provider.Settings
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class MonitorService : Service() {
    private lateinit var state: StateStore
    private lateinit var log: AttemptLog
    private lateinit var thread: HandlerThread
    private lateinit var worker: Handler
    private var wakeLock: PowerManager.WakeLock? = null
    private val workLocks = java.util.concurrent.ConcurrentHashMap.newKeySet<PowerManager.WakeLock>()
    private val failures = mutableMapOf<String, Int>()
    @Volatile private var stopping = false
    private val tick = object : Runnable {
        override fun run() {
            if (stopping || !state.running) return
            try {
                updateWakeLock()
                val ready = mutableListOf<Pair<TaskDefinition, Long>>()
                for (task in TaskCatalog.tasks) {
                    if (stopping) break
                    if (!state.enabled(task)) { state.setDue(task, null); continue }
                    val now = SystemClock.elapsedRealtime()
                    val snoozeRemaining = state.snoozedUntil(task) - System.currentTimeMillis()
                    val due = MonitorSchedule.due(now, state.due(task), snoozeRemaining)
                    if (snoozeRemaining <= 0 && now >= due) {
                        ready.add(task to due)
                        // Reserve the following slot before I/O, so process death keeps a wakeup.
                        state.setDue(task, MonitorSchedule.following(due, now, state.interval(task) * 1000))
                    } else if (state.due(task) != due) {
                        state.setDue(task, due)
                    }
                }
                arrangeNextWake()
                for ((task, due) in ready) {
                    if (stopping || !state.running) break
                    if (!state.enabled(task) || state.snoozedUntil(task) > System.currentTimeMillis()) continue
                    runTask(task, due)
                    val reserved = state.due(task)
                    if (reserved != null && reserved <= SystemClock.elapsedRealtime()) {
                        state.setDue(task, MonitorSchedule.following(reserved, SystemClock.elapsedRealtime(), state.interval(task) * 1000))
                    }
                }
                if (stopping || !state.running) return
                state.lastHeartbeat = System.currentTimeMillis()
                arrangeNextWake()
                updateForeground()
            } catch (e: Exception) {
                state.schedulerStatus = "调度错误：${e.message}；请打开应用检查"
                updateForeground("监控内部错误：${e.message}")
            }
        }
    }

    private fun arrangeNextWake() {
        worker.removeCallbacks(tick)
        if (stopping || !state.running) return
        val due = TaskCatalog.tasks.filter { state.enabled(it) }.mapNotNull { state.due(it) }.minOrNull()
        if (due == null) {
            MonitorAlarm.cancel(this)
            state.nextWakeWall = 0
            state.schedulerStatus = "所有任务已暂停，无定时唤醒"
            releaseWakeLock()
            return
        }
        state.schedulerStatus = MonitorAlarm.schedule(this, due)
        state.nextWakeWall = System.currentTimeMillis() + maxOf(0L, due - SystemClock.elapsedRealtime())
        if (state.reliableMode && wakeLock?.isHeld == true) {
            state.schedulerStatus = "连续唤醒模式（手动开启） · ${state.schedulerStatus}"
            worker.postDelayed(tick, (due - SystemClock.elapsedRealtime()).coerceIn(250, 60_000))
        }
    }

    override fun onCreate() {
        super.onCreate()
        state = StateStore(this)
        state.prepareSchedule(Settings.Global.getInt(contentResolver, Settings.Global.BOOT_COUNT, 0))
        log = AttemptLog(this)
        createChannels()
        thread = HandlerThread("indicator-monitor").apply { start() }
        worker = Handler(thread.looper)
    }
    override fun onBind(intent: Intent?) = null
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP || (intent?.action != ACTION_CHECK_NOW && !state.running)) {
            stopMonitoring(this)
            stopping = true
            MonitorAlarm.releaseHandoff()
            stopSelf()
            return START_NOT_STICKY
        }
        stopping = false
        startForeground(ONGOING_ID, foregroundNotification("正在启动监控"))
        state.running = true
        val workLock = getSystemService(PowerManager::class.java)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "FearIndexAlarm:check")
            .apply { acquire(120_000) }
        workLocks.add(workLock)
        MonitorAlarm.releaseHandoff()
        worker.removeCallbacks(tick)
        worker.post {
            try {
                if (intent?.action == ACTION_CHECK_NOW) TaskCatalog.tasks.forEach { state.setDue(it, null) }
                tick.run()
            } finally {
                synchronized(workLock) { if (workLock.isHeld) workLock.release() }
                workLocks.remove(workLock)
            }
        }
        return START_STICKY
    }

    private fun runTask(task: TaskDefinition, scheduledElapsed: Long) {
        val started = System.currentTimeMillis()
        val elapsed = SystemClock.elapsedRealtime()
        val scheduled = started + scheduledElapsed - elapsed
        var result: String
        try {
            deliverPending(task)
            val sample = CnnClient.fetch(task)
            if (stopping || !state.running || !state.enabled(task) || state.snoozedUntil(task) > System.currentTimeMillis()) return
            val previous = state.sample(task)
            val decision = MonitorRules.evaluate(previous, sample, System.currentTimeMillis())
            val message = if (decision.alert) "当前 ${MonitorRules.displayed(sample.value)}，上次 ${MonitorRules.displayed(previous!!.value)}；源数据 ${formatTime(sample.sourceTimeMs)}" else null
            if (decision.accept) state.saveSample(task, sample, message)
            deliverPending(task)
            result = "${if (decision.alert) "ALERT" else "OK"} · ${MonitorRules.displayed(sample.value)} · ${decision.reason}"
            state.setStatus(task, result, true)
            failures[task.id] = 0
        } catch (e: Exception) {
            result = "ERROR · ${e.message ?: e.javaClass.simpleName}"
            state.setStatus(task, result, false)
            val count = (failures[task.id] ?: 0) + 1
            failures[task.id] = count
            if (count == 3) healthAlert(task, "连续 3 次读取失败，请打开应用检查。${e.message}")
        }
        try { log.append(task.id, scheduled, started, elapsed, SystemClock.elapsedRealtime() - elapsed, result) }
        catch (e: Exception) { state.setStatus(task, "日志保存失败：${e.message}", false) }
    }

    private fun deliverPending(task: TaskDefinition) {
        if (stopping || !state.running || !state.enabled(task) || state.snoozedUntil(task) > System.currentTimeMillis()) return
        val message = state.pending(task) ?: return
        val manager = getSystemService(NotificationManager::class.java)
        if (!manager.areNotificationsEnabled()) throw IllegalStateException("通知权限未开启，提醒保留待发送")
        manager.notify(100 + TaskCatalog.tasks.indexOf(task), Notification.Builder(this, ALERT_CHANNEL)
            .setSmallIcon(R.drawable.ic_monitor).setContentTitle("恐慌指数下降 · ${task.name}")
            .setContentText(message).setStyle(Notification.BigTextStyle().bigText(message))
            .setContentIntent(openApp()).setAutoCancel(true).build())
        state.clearPending(task)
    }
    private fun healthAlert(task: TaskDefinition, message: String) {
        if (stopping || !state.running || !state.enabled(task) || state.snoozedUntil(task) > System.currentTimeMillis()) return
        getSystemService(NotificationManager::class.java).notify(200 + TaskCatalog.tasks.indexOf(task),
            Notification.Builder(this, HEALTH_CHANNEL).setSmallIcon(R.drawable.ic_monitor)
                .setContentTitle("监控数据源异常").setContentText(message)
                .setStyle(Notification.BigTextStyle().bigText(message)).setContentIntent(openApp()).setAutoCancel(true).build())
    }
    @Synchronized private fun updateWakeLock() {
        val required = !stopping && state.running && state.reliableMode && TaskCatalog.tasks.any {
            state.enabled(it) && state.snoozedUntil(it) <= System.currentTimeMillis()
        }
        if (required) {
            if (wakeLock == null) wakeLock = getSystemService(PowerManager::class.java)
                .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "FearIndexAlarm:continuous-monitor")
                .apply { setReferenceCounted(false) }
            // Optional compatibility mode only. Default Alarm mode never holds this idle lock.
            wakeLock!!.acquire(180_000)
        } else releaseWakeLock()
    }
    @Synchronized private fun releaseWakeLock() { if (wakeLock?.isHeld == true) wakeLock?.release() }
    private fun createChannels() {
        getSystemService(NotificationManager::class.java).createNotificationChannels(listOf(
            NotificationChannel(STATUS_CHANNEL, "持续监控状态", NotificationManager.IMPORTANCE_LOW),
            NotificationChannel(ALERT_CHANNEL, "指数下降提醒", NotificationManager.IMPORTANCE_HIGH),
            NotificationChannel(HEALTH_CHANNEL, "监控异常提醒", NotificationManager.IMPORTANCE_DEFAULT)))
    }
    private fun openApp() = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    private fun foregroundNotification(message: String): Notification {
        val stop = PendingIntent.getService(this, 1, Intent(this, MonitorService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        return Notification.Builder(this, STATUS_CHANNEL).setSmallIcon(R.drawable.ic_monitor)
            .setContentTitle("恐慌指数 · 持续监控中").setContentText(message).setOngoing(true).setOnlyAlertOnce(true)
            .setContentIntent(openApp()).addAction(Notification.Action.Builder(null, "停止监控", stop).build()).build()
    }
    private fun updateForeground(message: String? = null) {
        if (stopping || !state.running) return
        val text = message ?: state.schedulerStatus + "；" + TaskCatalog.tasks.filter { state.enabled(it) }.joinToString("；") {
            "${state.interval(it)} 秒 · ${state.status(it)}"
        }.ifBlank { "所有任务已暂停" }
        getSystemService(NotificationManager::class.java).notify(ONGOING_ID, foregroundNotification(text))
    }
    override fun onDestroy() {
        stopping = true
        worker.removeCallbacksAndMessages(null)
        releaseWakeLock()
        workLocks.forEach { synchronized(it) { if (it.isHeld) it.release() } }
        workLocks.clear()
        MonitorAlarm.releaseHandoff()
        if (!state.running) MonitorAlarm.cancel(this)
        // quitSafely lets an in-flight bounded HTTP request finish before closing SQLite.
        worker.post { log.close(); thread.quitSafely() }
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }
    companion object {
        const val ACTION_STOP = "com.fearindexalarm.STOP"
        const val ACTION_CHECK_NOW = "com.fearindexalarm.CHECK_NOW"
        const val ACTION_RECONFIGURE = "com.fearindexalarm.RECONFIGURE"
        const val ONGOING_ID = 1
        const val STATUS_CHANNEL = "monitor-status"
        const val ALERT_CHANNEL = "indicator-decreases"
        const val HEALTH_CHANNEL = "monitor-health"
        fun stopMonitoring(context: android.content.Context) {
            val state = StateStore(context)
            state.running = false
            MonitorAlarm.cancel(context)
            state.nextWakeWall = 0
            state.schedulerStatus = "监控已停止"
            TaskCatalog.tasks.forEach { state.setDue(it, null) }
        }
        fun formatTime(ms: Long): String = DateTimeFormatter.ofPattern("MM-dd HH:mm:ss").withZone(ZoneId.systemDefault()).format(Instant.ofEpochMilli(ms))
    }
}
