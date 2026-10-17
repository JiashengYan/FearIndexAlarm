"""Analyze exported monitoring evidence; stdlib only. Does not contact any service."""
import argparse
import json
import math
from collections import defaultdict
from pathlib import Path


def percentile(values, fraction):
    ordered = sorted(values)
    return ordered[max(0, math.ceil(len(ordered) * fraction) - 1)] if ordered else 0


def analyze(path, expected):
    tasks = defaultdict(list)
    for number, line in enumerate(Path(path).read_text(encoding="utf-8-sig").splitlines(), 1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
            if "task" in row:
                for field in ("started_ms", "scheduled_ms", "duration_ms"):
                    if not isinstance(row[field], (int, float)):
                        raise ValueError(f"invalid {field}")
                tasks[row["task"]].append(row)
        except (ValueError, KeyError, TypeError) as exc:
            raise ValueError(f"Line {number}: {exc}") from exc
    if not tasks:
        raise ValueError("No task attempts found")
    for task, rows in tasks.items():
        # Preserve export order; sorting would hide clock corrections and restarts.
        gaps = [(b["started_ms"] - a["started_ms"]) / 1000 for a, b in zip(rows, rows[1:])]
        valid_gaps = [value for value in gaps if value >= 0]
        delays = [max(0, row["started_ms"] - row["scheduled_ms"]) / 1000 for row in rows]
        errors = sum(str(row.get("result", "")).startswith("ERROR") for row in rows)
        alerts = sum(str(row.get("result", "")).startswith("ALERT") for row in rows)
        threshold = expected * 1.5
        print(f"{task}: {len(rows)} attempts, {errors} failures, {alerts} alert decisions")
        if valid_gaps:
            print(f"  request gap: median={percentile(valid_gaps, .5):.3f}s p99={percentile(valid_gaps, .99):.3f}s max={max(valid_gaps):.3f}s")
            print(f"  gaps > {threshold:g}s: {sum(value > threshold for value in valid_gaps)} / {len(valid_gaps)}")
        else:
            print("  Not enough readings to measure frequency.")
        print(f"  schedule delay: p99={percentile(delays, .99):.3f}s max={max(delays):.3f}s")
        print(f"  longest request: {max(row['duration_ms'] for row in rows) / 1000:.3f}s")
        if any(value < 0 for value in gaps):
            print("  WARNING: wall clock moved backward; negative gaps excluded.")
    print("Includes deliberate pauses, snoozes and restarts. No successful request is inferred from missing logs.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("log")
    parser.add_argument("--expected-seconds", type=float, default=60)
    args = parser.parse_args()
    if args.expected_seconds <= 0:
        parser.error("--expected-seconds must be positive")
    try:
        analyze(args.log, args.expected_seconds)
    except (OSError, ValueError) as exc:
        parser.exit(1, f"Error: {exc}\n")
