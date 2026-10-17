package com.fearindexalarm

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock

object MonitorAlarm {
    const val ACTION_WAKE = "com.fearindexalarm.ALARM_WAKE"
    fun canScheduleExact(context: Context): Boolean = Build.VERSION.SDK_INT < 31 ||
        context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()

    private fun operation(context: Context) = PendingIntent.getBroadcast(context, 20,
        Intent(context, MonitorAlarmReceiver::class.java).setAction(ACTION_WAKE),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    @SuppressLint("ScheduleExactAlarm") // Checked at runtime; permission can race with scheduling.
    @Synchronized fun schedule(context: Context, due: Long): String {
        // Serialize the final running check with cancel, including Stop racing with HTTP.
        val state = StateStore(context)
        if (!state.running || TaskCatalog.tasks.none { state.enabled(it) }) {
            cancel(context)
            return if (state.running) "所有任务已暂停" else "监控已停止"
        }
        val manager = context.getSystemService(AlarmManager::class.java)
        val operation = operation(context)
        val at = maxOf(SystemClock.elapsedRealtime() + 250, due)
        val exact = MonitorSchedule.arm(canScheduleExact(context),
            { manager.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, operation) },
            { manager.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, operation) })
        return if (exact) "精确 Alarm（休眠时仍受系统限制）"
            else "非精确 Alarm：未获精确闹钟权限，可能明显延迟"
    }

    @Synchronized fun cancel(context: Context) { context.getSystemService(AlarmManager::class.java).cancel(operation(context)) }

    // Bridge broadcast -> service startup only. The service takes its own bounded work lock.
    private var handoff: PowerManager.WakeLock? = null
    private val main = Handler(Looper.getMainLooper())
    fun acquireHandoff(context: Context) {
        releaseHandoff()
        handoff = context.getSystemService(PowerManager::class.java)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "FearIndexAlarm:alarm-handoff")
            .apply { setReferenceCounted(false); acquire(30_000) }
        main.removeCallbacks(expireHandoff)
        main.postDelayed(expireHandoff, 30_000)
    }
    private val expireHandoff = Runnable { releaseHandoff() }
    fun releaseHandoff() {
        main.removeCallbacks(expireHandoff)
        if (handoff?.isHeld == true) handoff?.release()
        handoff = null
    }
}

class MonitorAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != MonitorAlarm.ACTION_WAKE &&
            intent.action != AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED) return
        val state = StateStore(context)
        if (!state.running) { MonitorAlarm.cancel(context); return }
        MonitorAlarm.acquireHandoff(context)
        try {
            context.startForegroundService(Intent(context, MonitorService::class.java)
                .setAction(MonitorService.ACTION_RECONFIGURE))
        } catch (e: Exception) {
            MonitorAlarm.releaseHandoff()
            // Inexact alarms do not grant a background-FGS-start exemption after process death.
            // Keep a diagnosis and a later retry; never claim that a read occurred.
            state.schedulerStatus = "系统未允许唤醒监控服务，请打开应用：${e.javaClass.simpleName}"
            val delay = TaskCatalog.tasks.filter { state.enabled(it) }.minOfOrNull { state.interval(it) * 1000 }
            if (delay != null) {
                try { MonitorAlarm.schedule(context, SystemClock.elapsedRealtime() + delay) }
                catch (_: Exception) { /* Diagnosis remains visible on next open. */ }
            }
        }
    }
}
