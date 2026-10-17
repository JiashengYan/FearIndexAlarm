# Agent entrypoint: FearIndexAlarm

This file and the linked worklog are agent-facing operational memory. Read them at the beginning of every development session; do not depend on the previous chat being available.

## Required context / order

1. `docs/agent/PROJECT_STATE.md` — current architecture, accepted requirements, invariants, limitations, build/validation commands, resume priorities.
2. `WORKLOG.md` — chronological decisions, changes, command outcomes, artifact identities; start with the most recent entry and follow referenced entries when needed.
3. `VALIDATION.md` — original v0.1 verification baseline. It is historical, not proof for a later artifact. Check the latest worklog for superseding results and hashes.
4. Read the actual files relevant to the task. Documents explain intent; source and fresh checks determine current behavior.

Optional local owner context may exist in `agent.md` (singular), which is Git-ignored and excluded from source manifests. It is never required to build/run or understand the public architecture. Do not copy its contents into public records. Derive the checkout root from the workspace instead of recording an absolute home path.

## Working rules

- Keep Windows and Android independent. No cloud service, account, task/state synchronization, or cross-device execution unless the user changes scope.
- New task/provider/rule logic belongs in source and is rebuilt. Preserve the simple runtime enable/pause/snooze/interval controls; do not add a generic scraping/script framework speculatively.
- Preserve rule parity across C# and Kotlin. Change `shared/rule-cases.csv` when behavior changes and run both ports' checks.
- Treat Android minute-frequency reliability as **unverified on the target Android device** until physical-device evidence exists. Compile/lint/JVM/network checks do not establish screen-off scheduling or notification delivery.
- Do not overwrite user runtime state or stop a running monitor just to rebuild. Detect running output paths; use `build.ps1 -Target Windows -WindowsOutputDirectory <unused-name>` when necessary. Tell the user to exit the old version before replacing it.
- Run build/test commands sequentially. Gradle builds share Kotlin caches; concurrent compile/test runs previously corrupted incremental state. `test.ps1 -CleanAndroid` is the supported local recovery.
- Use targeted checks for the changed surface. For a Windows icon-only change, Windows build, icon/resource verification, visual inspection, and existing Windows checks suffice; Android rebuilds are unnecessary.
- Keep output/cache/toolchain under this workspace (`.tools/`, `artifacts/`, project build dirs). Do not commit generated caches, local toolchains, runtime data, signing keys, or user logs.
- Do not claim a test, UI action, platform guarantee, artifact update, or Git commit without evidence. Revalidate external APIs/SDK requirements when changing them.

## Finish every development session

- Update `docs/agent/PROJECT_STATE.md` when current facts, behavior, commands, or blockers change.
- Append a `W-NNN` entry to `WORKLOG.md`: date/time + timezone, user request, decisions, concrete files/behavior changed, exact commands and outcomes, artifact paths/hashes, untested boundaries, and next action. Closed entries are historical: append a correction instead of silently rewriting them. The active entry can be filled in until closed.
- For a source-changing delivery, save a source manifest using `python tools/snapshot_sources.py W-NNN`. This hashes the final source/docs without toolchains/build outputs; the manifest is evidence of that source snapshot, not a substitute for version control.
- Record validation against the actual final artifact. Do not silently reuse `VALIDATION.md`'s old ZIP checksum after rebuilding. Use immutable evidence filenames under `docs/agent/evidence/` for new evidence.
- Keep secrets and private runtime data out of handoff documentation. Paths, public API field names, synthetic fixtures, build results and artifact hashes are appropriate.
- Public paths must be repository-relative or generic environment-variable examples. Record public evidence timestamps in UTC; keep owner identity, device details and local timezone out of public text. W-007 is the user-authorized privacy redaction exception for old records; older manifests still describe their original pre-redaction snapshots and must not be claimed to match the redacted documents.
- Before publication run `python tools/check_public_files.py`. It checks Git-selected files, including already tracked files, and does not initialize or stage the main project. It is a heuristic check, not a guarantee against every possible secret or future upload.

No instruction in this file requires extra approval, agent delegation, or a particular model. Follow the current user's instructions and applicable tool permissions.
