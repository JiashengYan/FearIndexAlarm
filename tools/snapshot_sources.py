"""Write an immutable per-worklog source manifest; excludes toolchains/build/runtime data."""
import argparse
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from check_public_files import git_files


ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRECTORIES = {".tools", ".git", ".gradle", ".kotlin", ".idea", ".vs", ".vscode", ".codex", ".agents", ".aws", ".ssh", "artifacts", "bin", "obj", "build", "__pycache__", "manifests", "evidence", "node_modules", ".next"}
SKIP_FILES = {"agent.md", "credentials.json", "secrets.json", "key.properties", "keystore.properties"}
EXTENSIONS = {".py", ".ps1", ".cs", ".csproj", ".props", ".config", ".manifest", ".kt", ".kts", ".xml", ".properties", ".csv", ".json", ".svg", ".ico", ".png", ".md", ".ts", ".tsx", ".mjs", ".css"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("entry", help="Closed or closing worklog entry, e.g. W-002")
    args = parser.parse_args()
    if not (args.entry.startswith("W-") and args.entry[2:].isdigit()):
        parser.error("entry must match W-<digits>")
    records = []
    public_paths = set(git_files(ROOT))
    for directory, subdirectories, files in os.walk(ROOT):
        subdirectories[:] = sorted(name for name in subdirectories if name.lower() not in SKIP_DIRECTORIES)
        for name in sorted(files):
            if name.lower() in SKIP_FILES:
                continue
            path = Path(directory) / name
            if path.relative_to(ROOT).as_posix() not in public_paths:
                continue
            if path.suffix.lower() not in EXTENSIONS and name not in {".gitignore", ".npmrc"}:
                continue
            data = path.read_bytes()
            records.append({"path": path.relative_to(ROOT).as_posix(), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    output = ROOT / "docs" / "agent" / "manifests" / f"{args.entry}-sources.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    # Refuse overwrite: use a new worklog/correction entry for subsequent delivered snapshots.
    with output.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump({"schema": 1, "worklog": args.entry, "created_utc": datetime.now(timezone.utc).isoformat(),
                   "hash_algorithm": "SHA-256", "files": sorted(records, key=lambda row: row["path"])}, stream, indent=2, ensure_ascii=False)
        stream.write("\n")
    print(f"{len(records)} source files -> {output.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main()
