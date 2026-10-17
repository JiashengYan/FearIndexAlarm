package com.fearindexalarm

import org.junit.Assert.*
import org.junit.Test

class MonitorRulesTest {
    @Test fun sharedRuleCases() {
        val stream = javaClass.getResourceAsStream("/rule-cases.csv") ?: error("Missing shared rule fixture")
        stream.bufferedReader().useLines { lines ->
            lines.drop(1).filter { it.isNotBlank() }.forEach { line ->
                val c = line.split(';')
                val previous = if (c[1].isBlank()) null else Sample(c[1].toDouble(), c[2].toLong())
                val decision = MonitorRules.evaluate(previous, Sample(c[3].toDouble(), c[4].toLong()), c[5].toLong())
                assertEquals("${c[0]} accept", c[6].toBoolean(), decision.accept)
                assertEquals("${c[0]} alert", c[7].toBoolean(), decision.alert)
            }
        }
    }
    @Test fun invalidNumbers() {
        assertFalse(MonitorRules.evaluate(null, Sample(Double.NaN, 9999000), 10000000).accept)
        assertFalse(MonitorRules.evaluate(null, Sample(Double.POSITIVE_INFINITY, 9999000), 10000000).accept)
    }
    @Test fun timestampFormats() {
        assertEquals(1700000000000, CnnClient.parseTimestamp(1700000000L))
        assertEquals(1700000000000, CnnClient.parseTimestamp(1700000000000L))
        assertEquals(1700000000000, CnnClient.parseTimestamp("1700000000"))
        assertEquals(java.time.Instant.parse("2026-10-16T19:52:21Z").toEpochMilli(), CnnClient.parseTimestamp("2026-10-16T19:52:21+00:00"))
    }
}
