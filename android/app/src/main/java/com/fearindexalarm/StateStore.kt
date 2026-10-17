package com.fearindexalarm

import android.annotation.SuppressLint
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.content.ContentValues
import org.json.JSONObject

// Baseline/outbox acknowledgements must reach disk before notification delivery proceeds.
@SuppressLint("ApplySharedPref")
class StateStore(context: Context) {
    private val prefs = context.getSharedPreferences("monitor", Context.MODE_PRIVATE)
    var running: Boolean
        get() = prefs.getBoolean("running", false)
        set(value) { prefs.edit().putBoolean("running", value).commit() }
    var reliableMode: Boolean
        // New key makes Alarm the default even for the old default-awake APK.
        get() = prefs.getBoolean("continuous_awake_opt_in", false)
        set(value) { prefs.edit().putBoolean("continuous_awake_opt_in", value).commit() }
    var schedulerStatus: String
        get() = prefs.getString("scheduler_status", "尚未安排")!!
        set(value) { prefs.edit().putString("scheduler_status", value).commit() }
    var nextWakeWall: Long
        get() = prefs.getLong("next_wake_wall", 0)
        set(value) { prefs.edit().putLong("next_wake_wall", value).commit() }
    fun prepareSchedule(bootCount: Int) {
        if (prefs.getInt("schedule_boot", -1) != bootCount) {
            val edit = prefs.edit().putInt("schedule_boot", bootCount).putLong("next_wake_wall", 0)
            TaskCatalog.tasks.forEach { edit.remove("${it.id}.due") }
            edit.commit()
        }
    }
    fun due(task: TaskDefinition): Long? = if (prefs.contains("${task.id}.due")) prefs.getLong("${task.id}.due", 0) else null
    fun setDue(task: TaskDefinition, due: Long?) {
        val edit = prefs.edit()
        if (due == null) edit.remove("${task.id}.due") else edit.putLong("${task.id}.due", due)
        edit.commit()
    }
    fun interval(task: TaskDefinition) = prefs.getLong("${task.id}.interval", task.defaultIntervalSeconds)
    fun setInterval(task: TaskDefinition, seconds: Long) {
        require(seconds in 60..604800)
        prefs.edit().putLong("${task.id}.interval", seconds).remove("${task.id}.due").commit()
    }
    fun enabled(task: TaskDefinition) = prefs.getBoolean("${task.id}.enabled", true)
    fun setEnabled(task: TaskDefinition, value: Boolean) { prefs.edit().putBoolean("${task.id}.enabled", value).remove("${task.id}.due").commit() }
    fun snoozedUntil(task: TaskDefinition) = prefs.getLong("${task.id}.snooze", 0)
    fun snooze(task: TaskDefinition, until: Long) { prefs.edit().putLong("${task.id}.snooze", until).remove("${task.id}.due").commit() }
    fun sample(task: TaskDefinition): Sample? =
        if (!prefs.contains("${task.id}.value")) null
        else Sample(java.lang.Double.longBitsToDouble(prefs.getLong("${task.id}.value", 0)), prefs.getLong("${task.id}.source", 0))
    fun saveSample(task: TaskDefinition, value: Sample, pendingMessage: String? = null) {
        val edit = prefs.edit().putLong("${task.id}.value", java.lang.Double.doubleToRawLongBits(value.value))
            .putLong("${task.id}.source", value.sourceTimeMs)
        if (pendingMessage != null) edit.putString("${task.id}.pending", pendingMessage)
        check(edit.commit()) { "无法保存监控基准" }
    }
    fun pending(task: TaskDefinition): String? = prefs.getString("${task.id}.pending", null)
    fun clearPending(task: TaskDefinition) { prefs.edit().remove("${task.id}.pending").commit() }
    fun status(task: TaskDefinition) = prefs.getString("${task.id}.status", "尚未读取")!!
    fun setStatus(task: TaskDefinition, message: String, success: Boolean) {
        val edit = prefs.edit().putString("${task.id}.status", message).putLong("${task.id}.attempt", System.currentTimeMillis())
        if (success) edit.putLong("${task.id}.success", System.currentTimeMillis())
        edit.commit()
    }
    fun lastSuccess(task: TaskDefinition) = prefs.getLong("${task.id}.success", 0)
    var lastHeartbeat: Long
        get() = prefs.getLong("heartbeat", 0)
        set(value) { prefs.edit().putLong("heartbeat", value).commit() }
}

class AttemptLog(context: Context) : SQLiteOpenHelper(context, "attempts.db", null, 1) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE attempts (id INTEGER PRIMARY KEY, task TEXT NOT NULL, scheduled INTEGER NOT NULL, started INTEGER NOT NULL, elapsed INTEGER NOT NULL, duration INTEGER NOT NULL, result TEXT NOT NULL)")
    }
    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit
    @Synchronized fun append(task: String, scheduled: Long, started: Long, elapsed: Long, duration: Long, result: String) {
        writableDatabase.insertOrThrow("attempts", null, ContentValues().apply {
            put("task", task); put("scheduled", scheduled); put("started", started)
            put("elapsed", elapsed); put("duration", duration); put("result", result)
        })
        writableDatabase.execSQL("DELETE FROM attempts WHERE id <= (SELECT MAX(id) - 12000 FROM attempts)")
    }
    @Synchronized fun export(): String = buildString {
        readableDatabase.rawQuery("SELECT task,scheduled,started,elapsed,duration,result FROM attempts ORDER BY id", null).use { cursor ->
            while (cursor.moveToNext()) append(JSONObject().apply {
                put("task", cursor.getString(0)); put("scheduled_ms", cursor.getLong(1))
                put("started_ms", cursor.getLong(2)); put("elapsed_ms", cursor.getLong(3))
                put("duration_ms", cursor.getLong(4)); put("result", cursor.getString(5))
            }.toString()).append('\n')
        }
    }
    @Synchronized fun summary(expectedSeconds: Long): String {
        var count = 0; var maxGap = 0L; var longGaps = 0; var previous: Long? = null
        val thresholdMs = expectedSeconds * 1500
        readableDatabase.rawQuery("SELECT elapsed FROM attempts WHERE task = ? ORDER BY id", arrayOf("cnn-fear-greed")).use { cursor ->
            while (cursor.moveToNext()) {
                val current = cursor.getLong(0)
                previous?.let { if (current >= it) { val gap = current - it; maxGap = maxOf(maxGap, gap); if (gap > thresholdMs) longGaps++ } }
                previous = current; count++
            }
        }
        return "已记录 $count 次请求；最大间隔 ${maxGap / 1000} 秒；超过当前周期 1.5 倍（${thresholdMs / 1000} 秒）$longGaps 次。历史记录按当前 $expectedSeconds 秒周期比较，含主动暂停/调整间隔；重启间隔见导出日志。"
    }
}
