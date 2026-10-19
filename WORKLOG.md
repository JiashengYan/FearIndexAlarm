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

## W-008 — independent Next.js alarm dashboard with Server Actions

status: closed
date: 2026-10-19 (UTC)
last_artifact_verification: 2026-10-19T16:18:13Z
request: build a polished web alarm in Next.js, calling APIs through Server Actions
scope: new local web client in this existing repository; no hosted deployment, accounts, cross-device state, native rebuild, staging or commit

decisions_and_behavior:
- Added independent Next.js16.4.2 / React19.3.1 / TypeScript app. Runtime dependencies only Next/React/ReactDOM; native CSS and SVG provide the responsive Chinese dashboard, gauge, 7/30/90-day history, comparison cards, controls, rules and event list. No external font/images, chart library or UI framework needed.
- `app/actions.ts` invokes fixed CNN public HTTPS endpoint on the server. `lib/cnn.ts` uses ordinary existing CNN headers, no-store, redirect:error, 20s timeout, 2 MB response limit, explicit failure result. No browser-direct CNN request, arbitrary URL, user credentials, mock-live fallback or server-side user-state disk writes. Next.js Server Functions docs and current registry package versions checked during implementation.
- `lib/market.ts` ports unchanged shared integer/freshness/order/duplicate rules and validates current/history/comparison values. `lib/monitor.ts` commits baseline and persistent in-page alerts together; repeated/stale/failing records do not advance baseline. Third consecutive request error gives one health notice; success resets. System browser notifications are best effort and do not implement native crash-recovery pending-alert retries.
- `app/use-monitor.ts` maintains browser-local state, default stopped/900s, initial preview, 60..604800-second settings, one-hour snooze/resume, manual refresh, no overlapping requests or missed-slot burst. Configuration revision rejects a result returned after stop/snooze/settings change. Same-origin Web Locks serialize fetches across tabs when supported; without it only one-tab serialization is promised. Storage errors halt automatic checks without silently overwriting bad records. Enabling starts a new failure streak. Only latest 200 events retained; JSON export and permission/test-notification controls implemented.
- Browser page and Next.js process must stay running. Background throttling, sleep, browser clock changes, offline/upstream refusal and closed pages cannot guarantee scheduled checks or delivered OS notifications. Page clearly states these limits. Native apps remain independent.

files:
- New `web/`: package/lock/config, `app/{actions,dashboard,use-monitor,layout,page}.tsx/ts`, icon.svg, globals.css, `lib/{cnn,market,monitor}.ts`, Node built-in test suite and Chinese README. Actual extensions/paths are in source manifest.
- `.gitignore` excludes node_modules, .next and tsbuildinfo; `web/.npmrc` uses workspace `.tools/npm-cache`.
- Snapshot tooling includes TS/TSX/CSS/MJS/.npmrc, prunes node_modules/.next; existing publication test extended to verify new sources included and generated files excluded.
- Root README and PROJECT_STATE describe web scope/commands/limits. Correction to historical state: .git now exists, but historical Windows EXE/ZIP and Android APK are absent in this checkout. W-004/W-007 hashes were not revalidated here. No native source, shared CSV, native user process or native runtime state modified.

commands_and_results (sequential builds/tests):
- `npm view next version --cache .tools/npm-cache` ->16.4.2; React version query ->19.3.1. Initial environment inherited disabled Node TLS verification; all subsequent installation/server/probe/audit commands explicitly set NODE_TLS_REJECT_UNAUTHORIZED=1, and direct CNN access passed with certificate verification enabled. No global environment setting changed.
- In `web/`, `npm install --no-audit`: PASS (29 packages); npm cache stayed under workspace. `npm exec --yes --registry=https://registry.npmjs.org --package=prettier@3.6.2 -- prettier --write app lib tests next.config.ts tsconfig.json package.json`: PASS formatting; no additional app dependency.
- Final `npm test`: PASS30 (23 shared cases +7 parser/transport/monitor tests). Final `npm run build`: PASS Next.js production compile/typecheck/static shell generation; no CNN request needed during build. `npm run typecheck`: PASS.
- `python -m unittest discover -s tools -p test_*.py`: PASS6 with TEMP/TMP set to workspace `.tools/`; includes manifest inclusion/exclusion regression.
- `npm audit --omit=dev --audit-level=high` against inherited mirror: HTTP404 unsupported audit API, not a clean result. Retried with `--registry=https://registry.npmjs.org`: PASS zero vulnerabilities.
- `npm run start -- --port 3000`: final production server loopback-only, HTTP200 confirmed by Invoke-WebRequest. Browser manually refreshed through actual Server Action and showed real CNN score/history; no captured browser warnings/errors after final reload.
- Direct final-library probe: `node --experimental-strip-types --input-type=module -e "import {fetchMarket} from './lib/cnn.ts'; const r=await fetchMarket(); if(!r.ok){console.log(JSON.stringify(r));process.exitCode=1;}else{console.log(JSON.stringify({ok:true,value:r.data.sample.value,sourceUtc:new Date(r.data.sample.sourceTimeMs).toISOString(),receivedUtc:new Date(r.data.receivedAt).toISOString(),historyPoints:r.data.history.length,tlsValidation:true}));}"` ->PASS; score27.3517857142857/source2026-10-19T16:11:18Z/receive16:16:37.852Z/251 historical points; TLS verification enabled in command environment.
- Browser QA: desktop and 390px layout visually inspected; mobile scrollWidth375 <= viewport390. Enable establishes baseline; snooze, resume, stop, interval selection, reload persistence and 7-day chart selection observed. Final state stopped/900s. Browser viewport override reset; test tab closed and owned QA server stopped after screenshots. No persistent background service left running.
- Full-page mobile screenshot timed out; supported viewport capture succeeded. Saved desktop/mobile JPEGs under `artifacts/web-preview-W-008/` (local UI time labels, not public evidence timestamps).
- `python artifacts/record_web_w008.py`: first packaging attempt found historical native binaries absent after creating ZIP; corrected recorder to report absence, reused and byte-verified every existing ZIP entry, then wrote immutable validation evidence. 21 source files packaged, every archived byte matched final source; no build cache/runtime data included.
- `python tools/check_public_files.py`: PASS before packaging and final handoff; `git diff --check`: PASS. Source snapshot command `python tools/snapshot_sources.py W-008`.

artifacts:
- `artifacts/FearIndexAlarm-web-source-W-008.zip` (39245 bytes), SHA256 `0663adbcac597243058ac1b34eb62ba499d27094000def21772a2f8b33026f6f`.
- Local production build `web/.next`, BUILD_ID `tTc0Z6ZC6rUxm_UM13gqG`; aggregate SHA256 of sorted relative-path/file-hash records `c04fdba3f308079523ca7f79df2944dcc026f6e9b6a8dcc65f0b2a412f3028ab`. Exact build-file identities, screenshot hashes, checks and limits: `docs/agent/evidence/W-008-web-validation.json`. Build hashes identify this local build, not a portable standalone bundle.
- Final source/docs manifest: `docs/agent/manifests/W-008-sources.json`. Native binaries not present; old native checksum records remain historical.

untested_boundaries:
- Actual OS notification permission/delivery, browser download completion, multi-tab stress and deterministic in-flight configuration race not exercised end to end. Pure monitor rejection and notification conditions are tested; code guards are not a browser-race proof.
- No unattended background/closed-page reliability promise, source availability SLA, physical Android run, native regression build or cloud deployment. Shared rule semantics and native sources unchanged, so verification targeted the new web surface.

next_action: from `web/` run `npm run dev` (dependencies installed) or `npm start` (final production build already exists), open loopback port3000, enable monitoring and grant/test browser notifications. For a new checkout use Node22.18+ and `npm ci` first. If closed-page monitoring is desired later, explicitly choose a server scheduler/push architecture; the current web client intentionally relies on an open page.

## W-009 — organize web types, private components and monitoring Hook

status: closed
date: 2026-10-19 (UTC)
last_artifact_verification: 2026-10-19T16:34:51Z
request: improve project structure/readability, separate types and create a `_components` folder; continue the same work after usage-limit interruption
scope: web structure only; preserve API, rule behavior, storage schema, UI markup/styles and current dependency choices

changes:
- Added `web/types/market.ts`, `monitor.ts`, `components.ts` for domain types, explicit Hook contract and component props. Renamed ambiguous Event/Monitor types to MonitorEvent/MonitorState. Type-only imports avoid runtime dependencies from the type layer. No re-export/barrel abstraction introduced.
- Split 949-line `app/dashboard.tsx` into `app/_components/`: dashboard (122 lines), sidebar, market-overview, trend-panel, history-chart, gauge, monitor-settings, event-log, rule-panel, icon. Dashboard owns the single monitoring Hook and composes the page; range, hover, navigation, filter and form state stay with their respective components. Original JSX was extracted with a TypeScript AST script to avoid rewriting large markup manually.
- Moved Hook to `app/_hooks/use-monitor.ts`, extracted existing time/duration presentation helpers into `lib/format.ts`, updated page entry/imports and web README directory map. Removed only the two superseded original source files after writing extracted files. Core parsing/evaluation/HTTP/persistence/scheduling/error handling and test assertions unchanged.
- User's exact dependency version edits in package.json and package-lock.json preserved byte-for-byte relative to session start. CSS unchanged; no new dependency. PROJECT_STATE paths/current artifact references updated.

validation_and_commands:
- Before edits inspected current source, W-008 records, historical VALIDATION, working tree and running Next dev process. Kept pre-refactor source locally under `.tools/refactor-w009/before/`. No Git staging/commit or native rebuild.
- `python .tools/refactor-w009/extract_types.py`: type extraction. Initial helper named types.py shadowed Python stdlib and failed before edits; renamed helper and reran successfully. `npm --prefix web test` PASS30; `npm --prefix web run typecheck` PASS after type extraction.
- `node .tools/refactor-w009/components.mjs`: AST component extraction; typecheck PASS. `node .tools/refactor-w009/compare-render.cjs`: PASS exact before/after server-rendered HTML for empty, active, stale, snoozed, request-failure and storage-failure fixtures. Also PASS emitted runtime JavaScript equality for market, monitor, cnn, tests and moved Hook after removing comments/normalizing moved import paths. CSS/package/lock bytes equal baseline. Synthetic checks perform no browser effects or upstream calls.
- Existing Node suite rerun after component extraction: PASS30 (23 shared CSV cases +7 existing data-flow checks). Assertions unchanged; only type import moved.
- `npm exec --offline --registry=https://registry.npmjs.org --package=prettier@3.6.2 -- prettier --write app/_components app/_hooks app/page.tsx lib types tests/monitor.test.ts`: PASS. Initial offline mirror lookup had ENOTCACHED; official registry cache worked without adding dependencies. A later type-import formatting warning was fixed; final matching `--check` PASS.
- Existing user-owned dev server detected and left running. `python .tools/refactor-w009/prepare_build.py` copied final web/shared sources to `.tools/refactor-w009/build`; workspace-local node_modules junction reused installed dependencies. Sequential `npm run build -- --webpack` and `npm run typecheck` in `.tools/refactor-w009/build/web`: PASS. Final build repeated after syncing last type-import formatting and README. No changes to main next.config, package scripts or running dev output. No fresh install performed.
- Final `node .tools/refactor-w009/compare-render.cjs` PASS; `python tools/check_public_files.py` no findings; `git diff --check` PASS. Existing dev process still running at final inspection.
- `python .tools/refactor-w009/record.py`: byte-verified staged sources against final web/shared files (except Next-generated next-env.d.ts), packaged and verified all 34 ZIP entries, hashed actual final isolated production build. Source snapshot: `python tools/snapshot_sources.py W-009`; final public scan repeated after snapshot.

artifacts:
- `artifacts/FearIndexAlarm-web-source-W-009.zip`, 45896 bytes; SHA256 `1e5baf6610ceb12b658ca362520aa805080cf06b58f90db792f961e3d44b3370`.
- Actual verified build `.tools/refactor-w009/build/web/.next`, BUILD_ID `t9Pa6vpurV30ukbA6izLy`; aggregate SHA256 `ebd0337afca848cf63ce53c7d4a91e112aefcfc93149a064513f2dd98af63d48` over the evidence's sorted relative-path/hash records.
- Immutable evidence `docs/agent/evidence/W-009-web-structure.json`; final source/docs manifest `docs/agent/manifests/W-009-sources.json`. W-008 archive/screenshots/build hashes remain historical, not this refactor's artifact identities.

boundaries_and_next_action:
- No new browser interaction/screenshot/OS notification/live API/native tests; markup equivalence is server-rendering evidence, not browser scheduling proof. Default Turbopack production build and clean dependency install not rerun; isolated Webpack build used the existing installed toolchain. No running user service stopped or browser/native runtime data touched.
- Continue using the existing dev server; future edits go to the responsible component, `_hooks/use-monitor.ts`, `types/` or `lib/`. Before replacing a production build, stop that output's server or use an isolated build. Existing browser-closed and physical Android reliability limits still apply.

## W-010 — tolerate extension-injected body attributes during hydration

status: closed
date: 2026-10-19T16:39:32Z (UTC)
request: resolve the reported hydration attribute mismatch on body (`cz-shortcut-listen="true"`)

changes_and_decisions:
- Source inspection found no application writer for the reported attribute. The Next.js ColorZilla issue report matches this symptom; official hydration documentation lists extension DOM changes as a cause.
- Added `suppressHydrationWarning` and an explanatory comment only to body in `web/app/layout.tsx`. This is an intentional warning escape hatch at that element; it does not remove injected attributes or recursively suppress child mismatches. Disabling the responsible extension on the site removes the external cause.
- Updated PROJECT_STATE. No Hook, Server Action, dependency, runtime data or process changes.

validation_and_commands:
- `npm --prefix web run typecheck`: PASS.
- `git diff --check`: PASS.
- `python tools/snapshot_sources.py W-010`: final source/docs manifest.
- `python tools/check_public_files.py`: final publication-boundary scan.

artifacts_and_boundaries:
- Source-only delivery. `web/app/layout.tsx` SHA256 `863ded09e152e34ec5c7ad8af9e2cba39393c262b9fba0f5999cf6331c72eb86`.
- Evidence: `docs/agent/evidence/W-010-hydration.json`; manifest: `docs/agent/manifests/W-010-sources.json`.
- No production build, ZIP update, live API, browser extension reproduction or native checks. W-009 artifacts remain historical and do not contain this change.
- References: https://nextjs.org/docs/messages/react-hydration-error and https://github.com/vercel/next.js/discussions/72035 .
- Next action: reload the development page; disable ColorZilla for the site to eliminate its DOM injection. Browser confirmation remains outstanding.
