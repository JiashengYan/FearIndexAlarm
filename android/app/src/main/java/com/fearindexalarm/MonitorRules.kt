package com.fearindexalarm

import java.math.BigDecimal
import java.math.RoundingMode

data class Sample(val value: Double, val sourceTimeMs: Long)
data class Decision(val accept: Boolean, val alert: Boolean, val reason: String)

/** Pure rules: both ports run the same shared rule cases. Never infer missing readings. */
object MonitorRules {
    fun displayed(value: Double): Int = BigDecimal.valueOf(value).setScale(0, RoundingMode.HALF_UP).toInt()

    fun evaluate(previous: Sample?, current: Sample, nowMs: Long, maxAgeMs: Long = 3_600_000): Decision {
        if (!current.value.isFinite() || current.value < 0 || current.value > 100 || current.sourceTimeMs <= 0)
            return Decision(false, false, "无效数据")
        if (current.sourceTimeMs > nowMs + 300_000) return Decision(false, false, "数据时间超前")
        if (nowMs - current.sourceTimeMs > maxAgeMs) return Decision(false, false, "源数据超过 60 分钟未更新")
        if (previous != null && current.sourceTimeMs < previous.sourceTimeMs)
            return Decision(false, false, "忽略旧时间戳")
        if (previous != null && current.sourceTimeMs == previous.sourceTimeMs)
            return Decision(false, false, if (current.value == previous.value) "源数据未更新" else "同一时间戳数值冲突")
        val notify = previous != null && displayed(current.value) < 25 && displayed(current.value) < displayed(previous.value)
        return Decision(true, notify, if (notify) "低于 25 且较上次下降" else if (previous == null) "已建立基准" else "已更新")
    }
}

data class TaskDefinition(val id: String, val name: String, val defaultIntervalSeconds: Long, val url: String)

/** Add source-specific fetch/parse code and a definition here, then rebuild. */
object TaskCatalog {
    val tasks = listOf(TaskDefinition("cnn-fear-greed", "CNN 恐惧与贪婪指数", 900,
        "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"))
}
