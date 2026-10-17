"""Check Git-selected source files without initializing/staging the main checkout.

Uses only Python stdlib and Git. Exit 1 for findings, 0 for a clean heuristic scan.
Git author metadata and manually uploaded release archives need separate review.
"""
import argparse
import getpass
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]
FORBIDDEN_SUFFIXES = {".key", ".pem", ".p12", ".pfx", ".jks", ".keystore", ".db", ".sqlite", ".sqlite3", ".jsonl", ".pdb", ".exe", ".apk"}
FORBIDDEN_NAMES = {"agent.md", "credentials.json", "secrets.json", "key.properties", "keystore.properties"}
PATTERNS = {
    "absolute user-home path": re.compile(r"(?i)(?:[a-z]:[\\/]+Users[\\/]+[^\\/\s\"']+|/(?:home|Users)/[^/\s\"']+)"),
    "named local timezone": re.compile(r"\b(?:Europe|Asia|America|Africa|Australia|Pacific|Indian|Atlantic)/[A-Za-z_]+"),
    "non-UTC timestamp": re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?[+-](?!00:00)\d{2}:\d{2}"),
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----"),
    "GitHub token": re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b"),
    "AWS access key": re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
    "Google API key": re.compile(r"\bAIza[0-9A-Za-z_-]{30,}\b"),
    "Slack token": re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{15,}\b"),
    "JWT": re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"),
    "URL credentials": re.compile(r"https?://[^/\s:@]+:[^/\s@]+@"),
    "secret assignment": re.compile(r'''(?i)(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd|secret[_-]?key)\s*[:=]\s*["'][^"'\r\n]{6,}["']'''),
    "email address": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
}


def git_files(root):
    # Ignore machine-global exclude rules so they cannot hide a file from this review.
    env = os.environ.copy()
    env.update(GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL=os.devnull)
    # Do not inherit a caller's alternate index/repository/worktree.
    for key in ("GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"):
        env.pop(key, None)

    def run(args):
        return subprocess.check_output(["git", "-c", "core.excludesFile=", *args], cwd=root, env=env, stderr=subprocess.PIPE)

    def listed(prefix):
        data = run([*prefix, "ls-files", "--cached", "--others", "--exclude-standard", "-z"])
        return sorted(set(x.decode("utf-8") for x in data.split(b"\0") if x))

    if (root / ".git").exists():
        return listed([])
    scratch = root / ".tools"
    scratch.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="public-check-", dir=scratch) as directory:
        temp_root = Path(directory).resolve()
        assert temp_root.parent == scratch.resolve()
        bare = temp_root / "repository.git"
        run(["-c", "init.templateDir=", "init", "--bare", "--quiet", str(bare)])
        return listed([f"--git-dir={bare}", f"--work-tree={root}"])


def private_markers(root):
    markers = []
    private = root / "agent.md"
    if private.is_file():
        for line in private.read_text(encoding="utf-8").splitlines():
            if line.startswith("- private-marker: "):
                value = line.split(": ", 1)[1].strip()
                if len(value) >= 2:
                    markers.append(value)
    account = getpass.getuser()
    if len(account) >= 5 and account.casefold() not in {"administrator", "runner", "system"}:
        markers.append(account)
    return markers


def scan(root, paths, markers):
    findings = []
    for relative in paths:
        path = root / relative
        name = path.name.casefold()
        if name in FORBIDDEN_NAMES or path.suffix.casefold() in FORBIDDEN_SUFFIXES or (name.startswith(".env") and name != ".env.example"):
            findings.append({"file": relative, "kind": "private/runtime/generated filename"})
            continue
        if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
            findings.append({"file": relative, "kind": "symlink or path outside checkout"})
            continue
        if not path.is_file():
            # A staged deletion is absent from the worktree and cannot be content-scanned.
            findings.append({"file": relative, "kind": "tracked file absent; review staged index separately"})
            continue
        data = path.read_bytes()
        text = data.decode("utf-8-sig", errors="ignore")
        for number, line in enumerate(text.splitlines(), 1):
            for label, pattern in PATTERNS.items():
                if pattern.search(line):
                    findings.append({"file": relative, "line": number, "kind": label})
            if any(marker.casefold() in line.casefold() for marker in markers):
                # Report location only, never echo the matching personal value/token.
                findings.append({"file": relative, "line": number, "kind": "local private marker"})
    return findings


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list", action="store_true", help="Also list reviewed public file paths")
    args = parser.parse_args()
    paths = git_files(ROOT)
    findings = scan(ROOT, paths, private_markers(ROOT))
    report = {"public_file_count": len(paths), "findings": findings,
              "scope": "Working-tree content selected by Git; does not certify Git history/index blobs, commit identity or release archives"}
    if args.list:
        report["files"] = paths
    print(json.dumps(report, ensure_ascii=True, indent=2))
    return int(bool(findings))


if __name__ == "__main__":
    raise SystemExit(main())
