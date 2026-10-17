package com.fearindexalarm

// Elapsed time includes sleep and is unaffected by wall-clock/time-zone changes.
object MonitorSchedule {
    // A grant can be revoked after the check. Only that failure permits inexact fallback.
    fun arm(exactAllowed: Boolean, exact: () -> Unit, inexact: () -> Unit): Boolean {
        if (exactAllowed) {
            try { exact(); return true }
            catch (_: SecurityException) { /* Permission race. */ }
        }
        inexact()
        return false
    }

    fun due(now: Long, saved: Long?, snoozeRemaining: Long): Long =
        if (snoozeRemaining > 0) now + snoozeRemaining else saved ?: now

    // Preserve phase, skip missed periods, and never issue a catch-up burst.
    fun following(due: Long, now: Long, intervalMs: Long): Long {
        require(intervalMs > 0)
        return due + (maxOf(0L, now - due) / intervalMs + 1) * intervalMs
    }
}
