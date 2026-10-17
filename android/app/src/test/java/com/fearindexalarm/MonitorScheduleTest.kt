package com.fearindexalarm

import org.junit.Assert.*
import org.junit.Test

class MonitorScheduleTest {
    @Test fun exactPermissionPreferred() {
        var calls = ""
        assertTrue(MonitorSchedule.arm(true, { calls += "exact" }, { calls += "inexact" }))
        assertEquals("exact", calls)
    }
    @Test fun missingPermissionUsesInexactOnly() {
        var calls = ""
        assertFalse(MonitorSchedule.arm(false, { fail("Exact not allowed") }, { calls += "inexact" }))
        assertEquals("inexact", calls)
    }
    @Test fun permissionRevocationRaceFallsBack() {
        var fallbackCalls = 0
        assertFalse(MonitorSchedule.arm(true, { throw SecurityException() }, { fallbackCalls++ }))
        assertEquals(1, fallbackCalls)
    }
    @Test(expected = IllegalStateException::class) fun otherFailuresAreNotHiddenAsPermissionDenial() {
        MonitorSchedule.arm(true, { throw IllegalStateException() }, { fail("Unexpected fallback") })
    }
    @Test fun firstStartAndProcessRestart() {
        assertEquals(1000L, MonitorSchedule.due(1000, null, 0))
        assertEquals(901000L, MonitorSchedule.due(1000, 901000, 0))
        assertEquals(1000L, MonitorSchedule.due(2_000_000, 1000, 0))
    }
    @Test fun snoozeOverridesDeadlineAndResumeCanRunImmediately() {
        assertEquals(3_601_000L, MonitorSchedule.due(1000, 500, 3_600_000))
        assertEquals(1000L, MonitorSchedule.due(1000, null, -1))
    }
    @Test fun lateWakeSkipsMissedPollsAndKeepsPhase() {
        assertEquals(901000L, MonitorSchedule.following(1000, 1000, 900_000))
        assertEquals(2_701_000L, MonitorSchedule.following(1000, 2_400_000, 900_000))
        assertEquals(1_801_000L, MonitorSchedule.following(901000, 901000, 900_000))
    }
}
