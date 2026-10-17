import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from analyze_timing import analyze


class TimingEvidenceTest(unittest.TestCase):
    def test_missing_minute_and_failure_are_visible(self):
        rows = [
            {"task": "cnn", "started_ms": 1_000_000, "scheduled_ms": 1_000_000, "duration_ms": 200, "result": "OK"},
            {"task": "cnn", "started_ms": 1_060_000, "scheduled_ms": 1_060_000, "duration_ms": 10000, "result": "ERROR timeout"},
            {"task": "cnn", "started_ms": 1_180_000, "scheduled_ms": 1_120_000, "duration_ms": 300, "result": "ALERT"},
        ]
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / "evidence.jsonl"
            log.write_text("\n".join(json.dumps(row) for row in rows), encoding="utf-8")
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                analyze(log, 60)
            report = output.getvalue()
        self.assertIn("3 attempts, 1 failures, 1 alert decisions", report)
        self.assertIn("p99=120.000s max=120.000s", report)
        self.assertIn("gaps > 90s: 1 / 2", report)
        self.assertIn("schedule delay: p99=60.000s max=60.000s", report)

    def test_empty_export_cannot_claim_reliability(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / "empty.jsonl"
            log.write_text("", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "No task attempts"):
                analyze(log, 60)


if __name__ == "__main__":
    unittest.main()
