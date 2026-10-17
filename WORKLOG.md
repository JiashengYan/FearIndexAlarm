# Agent worklog

schema: 1
audience: development agents
timezone: UTC (historical offset timestamps normalized during W-007 privacy redaction)
policy: chronological W-NNN entries; closed entries immutable except the explicitly user-authorized W-007 privacy redaction; append subsequent corrections
entrypoint: AGENTS.md
current_state: docs/agent/PROJECT_STATE.md
note: worklog IDs are not Git commits; repository had no .git at initialization

## W-001 — independent Windows/Android monitoring prototype

status: closed / retrospective
date: 2026-10-16
time_precision: day; reconstructed from this session's conversation, files, and command results, not a pre-existing contemporaneous log
request:
- Build Windows 11 and Android monitoring apps with task controls and minute-to-daily checks.
- User narrowed scope: no synchronization/cooperation; tasks can be added through PC source edits + recompilation.
- Initial provider: CNN Fear & Greed, alerts for decreases below 25, not increases. Android minute cadence is critical.
- Target: Android device with APK sideloading permitted; exact system build unconfirmed. Optional local device details are excluded from publication.

decisions:
- Replaced proposed Tauri/shared Rust/remote-executor concept with independent native Kotlin Android and C# WinForms Windows apps, because source-defined tiny rules do not justify Rust/JNI/shared UI complexity.
- Compare rounded displayed integers (nonnegative HALF_UP), previously stated in the implementation plan and accepted when user authorized implementation. First reading baseline, decline after rebound alerts again; same-integer decimals do not alert.
- Direct CNN JSON, no browser rendering or server. Browser-source request headers made developer-PC access succeed after a plain request returned HTTP 418.
- Android `specialUse` foreground monitoring, persistent notification/stop action, optional continuous wake lease. No claim of universal Android hard-real-time behavior. Physical test required.

implementation:
- Added all source under windows/, android/, shared/, tools/, plus bootstrap.ps1/build.ps1/test.ps1, NuGet.Config, Directory.Build.props, .gitignore, README.md and VALIDATION.md.
- Independent state persistence/outbox, stale/source-order checks, controls and JSONL attempt evidence. Android uses SQLite; Windows rotates JSONL at 4MB.
- Installed workspace-local .NET 10/JDK17/Gradle/Android SDK after permission; no system PATH edits.

verification_observed:
- `.\test.ps1 -LiveProbe -CleanAndroid`: PASS Windows 34 checks; PASS Android rule/timestamp tests and explicit actual Java client CNN fetch; PASS .NET actual client CNN fetch.
- `.\test.ps1` after final source edits: PASS Windows 34 checks + Android tests; Android lint `No issues found`.
- `python -m unittest discover -s tools -p test_*.py`: PASS 2.
- `.\build.ps1`: PASS Windows self-contained win-x64 and Android debug.
- apksigner verify: PASS APK Signature Scheme v2. aapt: com.fearindexalarm 0.1.0, min26/target35.
- `adb devices`: no connected devices at initial check.
- A concurrent Gradle test/build caused Kotlin incremental cache registration/unresolved-reference failures; sequential clean + tests resolved it. Commands must stay sequential.

artifact_baseline:
- artifacts/FearIndexAlarm-debug.apk SHA256 C5243E9F63FFD432C0D04771CA084FEBEAEFD7EE110474A35450002503CE0FD7
- artifacts/FearIndexAlarm-windows-x64.zip SHA256 B2C02BFE500D6B29D2A28B7D286290ECAF79CAD019EB9DCD3353C9C48B5FDD7F
- Evidence: VALIDATION.md (historical baseline; do not overwrite it to pretend the above hash is a newer artifact).

remaining:
- Physical device/vendor Android reliability, UI/notification end-to-end checks, 72h actual frequency, and battery measurement unperformed.
- Daily-only scheduling currently still uses the foreground scheduler/optional wake mode. Proper low-frequency OS scheduling is future optimization.
- Debug APK only; no release key workflow, boot receiver, Windows autostart or daily local-time schedule.

## W-002 — Windows stock-alert identity and agent memory

status: closed
started: 2026-10-16T20:34:23Z
last_artifact_verification: 2026-10-16T20:38:43Z
request: add a recognizable stock-market alert icon to Windows; create an agent-readable traceable project worklog for future agents without chat history
scope: Windows branding/resources and durable agent documentation; no provider/rule/Android behavior changes

decisions:
- Code-native vector primitives (falling mint chart, amber exclamation triangle, dark navy tile). No generated-photo dependency; regenerate with Pillow only at development time.
- Multi-frame ICO (16/20/24/32/40/48/64/128/256), PE icon + embedded runtime resource. Independent cloned icons owned/disposed by ApplicationContext for tray and window.
- Observed existing old Windows output running; stage updated build to artifacts/windows-icon and refresh distributable ZIP without terminating the user's monitor.
- AGENTS.md auto-discovery entrypoint + current PROJECT_STATE + chronological worklog + immutable per-entry source manifest/evidence.

changed_paths:
- tools/generate_windows_icon.py; windows/FearIndexAlarm/Assets/stock-alert.{ico,png,svg}
- windows/FearIndexAlarm/{AppIcon.cs,Program.cs,MainForm.cs,FearIndexAlarm.csproj}
- build.ps1: validated WindowsOutputDirectory parameter for an alternate output directory; default remains windows.
- AGENTS.md; WORKLOG.md; docs/agent/PROJECT_STATE.md; tools/snapshot_sources.py; docs/agent/manifests/ and evidence/ (delivery evidence to be filled before closing)

verification_observed:
- `python .\tools\generate_windows_icon.py`: PASS; Pillow decoded each of 9 ICO PNG frames (16..256 px). Visually inspected generated preview at actual small sizes and enlarged views.
- `.\test.ps1 -SkipAndroid`: PASS 34 existing Windows/core checks. No new behavior tests for this visual-only change.
- `.\build.ps1 -Target Windows -WindowsOutputDirectory windows-icon`: PASS Release self-contained win-x64, ZIP rebuilt. Provider/rule/Android sources not changed.
- PowerShell `ReflectionOnlyLoadFrom(...FearIndexAlarm.dll).GetManifestResourceStream('FearIndexAlarm.StockAlert.ico')`: resource present; SHA-256 equals source ICO. `System.Drawing.Icon.ExtractAssociatedIcon(...FearIndexAlarm.exe)` successfully extracted 32px PE icon; visually inspected actual extracted icon.
- Python zipfile + hashlib compared packaged FearIndexAlarm.exe to staged EXE: PASS byte-for-byte SHA-256 equality.
- Old running process was independently gone at final inspection. Copied staged files to the default artifacts/windows directory and verified EXE hashes match. Did not stop/restart any user process; did not touch runtime state.
- Android artifact checksum rechecked: identical to W-001. No Android rebuild or physical-device claim.
- `python tools/snapshot_sources.py W-002`: final source/doc manifest stored under docs/agent/manifests/W-002-sources.json; excludes its own directory and generated/cache outputs.

artifacts:
- Updated artifacts/FearIndexAlarm-windows-x64.zip SHA256 099C0DA47FB847403ACDACECF5283E14406308199EC49B841059B3447498B6FE
- Updated artifacts/windows/FearIndexAlarm.exe AND artifacts/windows-icon/FearIndexAlarm.exe SHA256 8C8005E065F1325EE61F63DBB2B229D4851D22D8ECD38072584C6744672B4BB9
- Source ICO SHA256 63157E0D8B5E9106B0C580D5B1A043320191BE22C5FBCB253892162869E127F6 (34759 bytes)
- artifacts/stock-alert-preview.png; artifacts/stock-alert-exe-icon.png (generated visual evidence, not source)
- Persistent checks: docs/agent/evidence/W-002-validation.json and W-002-output-copy.json. Original VALIDATION.md retained as historical W-001 baseline.

remaining: Windows shell/tray visual E2E and physical Android reliability remain unverified unless explicitly superseded by evidence below
next_action: next agent starts at AGENTS.md; for monitoring development resume the physical-device evidence priorities in PROJECT_STATE. If Explorer caches the old icon, restart the app/use fresh extracted output before diagnosing resource corruption; no shell cache clearing was performed.

## W-003 — prominent Windows value and CNN source-time diagnosis

status: closed
date: 2026-10-16
first_timing_evidence: 2026-10-16T20:45:20Z
last_artifact_verification: 2026-10-16T20:52:47Z
request: make current GUI value colored, bold and large; determine whether source timestamp is CNN-provided and why it trails the system clock by ~20 minutes
scope: Windows UI + explicit diagnostic tooling/docs; no provider/rule/state schema or Android behavior changes

implementation:
- MainForm per-task white cards with 52pt bold score and band colors. Null values use an em dash; stale >1h values are gray/historical; HTTP failures explicitly label the retained reading.
- Separated API timestamp (converted to system local offset), local LastSuccessMs, and current source age. LastSuccessMs represents successful fetch/parse, not new market data.
- Responsive root labels/cards/actions; forced guarded relayout after width changes avoids stale horizontal scrollbar extents.
- tools/probe_cnn_timing.ps1: opt-in default + revalidate direct probes, immutable output option; tools/windows-preview + render_windows_preview.ps1: actual MainForm rendered with isolated synthetic data, no monitor loop/network/notifications.

timing_findings:
- Public endpoint response at 20:45:20 UTC contained fear_and_greed.timestamp=20:27:55Z. Age relative to receive=1045.5s (~17m25s), request=161ms, HTTP Date current, Age header 110s, max-age=5, X-Cache HIT,HIT.
- A second no-cache request returned identical score/timestamp; no application cache policy was changed.
- This confirms an upstream-old record at receipt. A fixed 20-minute delay or the exact contribution of index computation, underlying feeds and multiple cache layers is not established. CNN official page was robots-blocked and searches did not provide an authoritative index delay SLA; do not conflate generic quote-delay disclaimers with this index.
- Immutable direct-response timing evidence: docs/agent/evidence/W-003-cnn-timing.json. Source timestamp remains untouched; no fake real-time adjustment.

verification_so_far:
- `.\test.ps1 -SkipAndroid`: PASS 34 checks before UI-only responsive refinements; core/provider/rules unchanged.
- `.\build.ps1 -Target Windows -WindowsOutputDirectory windows-gui`: initial PASS; final delivery will rebuild after preview refinements.
- Actual MainForm rendering checked red/green/empty/stale states. Initial invisible-only DrawToBitmap produced blank controls; helper now shows its isolated window offscreen before rendering. This was a QA helper issue, not evidence of a blank production window.
- Narrow resize initially retained a phantom horizontal scrollbar; fixed with guarded final PerformLayout. Final narrow preview reports horizontal-scroll=False.
- Live existing default Windows process observed at start (PID 36028, transient). Do not terminate it or overwrite a locked output; rediscover before copying.

final_validation:
- `.\test.ps1 -SkipAndroid` after final UI source refinements: PASS 34 checks.
- `.\build.ps1 -Target Windows -WindowsOutputDirectory windows-gui`: PASS final self-contained Release build.
- `.\tools\render_windows_preview.ps1`: actual MainForm rendered red/green/stale/empty cases; narrow resize `horizontal-scroll=False`. Used isolated artifact-local synthetic state, no real network/monitor loop/notifications or production state writes. Render helper requires desktop APIs and may need escalation; access to host NuGet config was blocked in sandbox, rerun with approved escalation succeeded.
- ZIP executable bytes compared via Python zipfile/SHA-256 to final staged EXE: PASS.
- Default old monitor still running at final inspection; left it running and left artifacts/windows unchanged. Updated ZIP and artifacts/windows-gui contain the new version. User must exit old tray process before starting new version (global single-instance mutex).
- Android APK SHA-256 still matches W-001; Android unchanged.
- Source/doc snapshot: `python tools/snapshot_sources.py W-003` -> docs/agent/manifests/W-003-sources.json.

artifacts:
- artifacts/FearIndexAlarm-windows-x64.zip SHA256 21A75B97D3BFB177F20B85111BC05599624F181D299828E4ADEC7B34874E41A3
- artifacts/windows-gui/FearIndexAlarm.exe SHA256 7287DC65440889DD36772E2F28AACC24A28FC6382F04141CA7E02897BAB13EBC
- docs/agent/evidence/W-003-validation.json (immutable final build/evidence summary)
- artifacts/windows-gui-preview/{fresh-red,fresh-green,stale,empty,narrow}.png (synthetic visual evidence, not live readings)

remaining: actual system notification display and physical Android reliability remain unverified; current render evidence verifies layout only
next_action: for GUI changes use the isolated renderer; for source delay investigate fresh direct endpoint responses and official source semantics without assuming a fixed SLA. Physical Android minute-frequency work remains highest-priority monitoring validation when a device is available.

## W-004 — default CNN polling interval to 15 minutes

status: closed
started: 2026-10-16T21:03:40Z
last_artifact_verification: 2026-10-16T21:05:39Z
request: change default frequency to 15 minutes, following a research-only discussion of alternate sources and polling tradeoffs
scope: both independent clients' default interval; existing configured intervals remain unchanged

implementation:
- Windows TaskCatalog CNN definition: 60 -> 900 seconds.
- Windows TaskState.IntervalSeconds initializer (missing JSON field fallback): 60 -> 900 seconds. Valid saved values, including 60, remain preserved by StateStore.
- Android TaskCatalog CNN definition: 60 -> 900 seconds. SharedPreferences already falls back to the task definition when interval is absent; persisted user intervals remain unchanged.
- README and current agent context updated. Minimum allowed interval remains 60s; one-hour freshness guard/rules, wake-lock renewal cadence and notification behavior unchanged.
- No generic default/migration framework or new tests for a constant-only change. Run existing checks for both ports and rebuild both artifacts.

validation:
- `.\test.ps1`: PASS Windows 34 checks, Android existing unit tests (live probe skipped), lint `No issues found.` No rule changes or additional tests for the constant change.
- `.\build.ps1 -WindowsOutputDirectory windows-15min`: PASS both Windows self-contained Release x64 and Android debug APK.
- apksigner verify: PASS updated APK signature.
- Python zipfile/SHA-256 comparison: PASS final ZIP contains the freshly built EXE.
- No running Windows monitor found at final copy check; copied staged output to artifacts/windows. No process stopped and no user runtime state edited.
- Final evidence: docs/agent/evidence/W-004-validation.json. Source manifest: `python tools/snapshot_sources.py W-004` -> docs/agent/manifests/W-004-sources.json.

artifacts:
- artifacts/FearIndexAlarm-windows-x64.zip SHA256 AA19575DCFDEC07B6E23C13ED89B760DB1A0F0AB3A987532BBB9FAC73F38EDB7
- artifacts/windows-15min/FearIndexAlarm.exe and artifacts/windows/FearIndexAlarm.exe SHA256 E78B1AA32AFBE63BEAED297A4BB9F1DA7B4D8DD98056651D351790713B1CF1E2
- artifacts/FearIndexAlarm-debug.apk SHA256 74CDC9E044FC9B5DC42F0E9FE5304A21DCDB4DD367799B85DA18BFE8DEA6F04F

remaining: no claim of improved Android wake-lock power behavior or physical timing reliability. Default polling interval changed only; preserved existing saved intervals can remain at 60s until user saves 900.
next_action: future agents treat 15 minutes as the latest chosen default, while keeping manual 60s minimum and the 60-minute freshness guard. Do not reset saved preferences unless explicitly requested.

## W-005 — Android Alarm-first battery-aware monitoring

status: closed
date: 2026-10-16 (UTC)
last_artifact_verification: 2026-10-16T21:16:23Z
request: prioritize AlarmManager after discussing Android power optimization for the 15-minute default
scope: Android scheduler, runtime controls/permission status, version and handoff docs. Windows/provider/alert rules unchanged.

decisions:
- Keep the existing user-started ongoing specialUse foreground service and persistent Stop notification; remove default idle CPU locking and <=60s background heartbeat/notification churn.
- One explicit immutable broadcast PendingIntent for nearest enabled deadline; one-shot ELAPSED_REALTIME_WAKEUP + setExactAndAllowWhileIdle when canScheduleExactAlarms permits. Fall back to setAndAllowWhileIdle on missing permission or a grant/check race; visibly label degraded timing. No cloud, WorkManager, JobScheduler, setAlarmClock or USE_EXACT_ALARM.
- SCHEDULE_EXACT_ALARM setting entry explains timing purpose. Grant broadcast and Activity resume reconfigure without forcing early HTTP. Revocation can kill process and cancel alarms, so instantaneous automatic fallback is NOT guaranteed; reopen app to recover. Inexact-alarm recovery may be denied background FGS startup after process death: record error and schedule a later retry, user can reopen.
- Default continuous-awake is now false via NEW continuous_awake_opt_in key, intentionally ignoring the old reliable key that defaulted true. This implements the user's new Alarm priority even on upgrade. Saved task intervals, baselines, pending notifications and logs retained. Optional continuous mode still renews a 180s lease on <=60s ticks only with an enabled, non-snoozed task.
- Exact alarms remain limited in idle (API docs mention ~15 minutes or longer); no minute-frequency/real-time guarantee. Need battery exemption for practical network/CPU behavior, and physical vendor Android evidence. Official docs checked this session; README links to AlarmManager, alarm permission, Doze and background FGS restrictions.

implementation:
- Added MonitorAlarm.kt: exact/inexact scheduling, receiver and <=30s startup handoff lock. Final running/enabled check, set and cancel serialized to address Stop racing with scheduling.
- MonitorService.kt: serial work, <=120s per-command wake locks released in finally/onDestroy, future slot reserved/persisted and alarm armed before HTTP, skip missed periods after slow reads, no alarm-only idle polling loop. Stop/all-disabled cancels; snooze arms resume time; all snoozed releases continuous lock. Guards late notifications/foreground updates after Stop.
- Added MonitorSchedule.kt pure selection/deadline helpers and MonitorScheduleTest.kt: 7 tests covering permission preference/fallback/race, non-permission failure propagation, initial/recovered deadlines, snooze, phase preservation and skipping missed checks.
- StateStore.kt: persisted elapsed deadlines with BOOT_COUNT invalidation, scheduler/next-wake metadata, opt-in continuous mode; task config invalidates only that task deadline. UI timing summary uses 1.5x current interval instead of fixed 90s (labels historical setting/pause limits).
- MainActivity.kt: explicit Check Now vs reconfigure, exact permission link/status, next planned check and overdue warning instead of the former 2-minute-heartbeat health assumption. Version UI/build bumped Android to 0.2.0/versionCode2. README + PROJECT_STATE updated.

validation:
- Final `.\test.ps1`: PASS Windows 34 checks; Android 10 JVM tests passed (7 new scheduling + 3 existing), 1 optional live probe skipped; lint `No issues found.` Prior intermediate checks also passed; final command rerun after last source corrections.
- Final `.\build.ps1 -Target Android`: PASS assembleDebug and artifact copy. Windows outputs not rebuilt/replaced.
- `.tools/android-sdk/build-tools/35.0.0/apksigner.bat verify --verbose --print-certs artifacts/FearIndexAlarm-debug.apk` with local JAVA_HOME: PASS v2. Debug certificate SHA256 73ce9a4d1ed401154688badd694feaca469d68b3dc3c7cde01b036a7778e2989.
- aapt dump badging/xmltree: packaged com.fearindexalarm 0.2.0/code2 min26/target35; exact alarm permission and receiver present.
- Delivery APK SHA256 equals android/app/build/outputs/apk/debug/app-debug.apk. Windows ZIP hash still equals W-004.
- `.tools/android-sdk/platform-tools/adb.exe devices`: empty. No device installation/UI, OS scheduling/cancellation, wake-lock or physical power tests performed. No fresh real CNN request; no user runtime state or running process altered.
- Immutable evidence docs/agent/evidence/W-005-validation.json. Source/doc manifest command: `python tools/snapshot_sources.py W-005`.

artifacts:
- artifacts/FearIndexAlarm-debug.apk SHA256 367FA4FF6285CB61BA0F7E6B57D9AE2FAD1F3D96CAFD0CEED0ADEDA088C986B3
- Windows remains W-004: artifacts/FearIndexAlarm-windows-x64.zip SHA256 AA19575DCFDEC07B6E23C13ED89B760DB1A0F0AB3A987532BBB9FAC73F38EDB7

remaining: No evidence yet of actual Alarm delivery, app/OS cancellation-race behavior, lock release, exact permission grant/revoke UI flow, Android device screen-off request cadence, notification display or measured energy reduction. JVM unit tests prove helper logic only; leases do not establish an absolute HTTP deadline. Persistent foreground service remains idle between checks; eliminating it would require a separately assessed execution/lifecycle design.
next_action: install APK on the authorized Android device when connected; allow notifications/exact alarm/background activity/battery exemption; test Stop during I/O, pause/snooze/resume, exact denial/grant/revoke-and-reopen, normal process kill, wall-clock changes and reboot/manual resume. Run 72h with exported timing logs and matched-condition battery comparison, use expected-seconds900 unless deliberately configured otherwise. Do not claim hard timing guarantees from compile/lint success.

## W-006 — identify latest Windows application and clean redundant artifacts

status: closed
date: 2026-10-16 (UTC)
cleanup_verified: 2026-10-16T21:20:15Z
request: inspect work records, identify latest Windows application in artifacts, delete surplus copies

findings:
- Latest Windows is W-004 (default 900s); W-005 only changed Android. All three files in windows/ and windows-15min/ were identical by SHA256; ZIP-contained EXE matched their EXE and W-004 evidence. windows-gui/ was W-003 and windows-icon/ was W-002.
- Get-CimInstance process query was denied. Non-escalated Get-Process succeeded with zero active FearIndexAlarm processes. Did not stop anything or access/modify production runtime state.

actions:
- Kept canonical artifacts/windows/ (EXE + two matching PDBs), matching FearIndexAlarm-windows-x64.zip, current W-005 FearIndexAlarm-debug.apk.
- Removed artifacts/windows-15min, windows-gui, windows-icon, windows-gui-preview (including developer-only synthetic state), stock-alert-exe-icon.png, stock-alert-preview.png. Generated previews can be recreated; source icon assets, build/preview tools and historical evidence/manifests remain.
- Verified all deletion targets resolved to explicit direct children of the absolute project artifacts directory, contained no reparse points, and contained no running monitor before native PowerShell Remove-Item -LiteralPath -Recurse -Force. Verified absence afterward. Total file bytes removed: 349182738 (~333 MiB).
- Updated PROJECT_STATE to remove stale current-artifact paths; historical closed worklog entries remain unchanged. No application source changes, rebuilds or behavior tests needed for artifact-only cleanup.

validation_and_artifacts:
- Canonical artifacts/windows/FearIndexAlarm.exe SHA256 E78B1AA32AFBE63BEAED297A4BB9F1DA7B4D8DD98056651D351790713B1CF1E2
- Retained artifacts/FearIndexAlarm-windows-x64.zip SHA256 AA19575DCFDEC07B6E23C13ED89B760DB1A0F0AB3A987532BBB9FAC73F38EDB7
- Retained artifacts/FearIndexAlarm-debug.apk SHA256 367FA4FF6285CB61BA0F7E6B57D9AE2FAD1F3D96CAFD0CEED0ADEDA088C986B3
- Immutable cleanup evidence: docs/agent/evidence/W-006-cleanup.json; docs snapshot: python tools/snapshot_sources.py W-006.

next_action: run artifacts/windows/FearIndexAlarm.exe for Windows; use retained ZIP for copying elsewhere. Previously staged windows-15min/gui/icon directories no longer exist. Monitoring/device validation priorities remain those in W-005/PROJECT_STATE.

## W-007 — sanitize public source and isolate optional local owner context

status: closed
date: 2026-10-17
timestamp_standard: UTC
last_artifact_verification: 2026-10-17T15:13:53Z
request: remove private owner information from publishable files; retain only necessary local context in an ignored singular agent.md; preserve others' ability to build/run and agents' ability to resume

privacy_exception:
- User explicitly authorized privacy removal, superseding the normal append-only/immutable policy for identity-bearing portions of historical docs/evidence. Redaction only: no historical test outcome, source-time age, rule behavior or artifact checksum changed. Older source manifests still describe the original pre-redaction source/doc bytes and are not evidence that redacted docs match those old snapshots. New manifest is W-007.
- Public paths are repository-relative; named owner timezone removed and offset timestamps normalized to UTC. Timing investigation remains receive20:45:20UTC/source20:27:55UTC, age1045.5s. Redundant source_local field removed from W-003 timing evidence and future diagnostic output. Specific owner device references generalized across AGENTS/README/VALIDATION/worklog/current state; private context is optional and never needed for build/runtime.

implementation:
- .gitignore: ignore singular agent.md case variants, environment/credential/signing files, runtime databases/log exports/PDBs and local IDE/agent/SDK caches. Public plural AGENTS.md and sanitized historical handoff docs stay included. No local owner path/email/name was hardcoded into source or the new checker.
- Added tools/check_public_files.py: stdlib + Git, actual local ignore rules with machine-global exclusions disabled; cached tracked paths remain included. Uses a temporary bare repository inside ignored .tools when main project is uninitialized; no main init/stage/commit/remote operations. Checks private filenames, home paths, timezone literals, common credential formats and optional local private markers; prints locations only. Explicit boundary: working-tree scan, not staged blob/history/commit identity/release archive certification.
- tools/snapshot_sources.py now intersects source paths with actual Git-selected files, excludes optional owner context and other local data/cache names, prints repository-relative output path. Added tools/test_public_files.py for Git-ignore behavior, force-tracked private context, redacted finding output and private/custom-ignored configuration exclusion from source manifests.
- MainActivity.kt replaces brand-specific guidance with generic manufacturer-system guidance. Android version0.2.1/code3 so the rebuilt APK can upgrade code2 normally. No rule/provider/scheduler/min/default interval change. Windows executable and ZIP unchanged; no user process stopped or runtime state overwritten.
- README/AGENTS explain private/public boundary, UTC records, scan command and separate commit-email/release-file review. Fresh clones have all public architecture/handoff files; agent.md can be absent.

validation:
- `.\test.ps1`: PASS Windows34, Android10 passed/1 optional live test skipped; lint `No issues found.` No live network probe or physical-device run.
- `python -m unittest discover -s tools -p test_*.py`: PASS6 (4 publication boundary tests + 2 timing tests).
- `.\build.ps1 -Target Android`: PASS final Android0.2.1; apksigner verify PASSv2; aapt packaged versionCode3/versionName0.2.1/min26/target35; delivery APK identical to build output. Known private markers absent from decompressed APK entries (not a general binary audit).
- PowerShell AST parse of tools/probe_cnn_timing.ps1: PASS; no request executed for its output-field-only change.
- `python tools/check_public_files.py`: PASS no findings after redaction. Public-only source copy also checked without private context; final report/evidence under docs/agent/evidence/W-007-publication.json. Source manifest command `python tools/snapshot_sources.py W-007`.

artifacts:
- artifacts/FearIndexAlarm-debug.apk SHA256 67F6DA09532F8ABACBBF969C3C970ECAFE109629E07349B53A8430FD5681B75B
- Windows ZIP remains AA19575DCFDEC07B6E23C13ED89B760DB1A0F0AB3A987532BBB9FAC73F38EDB7; EXE remains E78B1AA32AFBE63BEAED297A4BB9F1DA7B4D8DD98056651D351790713B1CF1E2.

remaining: heuristic scans cannot promise zero disclosure. Main Git repository still uninitialized; author metadata/remote identity are not rewritten. Local ignored SDK/cache/runtime/old binary/PDB content may retain machine paths; never upload the whole directory or force-add ignored files. Source publication safety is distinct from separately packaging a release. No cross-device Android runtime/battery guarantees added.
next_action: before first commit configure a public Git author alias and noreply address, rerun the checker, review staged contents, then create/push only the Git-selected source. Preserve optional private context only locally. Future agents use public AGENTS/PROJECT_STATE and should not copy owner context into new logs.
