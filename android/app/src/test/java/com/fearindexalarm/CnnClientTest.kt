package com.fearindexalarm

import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test

class CnnClientTest {
    @Test fun liveProbeWhenExplicitlyRequested() {
        assumeTrue("Live access is opt-in", System.getenv("FEARINDEXALARM_LIVE_TEST") == "1")
        val sample = CnnClient.fetch(TaskCatalog.tasks.first())
        assertTrue(sample.value in 0.0..100.0)
        assertTrue(sample.sourceTimeMs > 0)
        println("LIVE CNN via Java HttpURLConnection: value=${sample.value}, sourceTimeMs=${sample.sourceTimeMs}")
    }
}
