import contextlib
import io
from pathlib import Path
import subprocess
import tempfile
from unittest import TestCase, mock

from check_public_files import ROOT, git_files, scan
import snapshot_sources


class PublicationBoundaryTest(TestCase):
    def test_git_ignore_keeps_public_handoff_but_excludes_private_and_generated_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / ".gitignore").write_bytes((ROOT / ".gitignore").read_bytes())
            for name in ("agent.md", "AGENT.md", "AGENTS.md", "WORKLOG.md", "app.kt", ".env", ".env.example", "release.jks", "attempts.jsonl", "debug.pdb"):
                (root / name).write_text("", encoding="utf-8")
            (root / "android" / ".kotlin").mkdir(parents=True)
            (root / "android" / ".kotlin" / "cache.txt").write_text("", encoding="utf-8")
            (root / "docs").mkdir()
            (root / "docs" / "architecture.md").write_text("", encoding="utf-8")
            selected = git_files(root)
            self.assertEqual(set(selected), {".gitignore", ".env.example", "AGENTS.md", "WORKLOG.md", "app.kt", "docs/architecture.md"})
            self.assertFalse((root / ".git").exists())

    def test_force_tracked_private_file_is_still_reported(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            subprocess.run(["git", "-c", "init.templateDir=", "init", "--quiet", str(root)], check=True, capture_output=True)
            (root / ".gitignore").write_text("agent.md\n", encoding="utf-8")
            (root / "agent.md").write_text("local context", encoding="utf-8")
            subprocess.run(["git", "-C", str(root), "add", "-f", "agent.md"], check=True, capture_output=True)
            findings = scan(root, git_files(root), [])
            self.assertIn({"file": "agent.md", "kind": "private/runtime/generated filename"}, findings)

    def test_content_findings_report_locations_without_secret_values(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            sample_token = "gh" + "p_" + "x" * 24
            sample_path = "C" + ":" + "\\Users\\" + "example-user\\source"
            (root / "sample.txt").write_text(sample_token + "\n" + sample_path + "\nowner-marker", encoding="utf-8")
            findings = scan(root, ["sample.txt"], ["owner-marker"])
            self.assertEqual({f["kind"] for f in findings}, {"GitHub token", "absolute user-home path", "local private marker"})
            self.assertNotIn(sample_token, str(findings))
            self.assertNotIn(sample_path, str(findings))

    def test_source_manifest_never_hashes_private_owner_context(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "agent.md").write_text("local context", encoding="utf-8")
            (root / "AGENTS.md").write_text("public instructions", encoding="utf-8")
            (root / ".gitignore").write_text("agent.md\nprivate-settings.config\n.tools/\n", encoding="utf-8")
            (root / "private-settings.config").write_text("local configuration", encoding="utf-8")
            (root / "web").mkdir()
            for name in ("page.tsx", "rules.ts", "styles.css", "helper.mjs", "package-lock.json", ".npmrc"):
                (root / "web" / name).write_text("source", encoding="utf-8")
            for name in ("node_modules", ".next"):
                (root / "web" / name).mkdir()
                (root / "web" / name / "generated.json").write_text("generated", encoding="utf-8")
            with mock.patch.object(snapshot_sources, "ROOT", root), mock.patch("sys.argv", ["snapshot_sources.py", "W-999"]), contextlib.redirect_stdout(io.StringIO()):
                snapshot_sources.main()
            text = (root / "docs/agent/manifests/W-999-sources.json").read_text(encoding="utf-8")
            self.assertNotIn('"path": "agent.md"', text)
            self.assertIn('"path": "AGENTS.md"', text)
            self.assertNotIn('"path": "private-settings.config"', text)
            for name in ("page.tsx", "rules.ts", "styles.css", "helper.mjs", "package-lock.json", ".npmrc"):
                self.assertIn(f'"path": "web/{name}"', text)
            self.assertNotIn("generated.json", text)
