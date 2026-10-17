package com.fearindexalarm

import android.Manifest
import android.annotation.SuppressLint
import android.app.*
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.*
import android.provider.Settings
import android.text.InputType
import android.view.ViewGroup
import android.widget.*
import java.util.concurrent.Executors

// This intentionally single-language prototype displays Chinese status text and ASCII interval input.
@SuppressLint("SetTextI18n")
class MainActivity : Activity() {
    private lateinit var state: StateStore
    private lateinit var status: TextView
    private lateinit var powerStatus: TextView
    private lateinit var reliability: Switch
    private val handler = Handler(Looper.getMainLooper())
    private val io = Executors.newSingleThreadExecutor()
    private val refresh = object : Runnable {
        override fun run() { renderStatus(); handler.postDelayed(this, 3000) }
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        state = StateStore(this)
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(24, 36, 24, 32)
            setBackgroundColor(Color.rgb(245, 248, 247))
        }
        val scroll = ScrollView(this).apply { addView(layout) }
        setContentView(scroll)
        fun text(value: String, size: Float = 16f) = TextView(this).also {
            it.text = value; it.textSize = size; it.setTextColor(Color.rgb(24, 45, 42)); it.setPadding(0, 12, 0, 12); layout.addView(it)
        }
        fun button(label: String, action: () -> Unit) { layout.addView(Button(this).apply { this.text = label; setOnClickListener { action() } }) }
        text("恐慌指数提醒", 28f)
        text("本机独立监控 · v0.2.1 · Alarm 按需唤醒", 14f)
        text("内置规则：指数低于 25，且显示整数较上次有效值下降时提醒。首次读取建立基准；反弹后再次下降仍提醒。")
        status = text("正在读取本地状态…")
        powerStatus = text("")
        reliability = Switch(this).apply {
            text = "连续唤醒模式（可选，会增加耗电；默认使用 Alarm）"
            isChecked = state.reliableMode
            setOnCheckedChangeListener { _, enabled -> state.reliableMode = enabled; refreshService() }
        }
        layout.addView(reliability)
        button("开始 / 立即检查") { startMonitor() }
        button("停止全部监控") { stopMonitor() }
        TaskCatalog.tasks.forEach { task ->
            text(task.name, 20f)
            layout.addView(Switch(this).apply {
                text = "启用此任务"; isChecked = state.enabled(task)
                setOnCheckedChangeListener { _, enabled -> state.setEnabled(task, enabled); refreshService() }
            })
            val frequency = EditText(this).apply {
                inputType = InputType.TYPE_CLASS_NUMBER
                setText(state.interval(task).toString())
                hint = "间隔秒数，60–604800"
                contentDescription = "执行间隔秒数"
            }
            layout.addView(frequency)
            button("保存执行间隔（秒）") {
                val seconds = frequency.text.toString().toLongOrNull()
                if (seconds == null || seconds !in 60..604800) toast("请输入 60–604800 秒")
                else { state.setInterval(task, seconds); refreshService(); toast("已保存") }
            }
            button("此任务休眠 1 小时") { state.snooze(task, System.currentTimeMillis() + 3_600_000); refreshService() }
            button("结束休眠") { state.snooze(task, 0); refreshService() }
        }
        text("后台运行设置", 20f)
        text("默认由 Alarm 按需唤醒，检查后释放 CPU。请允许“闹钟和提醒”以提高准时性；未允许时回退为非精确 Alarm。深度休眠会限制唤醒频率，一分钟间隔不保证准时。")
        button("允许精确闹钟和提醒") {
            if (Build.VERSION.SDK_INT >= 31) safeOpen(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                android.net.Uri.parse("package:$packageName")))
            else toast("此系统无需精确闹钟特殊权限")
        }
        text("需手动允许后台活动、自启动和通知，并将本应用设为不优化。各厂商系统的睡眠待机、省电和清理策略仍可能中断运行。常驻通知不等于绝对保活。")
        button("打开电池优化设置") { safeOpen(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) }
        button("打开本应用设置") { safeOpen(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.parse("package:$packageName"))) }
        button("查看执行间隔统计") {
            io.execute {
                val result = try { AttemptLog(this).use { it.summary(state.interval(TaskCatalog.tasks.first())) } } catch (e: Exception) { "读取失败：${e.message}" }
                runOnUiThread { AlertDialog.Builder(this).setTitle("实际请求记录").setMessage(result).setPositiveButton("关闭", null).show() }
            }
        }
        button("导出执行日志（JSONL）") {
            startActivityForResult(Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                type = "application/x-ndjson"; addCategory(Intent.CATEGORY_OPENABLE); putExtra(Intent.EXTRA_TITLE, "fear-index-attempts.jsonl")
            }, 7)
        }
        text("联网失败、CNN 限制访问和旧数据会明确显示。没有网络或进程被停止时，应用无法保证分钟级读取。重启手机后请重新打开并启动监控。", 14f)
    }
    private fun renderStatus() {
        if (!::status.isInitialized) return
        val heartbeat = state.lastHeartbeat
        status.text = buildString {
            append(if (state.running) "监控已开启 · ${state.schedulerStatus}" else "监控已停止")
            if (heartbeat > 0) append("\n最近执行调度：${MonitorService.formatTime(heartbeat)}")
            if (state.running && state.nextWakeWall > 0) {
                append("\n下次计划检查：${MonitorService.formatTime(state.nextWakeWall)}")
                if (System.currentTimeMillis() > state.nextWakeWall + 120_000) append("（已逾期，请检查后台权限）")
            }
            TaskCatalog.tasks.forEach { task ->
                val sample = state.sample(task)
                append("\n\n${task.name}\n上次有效值：${sample?.let { MonitorRules.displayed(it.value).toString() } ?: "—"}")
                if (sample != null) append("\n源数据：${MonitorService.formatTime(sample.sourceTimeMs)}")
                val success = state.lastSuccess(task)
                append("\n上次成功请求：${if (success == 0L) "—" else MonitorService.formatTime(success)}")
                if (state.snoozedUntil(task) > System.currentTimeMillis()) append("\n休眠至 ${MonitorService.formatTime(state.snoozedUntil(task))}")
                append("\n${state.status(task)}")
            }
        }
        val exempt = getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(packageName)
        val notifications = getSystemService(NotificationManager::class.java).areNotificationsEnabled()
        powerStatus.text = "精确闹钟：${if (MonitorAlarm.canScheduleExact(this)) "允许" else "未允许"} · 电池优化豁免：${if (exempt) "已开启" else "未开启"} · 通知：${if (notifications) "允许" else "未允许"}"
    }
    private fun startMonitor() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 3); return
        }
        if (!getSystemService(NotificationManager::class.java).areNotificationsEnabled()) { toast("请先在应用设置中允许通知"); return }
        try { startForegroundService(Intent(this, MonitorService::class.java).setAction(MonitorService.ACTION_CHECK_NOW)); toast("已启动，正在检查") }
        catch (e: Exception) { toast("无法启动：${e.message}") }
    }
    private fun stopMonitor() {
        MonitorService.stopMonitoring(this)
        // stopService identifies the service component, not a listener identity (lint false positive).
        val intent = Intent(this, MonitorService::class.java)
        stopService(intent)
        renderStatus()
    }
    private fun refreshService() {
        if (state.running) {
            try { startForegroundService(Intent(this, MonitorService::class.java).setAction(MonitorService.ACTION_RECONFIGURE)) }
            catch (e: Exception) { toast("无法更新调度：${e.message}") }
        }
        renderStatus()
    }
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 3 && grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) startMonitor()
        else toast("未允许通知，尚未启动监控")
    }
    @Deprecated("Legacy result API is intentional: no AndroidX runtime dependency")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 7 && resultCode == RESULT_OK) data?.data?.let { uri ->
            io.execute {
                val result = try {
                    val text = AttemptLog(this).use { it.export() }
                    contentResolver.openOutputStream(uri, "wt")!!.bufferedWriter().use { it.write(text) }
                    "日志已导出"
                } catch (e: Exception) { "导出失败：${e.message}" }
                runOnUiThread { toast(result) }
            }
        }
    }
    private fun safeOpen(intent: Intent) { try { startActivity(intent) } catch (_: Exception) { toast("系统未提供该入口，请在设置中手动查找") } }
    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    override fun onResume() { super.onResume(); refreshService(); handler.post(refresh) }
    override fun onPause() { handler.removeCallbacks(refresh); super.onPause() }
    override fun onDestroy() { io.shutdown(); super.onDestroy() }
}
