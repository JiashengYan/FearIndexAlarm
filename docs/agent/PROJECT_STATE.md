# PROJECT_STATE

updated: 2026-10-17
latest_worklog: W-007 (closed; public-source privacy redaction and local-only owner context)
purpose: agent resume context; not end-user documentation
root: .
version_control_at_last_inspection: no .git repository; do not infer commits from worklog IDs

## Accepted scope

- Local numeric-indicator monitoring, initially CNN Fear & Greed. User values small runtime/system burden; after discussing CNN delay/polling tradeoffs, user explicitly chose a 15-minute default for this task (W-004). Minute-scale checks remain manually configurable.
- Windows 11 x64 and Android independently fetch, evaluate, store state and notify. No shared task list, synchronization, server, remote runner, account or collaborative operation.
- New task definitions/provider extraction/complex rules may be edited in PC source then recompiled; a generic runtime task editor or script/plugin engine is unnecessary.
- Runtime controls: enable/disable, interval (60..604800 seconds, CNN default 900), snooze one hour/resume, start/stop/force check, log export. 86400 seconds is an interval, not local wall-clock calendar scheduling. Existing saved intervals are preserved; default changes do not migrate or overwrite them.
- Android target: API 26+ device, APK sideloading permitted; exact device/system details are local-only. User considers background polling frequency critical. Actual reliability has NOT been proven on a physical device.
- Latest development change: prioritize AlarmManager for Android battery optimization, after choosing the 15-minute default. W-005 changes only Android scheduling/UI/permissions/version and docs, not Windows, CNN extraction or rule semantics. Saved task intervals/baselines remain intact; old default continuous-awake preference is intentionally superseded by a new opt-in key (default false).
- Latest request W-007: strip owner-identifying information before publication; optional local-only context is in Git-ignored agent.md. Public AGENTS/worklog/current state/evidence remain available, with owner paths replaced by project-relative paths, device references generalized, historical timestamps converted to UTC, and redundant source_local field removed from timing evidence/diagnostic. This explicit user request authorizes privacy-only edits to closed historical text/evidence. Historical source manifests describe pre-redaction snapshots and are not claimed to match current docs. W-007 is the fresh source snapshot.
- Privacy tooling: tools/check_public_files.py uses Git's actual repository ignore rules (including tracked files), reports locations without secret values, and does not initialize/stage the main checkout. It is heuristic, scans worktree content, and does not certify staged blobs/history/author metadata/release archives. Source snapshot generation now honors Git-selected files and always excludes singular agent.md. Public handoff/build/runtime do not require private context.
- Prior cleanup W-006: canonical executable is only artifacts/windows/FearIndexAlarm.exe (W-004); keep matching Windows ZIP and latest Android APK. Older/duplicate Windows directories and generated previews removed. Windows artifacts remain unchanged by W-007; Android v0.2.1 is rebuilt only for generic UI text/version.

## Current implementation / map

Windows:
- `windows/FearIndexAlarm.Core/`: net10.0 C# rule/data/state/monitor library, reusable HttpClient, monotonic scheduling, JSON state + rotating JSONL logs.
- `windows/FearIndexAlarm/`: net10.0-windows WinForms executable, native tray + simple window. Closing window hides it; tray Exit stops monitoring and terminates. Single instance uses `Local\\FearIndexAlarm` mutex. No Windows Service/autostart installer/sleep inhibition.
- `Program.cs` marshals engine notification events onto UI via dispatcher; `MainForm.cs` owns task controls and visible-only refresh timer.
- MainForm now has per-task value cards: 52pt bold Segoe UI digits, value-band colors (<25 red, 25..44 amber, 45..55 slate, 56..74 teal, >=75 green). Stale >1h values turn gray and are explicitly historical; failed reads are labeled. Separate CNN source timestamp, local last-success time, and source age; absolute timestamps include local UTC offset. Per-task cards and text resize to the viewport; guarded relayout clears stale WinForms horizontal scroll extents. No fetch/rule/state schema changes.
- Windows icon: `Assets/stock-alert.ico` is both PE `ApplicationIcon` and embedded resource `FearIndexAlarm.StockAlert.ico`; `AppIcon.Load` clones stream-backed icons. ApplicationContext owns/disposes 16px tray and 32px form icons. No loose icon file required at runtime.
- `tools/generate_windows_icon.py` (Pillow) is the single vector-scene source for SVG/PNG/ICO, sizes 16/20/24/32/40/48/64/128/256. Generated source assets are checked-in candidates; preview is generated under `artifacts/`. Python/Pillow is only needed to regenerate the icon, not to build/run the app.
- `windows/FearIndexAlarm.Tests/`: console assertion harness (no external test framework); baseline 34 checks. `--live` explicitly probes actual CNN via .NET client.

Android:
- `android/app/src/main/java/com/fearindexalarm/MonitorRules.kt`: pure rule implementation + source-coded catalog.
- `CnnClient.kt`: HttpURLConnection + JSONObject, bounded response, 10s connect/read timeouts. No browser/WebView.
- `MonitorService.kt`: native `specialUse` ongoing user-started monitoring service, persistent stop notification, serial HandlerThread execution, `START_STICKY` best-effort recovery. Default idle scheduling is Alarm-only: no minute heartbeat/notification writes or idle CPU lock. Reserves and arms the next slot before HTTP, persists elapsed deadlines, preserves phase and skips missed slots rather than catching up. Reconfiguration preserves unrelated task deadlines; Check Now resets all task phases. BOOT_COUNT invalidates previous-boot elapsed deadlines. One 120s maximum execution wake lock per service command, released in finally or onDestroy; receiver->service handoff lock <=30s. These lock leases do not establish an absolute HTTP completion deadline.
- `MonitorAlarm.kt`: one immutable explicit broadcast PendingIntent; `ELAPSED_REALTIME_WAKEUP` + one-shot `setExactAndAllowWhileIdle` when allowed, else `setAndAllowWhileIdle`. Uses user-granted SCHEDULE_EXACT_ALARM (not USE_EXACT_ALARM). Catches a revoke-between-check-and-set SecurityException. Final enabled/running check and scheduling/cancellation serialized against Stop. Receiver performs no HTTP; starts the existing foreground service or requests recovery, records refused background-FGS startup and schedules a later Alarm retry. Inexact alarms do not themselves grant the exact-alarm FGS-start exemption; after process death user may have to reopen the app. No WorkManager/JobScheduler/cloud/AlarmClock workaround.
- `MonitorSchedule.kt`: pure elapsed deadline/phase and permission-race selection helpers; 7 JVM tests. Android 0.2.1 versionCode=3 (W-007 generic UI wording only; scheduling remains W-005). UI shows exact permission, scheduler status, next planned check, overdue warning, and execution history; removes the old 2-minute-heartbeat health assumption. Gap summary uses current interval*1.5 and labels historical-setting/pause limitations.
- Continuous-awake mode remains a manual option, NEW preference continuous_awake_opt_in=false (old reliable key ignored). Only enabled non-snoozed tasks can retain the 180s lock, renewed on <=60s ticks. Alarm remains a backup. Disabling/snoozing all tasks releases continuous lock; all disabled/Stop cancels Alarm, all snoozed arms only earliest resume. Requires physical power-management configuration; no battery or timing guarantee.
- Permission grant broadcast and Activity onResume reschedule without forcing HTTP before due. Revoking exact permission can kill the process/cancel alarms: cannot guarantee automatic inexact recovery at revocation time; reopen app. Even exact allow-while-idle alarms are throttled during deep idle (API docs mention ~15min or longer); minute intervals remain configurable but cannot be promised. Alarm wakeup is not proof of network access; battery exemption still matters.
- `StateStore.kt`: SharedPreferences baseline/config/pending notification; SQLite rolling 12000-attempt log. `MainActivity.kt`: native UI, notification permission request, manual system-settings links, export via document picker.
- No boot receiver. After reboot/force stop/reinstall user must open and start. Explicit user stop must not silently restart.

Shared/tooling:
- `shared/rule-cases.csv`: 23 shared behavior cases. `shared/cnn-response.json`: synthetic reduced structure using an observed public response, never used as runtime fallback.
- `tools/analyze_timing.py`: stdlib JSONL statistics (gap median/P99/max, gaps >1.5x expected, schedule delay, errors). Wall-clock gaps include manual pauses/snoozes/clock changes; no missing samples are inferred.
- `tools/test_analyze_timing.py`: 2 tests; not currently invoked by `test.ps1`, run explicitly.
- `tools/probe_cnn_timing.ps1`: opt-in direct two-request timing diagnostic, default vs Cache-Control:no-cache; prints source fields, receive/HTTP Date, Age/cache headers; W-007 removes developer-local source_local output. Optional OutputPath refuses overwrite. `tools/render_windows_preview.ps1` + `tools/windows-preview/`: developer-only WinForms visual QA through actual MainForm with isolated synthetic state, offscreen window, no fetch/notifications. Validates no horizontal scroll after narrowing. Preview output under artifacts/windows-gui-preview was deleted in W-006; regenerate when needed, never treat rendered sample data as live evidence.
- `README.md`: human instructions. `VALIDATION.md`: historical v0.1 evidence. `WORKLOG.md`, this file, and `AGENTS.md`: durable agent context.

## Behavior invariants / data semantics

Endpoint: `https://production.dataviz.cnn.io/index/fearandgreed/graphdata`
Fields: `fear_and_greed.score`, `.timestamp` (ISO offset date or seconds/ms epoch supported).
Plain PowerShell request initially returned HTTP 418. Both actual .NET HttpClient and Java HttpURLConnection succeeded on developer PC after setting ordinary browser UA + CNN page Referer/Origin + Accept JSON. These headers are currently fixed in both clients; source may break or reject a different network. No evasion/browser fallback is implemented.

Source-time investigation W-003: at receive 2026-10-16T20:45:20Z, body timestamp was 20:27:55Z, difference 1045.5s; request 161ms; HTTP Date current; Age=110; Cache-Control=max-age=5; X-Cache=HIT,HIT. Immediate no-cache request returned same score/timestamp/cache age. Evidence docs/agent/evidence/W-003-cnn-timing.json. Conclude the observed record is already old on receipt, not a local 20-minute sleep/timezone manipulation. Cannot infer a fixed CNN delay/SLA or precisely allocate upstream vs cache delays. Do not fabricate a corrected/current timestamp or assert market-quote delay equals index delay. The freshness guard remains 60 minutes.

Rule **currently compares displayed integer**, round HALF_UP / AwayFromZero for nonnegative scores:
`display(current) < 25 && display(current) < display(previous accepted sample)`.
- First accepted reading establishes baseline, no alert.
- Any downward step in eligible range alerts, including a decline after a rebound. Not a running-low watermark.
- Decimal changes with same displayed integer do not alert. 24.5=>25 no alert zone; 24.49=>24 eligible. This precision was stated in the accepted implementation plan; ask only if user requests changing semantics.
- Reject nonfinite/outside 0..100/missing timestamp, source >5 minutes ahead, age >60 minutes, backward timestamp, equal timestamp (unchanged vs conflict status distinguished). Do not update baseline on rejection or HTTP failure.
- Source may not update off-hours/weekends; polling cadence != market-data freshness. Old source data is visible as a status and excluded from decisions.
- Persist new baseline + pending alert together before notification; clear pending only after OS notification API accepts it. Process-crash recovery can resend; no actual display/sound/delivery ACK exists. Notification policy/DND can suppress display.
- Three consecutive request errors produce one health notification, reset after success. No automatic frequency backoff; user prioritizes recovery cadence.
- One request at a time per engine, skip missed periods instead of burst catch-up. Recheck user stop/disable/snooze after HTTP before accepting/notifying.

## Toolchain / commands (PowerShell from repo root)

Preinstalled tools: Python 3.13 + Pillow, git, node. System dotnet has runtimes but no SDK. Local toolchain installed via approved `bootstrap.ps1`:
- `.tools/dotnet/dotnet.exe` SDK 10.0.402 (bootstrap uses channel 10.0; fresh install can differ).
- `.tools/jdk` JDK 17, Gradle 8.11.1, Android SDK 35 / build-tools 35.0.0 / platform-tools.
- AGP 8.9.2, Kotlin 2.1.20, compile/target 35, min 26. Test-only JUnit 4.13.2 and org.json 20240303. No AndroidX runtime dependencies.
- Project scripts set JAVA_HOME / ANDROID_HOME / GRADLE_USER_HOME / DOTNET_CLI_HOME / NUGET_PACKAGES to project-local locations. NuGet.Config + Directory.Build.props isolate NuGet restore configuration.

```powershell
.\bootstrap.ps1                    # downloads toolchain; accepts SDK licenses, requires network permission
.\bootstrap.ps1 -ProbeOnly         # explicit developer-PC CNN request
.\test.ps1 -SkipAndroid            # Windows/core only
.\test.ps1                        # Windows/core + Android unit tests/lint; no live network by default
.\test.ps1 -LiveProbe               # opts into .NET + desktop JVM real endpoint probes
.\test.ps1 -CleanAndroid            # recovery for corrupted Kotlin build caches
python -m unittest discover -s tools -p test_*.py
.\build.ps1 -Target Windows
.\build.ps1 -Target Windows -WindowsOutputDirectory windows-icon  # running old output may be locked
.\build.ps1 -Target Windows -WindowsOutputDirectory windows-gui   # W-003 staging
.\build.ps1 -Target Android
python tools/generate_windows_icon.py
python tools/snapshot_sources.py W-002
.\tools\probe_cnn_timing.ps1        # explicit network diagnostic; permission may be needed
.\tools\render_windows_preview.ps1  # isolated developer UI render; no real state/network
python tools/analyze_timing.py path-to-export.jsonl --expected-seconds 60
```

Network/sandbox permissions can differ across sessions. Previous build/test/bootstrap prefixes were approved; re-check current permissions instead of assuming external access. Do not install system-wide SDKs or alter PATH.

## Artifacts / runtime data

- Android `artifacts/FearIndexAlarm-debug.apk`, package com.fearindexalarm, debug-signed validation build. Release signing/key lifecycle not implemented.
- W-007 latest Android: versionName 0.2.1 / versionCode 3, APK SHA256 `67F6DA09532F8ABACBBF969C3C970ECAFE109629E07349B53A8430FD5681B75B`. Evidence `docs/agent/evidence/W-007-publication.json`; source snapshot `docs/agent/manifests/W-007-sources.json`. W-005 APK hash is historical. Windows artifacts unchanged at W-004.
- Windows current delivery remains W-004, default 900s: canonical executable `artifacts/windows/FearIndexAlarm.exe`; matching distribution `artifacts/FearIndexAlarm-windows-x64.zip`. ZIP SHA256 `AA19575DCFDEC07B6E23C13ED89B760DB1A0F0AB3A987532BBB9FAC73F38EDB7`; EXE SHA256 `E78B1AA32AFBE63BEAED297A4BB9F1DA7B4D8DD98056651D351790713B1CF1E2`. All three files (EXE and two PDBs) in windows-15min matched windows before cleanup; ZIP's EXE matched too. Upgrading preserves saved frequency; existing tasks may require entering 900 in GUI.
- W-006 removed `artifacts/windows-15min`, `windows-gui`, `windows-icon`, `windows-gui-preview`, `stock-alert-exe-icon.png`, `stock-alert-preview.png`, total 349182738 bytes. Historical paths in W-002..W-005 are no longer all present. Source assets, scripts, immutable evidence/manifests/worklog retained. Remaining artifacts top-level: windows/, FearIndexAlarm-windows-x64.zip, FearIndexAlarm-debug.apk. Evidence `docs/agent/evidence/W-006-cleanup.json`. Process inspection: CIM denied, Get-Process succeeded with no active FearIndexAlarm processes. No process stopped or user state modified. Regenerate preview/build outputs if needed.
- Runtime Windows `%LOCALAPPDATA%/FearIndexAlarm/state.json`, attempts.jsonl + attempts.previous.jsonl (>4MB rotation). Corrupt state fails visibly instead of silently dropping baseline.
- Runtime Android app-private prefs/SQLite. No runtime data should be copied into source history.
- At W-002 start old `artifacts/windows/FearIndexAlarm.exe` was running (observed PID 16252; transient, rediscover). That does not prove its monitoring/notifications work. New builds do not update a running process or Explorer's cached icon.

## Evidence boundaries / next resume

Proven at v0.1: both builds; Windows 34 assertions; Android rule/timestamp tests; Android lint clean; Python 2 tests; real CNN access from .NET and desktop JVM; APK v2 signature valid.
Latest icon evidence: W-002, `docs/agent/evidence/W-002-validation.json` and `W-002-output-copy.json`. Windows 34 checks and Release publish passed; extracted compiled EXE icon visually inspected; embedded runtime ICO hash matches source; ZIP contains the freshly built EXE; PNG/ICO sizes visually checked including 16px. New ZIP SHA-256: `099C0DA47FB847403ACDACECF5283E14406308199EC49B841059B3447498B6FE`. Android APK unchanged. Source manifest: `docs/agent/manifests/W-002-sources.json`.
Latest UI/timing evidence: W-003, `docs/agent/evidence/W-003-validation.json`, W-003-cnn-timing.json and `docs/agent/manifests/W-003-sources.json`. Final Windows 34 checks/publish/package-byte comparison passed. Actual MainForm offscreen synthetic renders visually checked for red/green/stale/empty and narrow resize; no phantom horizontal scroll after the fix. Layout previews do not imply a running production monitor or a real notification test. W-003 ZIP supersedes W-002's historical hash above.
Latest default-change evidence: W-004, `docs/agent/evidence/W-004-validation.json`, `docs/agent/manifests/W-004-sources.json`. Both built-in defaults + Windows missing-field initializer=900s; no persisted interval migration. Windows 34 checks, Android existing unit tests/lint, both builds, APK signature and final ZIP/EXE comparison passed. No new live API or physical-device tests for that constant-only change. W-005 supersedes its unchanged Android wake behavior and legacy 90s UI gap counter. README timing-analysis example uses `--expected-seconds 900`; manually selected minute tests can still use 60.
NOT proven: Windows task-control/tray end-to-end interaction/system notification display; physical Android device installation/UI/permissions/screen-off cadence; 72-hour reliability; incremental battery drain; source availability outside developer network.

Latest Android scheduling evidence W-005: final `test.ps1` PASS Windows 34 checks + Android 10 JVM tests passed (7 new scheduler/permission tests, 3 existing rule/parser tests), 1 opt-in live test skipped; lint `No issues found.` Final `build.ps1 -Target Android` PASS; APK signature v2 verified, packaged version/permission/receiver inspected by aapt, copied delivery APK identical to build output. `adb devices` empty. No emulator/physical runtime, exact permission UI interaction, actual OS alarm/cancellation delivery, CPU lock measurement or battery test. Do not reinterpret the pure helper tests as Android integration tests. Android docs revalidated 2026-10-16 (AlarmManager, scheduling permission, Doze, background FGS launch restrictions; links in README).

Latest privacy/UI-only evidence W-007: test.ps1 PASS Windows 34 + Android existing 10 passed/1 optional live skipped, lint clean; Android debug build/signature/version verified. Python 6 tests passed (2 existing timing tests + 4 publication boundary tests). Publication tests exercise actual Git ignores, force-tracked private-file detection, no sensitive values echoed, no main-repo init, and exclusion of agent.md/custom-ignored configuration from source manifests. Diagnostic PowerShell parsed without network. Git-selected public files have no scanner findings; known-private-marker scan of unpacked APK entries clean. No full binary audit or history audit; tool/cache/PDB/runtime files remain local and ignored. Commit author metadata is not changed and must be configured with a public alias/noreply before the first commit.

Highest-priority next work if user continues monitoring development:
1. Install APK on user's Android device (ADB only after device is actually connected/authorized; no physical device was available at initial delivery).
2. Verify notification permission, background activity/autostart, battery optimization exemption on the actual vendor Android build. Manual settings; do not claim foreground service alone guarantees scheduling.
3. Run 72h screen-off/mobile/Wi-Fi/overnight test; export log and distinguish intentional pauses from missed execution. Test real local notification decisions with an isolated deterministic test provider if needed, never fake production CNN readings.
4. Validate Alarm-first mode: grant/deny exact permission, revoke/reopen/grant, disable all, snooze/resume, Stop during HTTP, process kill (not force-stop), clock/time-zone change and reboot/manual resume. Measure idle execution gaps and incremental battery drain vs continuous-awake mode with matched network/device conditions. JVM tests do not verify Alarm delivery, service transitions, cancellation races, wakelock release or notifications on Android. Persisted source freshness and unavailable-data status remain essential.
5. Release signing, autostart and calendar-time schedules are future work only when requested.
