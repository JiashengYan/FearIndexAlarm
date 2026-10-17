package com.fearindexalarm

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.OffsetDateTime
import java.io.ByteArrayOutputStream

object CnnClient {
    fun fetch(task: TaskDefinition): Sample {
        require(task.id == "cnn-fear-greed") { "尚未实现该任务的数据源" }
        val connection = URL(task.url).openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 10_000
            connection.readTimeout = 10_000
            connection.instanceFollowRedirects = false
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Referer", "https://edition.cnn.com/markets/fear-and-greed")
            connection.setRequestProperty("Origin", "https://edition.cnn.com")
            connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")
            val status = connection.responseCode
            if (status != 200) throw IllegalStateException(if (status == 403 || status == 418)
                "CNN 拒绝程序访问（HTTP $status），没有取得实时数据" else "CNN HTTP $status")
            val body = connection.inputStream.use { input ->
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    require(output.size() + count <= 2_000_000) { "响应超过 2 MB 限制" }
                    output.write(buffer, 0, count)
                }
                output.toString("UTF-8")
            }
            val root = JSONObject(body).getJSONObject("fear_and_greed")
            return Sample(root.getDouble("score"), parseTimestamp(root.get("timestamp")))
        } finally { connection.disconnect() }
    }

    fun parseTimestamp(raw: Any): Long {
        if (raw is Number) {
            val value = raw.toLong()
            return if (value < 100_000_000_000L) Math.multiplyExact(value, 1000) else value
        }
        val value = raw.toString()
        value.toLongOrNull()?.let { return parseTimestamp(it) }
        return try { Instant.parse(value).toEpochMilli() }
        catch (_: Exception) { OffsetDateTime.parse(value).toInstant().toEpochMilli() }
    }
}
