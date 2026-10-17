# FearIndexAlarm / 恐慌指数提醒

两个互相独立的本地应用：Android 原生 Kotlin 前台监控服务，Windows 原生 C# 托盘程序。没有账号、服务器、同步、网页渲染器或运行时脚本引擎。新增任务修改源码并重新编译。

## 使用构建产物

- Android：侧载 `artifacts/FearIndexAlarm-debug.apk`。这是调试签名的验证版本；日常长期使用前应改用自己保存的 release 签名。
- Windows 11 x64：解压 `artifacts/FearIndexAlarm-windows-x64.zip`，运行其中的 `FearIndexAlarm.exe`。保留同目录 DLL；发布目录包含自带运行时，无需自行安装 .NET。关闭窗口只隐藏到托盘；托盘菜单“退出”才完全停止。
- 两端首次启动都需要点击“开始 / 立即检查”。不会偷偷修改开机启动项、手机电源设置或系统睡眠策略。

## 内置 CNN 任务

默认每 **15 分钟（900 秒）**请求一次 `https://production.dataviz.cnn.io/index/fearandgreed/graphdata`，读取 `fear_and_greed.score` 与 `fear_and_greed.timestamp`。通过普通 HTTP 请求获取 JSON，不打开浏览器。请求头按 CNN 页面来源设置；该站点接口没有稳定性承诺，可能返回 403/418、限流、改变结构或停止提供数据。

默认值用于首次使用或没有保存间隔的任务。升级会保留已保存的间隔；已有任务如需切换到 15 分钟，请在界面输入 `900` 秒并保存。

2026-10-16 在开发机联网验证过这个响应结构和普通网页请求头可用。此记录不代表手机网络、未来访问或每次请求均可用。

规则以**显示整数（四舍五入，0.5 向上）**为比较精度：

```text
显示整数 < 25，并且显示整数 < 上一次有效值的显示整数 → 提醒
```

26→24、24→23 提醒；23→24 不提醒；反弹后的 24→23 再次提醒。首次读取只建立基准。24.5 显示为 25，不进入提醒区；24.49 显示为 24。显示整数不变的小数波动不提醒。若需要原始数值每次下降也提醒，修改两端 `MonitorRules`，同时更新共享用例。

- 源时间戳早于已保存记录、同一时间戳冲突、数值不在 0–100、NaN 和超前超过 5 分钟均不更新基准。
- 源数据超过 60 分钟未更新时不触发提醒。休市、周末可能出现这个状态；每分钟请求不意味着 CNN 每分钟产生新数据。
- 网络失败保留“上次有效值”，同时显示错误；不会冒充新的实时值。连续三次请求失败发一次异常通知，成功后重新计数。
- 新基准和待发提醒一起落盘；发送后确认。崩溃恢复时补发待发提醒。系统通知没有可靠的送达回执；极小的崩溃窗口可能重发，系统静音/免打扰可能抑制弹出或声音。
- 任务可启用/暂停、休眠一小时、结束休眠，执行间隔可设 60–604800 秒（一天是 86400）。编辑间隔不会自动启动已经停止的监控。

## Android 实测前设置

1. 安装 APK，允许通知；点击“允许精确闹钟和提醒”，在系统设置中授权，然后点击开始，确认出现持续监控通知及下次计划时间。
2. 在系统设置中允许本应用后台活动、自启动，并设为不进行电池优化。界面提供电池优化及应用设置入口，具体名称和入口以设备实际系统为准。
3. 若系统提供睡眠待机优化、后台耗电自动优化、最近任务锁定等选项，按实际设备确认它们对本应用的影响。不要假定最近任务锁定等于允许后台 CPU/联网。
4. 默认采用 Alarm 按需唤醒：`ELAPSED_REALTIME_WAKEUP` + 一次性 `setExactAndAllowWhileIdle`，每轮完成后重新安排最近任务。无精确闹钟权限或授权竞争失败时回退 `setAndAllowWhileIdle`，界面明确标记“非精确 Alarm”。默认不在等待期间持有 CPU 唤醒锁，也不再每分钟写心跳。服务启动交接锁最多 30 秒；每次执行锁最多 120 秒，正常结束立即释放。常驻前台服务和通知保留，用于用户已开启的持续监控及停止入口。
5. “连续唤醒模式”是手动选项，默认关闭；从旧版升级也默认切换 Alarm，任务间隔和基准保留。开启后仍有三分钟唤醒锁租期与最多一分钟的续期循环；所有任务暂停或休眠时释放连续锁。此模式会增加耗电，也不能绕过所有系统限制。
6. 不要手动强制停止应用或在 Android 活动应用管理中停止服务。手机重启、重新安装及系统强制停止后，重新打开并启动监控。本版不申请开机自启广播权限。精确闹钟权限被撤销时，系统可能杀进程并删除精确闹钟；请重新打开应用恢复非精确调度，不能保证撤销瞬间自动回退。

前台服务声明为 `specialUse`，Manifest 说明“用户开启的持续本地阈值监控”，并有常驻通知与停止按钮。它不等于系统豁免或 Google Play 审核通过；未来上架或系统更新时需要重新核实适用性。不使用服务器推送、WorkManager 或 `setAlarmClock`。精确闹钟申请用户授权的 `SCHEDULE_EXACT_ALARM`，不申请受限的 `USE_EXACT_ALARM`。

**Alarm 不保证一分钟频率或绝对准时。** Android 在深度休眠中对 allow-while-idle Alarm 有限频，官方说明可能拉长到约 15 分钟甚至更多；无精确权限的回退模式允许更大延迟。唤醒不代表网络一定可用，因此仍需电池优化豁免和实测。若非精确 Alarm 在进程死亡后被系统拒绝启动前台服务，界面记录原因并留待下一周期重试；打开应用可恢复，不伪造成功请求。

调度到期时间使用含睡眠的单调时钟，持久保存并按系统启动计数区分重启。进程恢复保留原计划，延迟执行跳过漏掉的周期；主动“立即检查”会重新建立周期。配置修改只重新安排相关任务，不强迫所有任务联网。暂停全部任务或停止监控会取消 Alarm；休眠任务只安排到休眠结束。

**尚未在物理 Android 设备上验证后台连续性。普通 APK 无法对强制停止、系统杀进程、关机、网络/源站不可用作硬实时保证。** `START_STICKY` 只请求系统恢复，并非承诺恢复时间。若实测出现不可接受的长间隔，需要改变设备控制条件或运行方式，不能用“保活成功”的界面文字代替证据。

Android 官方参考：[AlarmManager API 与休眠限频](https://developer.android.com/reference/android/app/AlarmManager#setExactAndAllowWhileIdle(int,long,android.app.PendingIntent))、[精确闹钟授权](https://developer.android.com/develop/background-work/services/alarms)、[Doze 与电源豁免](https://developer.android.com/training/monitoring-device-state/doze-standby)、[后台前台服务启动限制](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start)。

## 验证后台执行频率

先连续运行 72 小时，包括至少三晚锁屏、不充电、Wi-Fi/移动网络切换、普通清理最近任务等情形。不要用关闭屏幕前后的两个截图判断连续性。

应用可导出 JSONL 执行日志，记录计划时间、实际发起时间、系统单调时钟、耗时和结果。Android 最多保留最近 12000 条；Windows 日志超过 4 MB 时保留当前与前一份。每次到期只发一个请求，不重叠请求，也不在睡醒后补发几百次旧请求。网络失败仍保持所设检查周期，以便尽快恢复；没有自动改成更慢的退避周期。

```powershell
python .\tools\analyze_timing.py .\fear-index-attempts.jsonl --expected-seconds 900
```

查看实际请求间隔、最大值、P99、超过预期周期 1.5 倍的间隔、计划延迟和失败次数。上例适用于 15 分钟默认周期；手动改为一分钟时请使用 `--expected-seconds 60`。主动暂停/休眠/更改间隔会进入时间间隔统计，应标注测试时段；时钟校正可能影响墙钟间隔。两端在关机、睡眠或进程死亡期间没有能力自行记录请求，恢复后的时间间隔会暴露中断，但不能重建漏掉的指数变化。

Windows 不主动阻止睡眠；系统必须清醒、用户会话仍存在才能执行。锁屏通常不影响清醒会话，注销和睡眠会影响。

## 构建与检查

工具下载到项目 `.tools/`，不修改系统 PATH。需要联网下载官方工具与依赖，安装 Android SDK 时需接受其许可证。

```powershell
.\bootstrap.ps1
.\test.ps1
.\build.ps1
# 或只构建单端
.\build.ps1 -Target Android
.\build.ps1 -Target Windows
```

基线版本：Android compile/target SDK 35、min SDK 26、AGP 8.9.2、Gradle 8.11.1、Kotlin 2.1.20、JDK 17；Windows .NET 10，发布为 win-x64 self-contained。Windows 使用系统托盘通知，无额外第三方运行依赖；Android 运行时只使用系统 API 与 Kotlin 标准库。

构建和测试会共用 Android 编译缓存，请按上面的顺序运行，不要同时启动两份 Gradle 构建。若旧缓存损坏，可用 `test.ps1 -CleanAndroid` 清理本项目的 Android 构建输出后检查。

`test.ps1` 运行共享规则用例、HTTP 拒绝/解析/重启状态测试、Android 单元测试与 lint。默认检查不访问真实 CNN，不发通知，也不证明后台调度可靠性。`test.ps1 -LiveProbe` 会额外以实际 .NET HttpClient 和 Java HttpURLConnection 客户端读取真实 CNN；它仍然运行在开发机，不等于手机联网验证。`bootstrap.ps1 -ProbeOnly` 可单独用 PowerShell 检查接口。

## 源码位置

```text
android/app/src/main/java/com/fearindexalarm/
  MonitorRules.kt        源码任务目录与纯规则
  CnnClient.kt           HTTP 请求与数据提取
  MonitorService.kt      原生前台服务、单调时钟调度、通知
  MonitorAlarm.kt        一次性唤醒、精确权限回退、服务启动交接
  MonitorSchedule.kt     可在 JVM 测试的周期与授权竞争处理
  StateStore.kt          本地状态与执行日志
  MainActivity.kt        简单任务列表与系统设置入口
windows/
  FearIndexAlarm.Core/   数据源、规则、调度、本地状态
  FearIndexAlarm/        Windows 原生窗口与托盘
  FearIndexAlarm.Tests/  无第三方测试框架的检查程序
shared/                 两端共用的规则用例与 CNN 结构样例
tools/analyze_timing.py  执行间隔分析
```

新增任务时，在两端 `TaskCatalog` 增加定义，在各自客户端增加专用提取代码；复杂规则写独立函数并补共享样例。界面自动列出目录中的任务，设备之间不共享状态。暂不支持每日固定当地时间/日历调度，86400 秒表示每隔一天。

本地状态位置：Android 应用私有存储；Windows `%LOCALAPPDATA%\FearIndexAlarm`。导出日志包含任务名、执行时间和错误信息，不含账号凭据。

## Windows 数值与时间显示

指数以 52pt 加粗字体独立显示：低于 25 为红色，25–44 橙色、45–55 灰蓝、56–74 青色、75 及以上绿色。这些颜色用于界面分区，不改变提醒规则。超过一小时的源数据改为灰色并标明“上次有效指数”；读取失败保留上次有效值并标明错误。

- **CNN 数据时间**：API 的 `fear_and_greed.timestamp`，按本机时区转换，包含 UTC 偏移。它是数据源给该指数记录的时间戳，不是本机请求时间；无法仅凭此字段确定每个底层行情的实际成交时间。
- **本机最近成功获取**：最近一次 HTTP 成功且解析成功的本机时间，即使 CNN 数值/时间戳没变也会更新。
- **距 CNN 数据时间**：本机当前时间减源时间戳，随界面刷新而更新。这个时间差依赖本机时钟正确，包含数据在获取前已有的年龄。

2026-10-16 20:45:20 UTC 直接请求接口时，返回的源时间是 20:27:55 UTC，约早 17 分 25 秒；本次 HTTP 耗时 161ms，响应 `Age: 110`，`X-Cache: HIT, HIT`。一次额外的 no-cache 重新验证请求返回相同记录。这证明当次取得的上游记录已经较旧，缓存可能解释其中一部分，但不能证明 CNN 固定延迟 20 分钟，也不能精确拆分行情、计算、发布和多层缓存各自的时间。增加本机轮询频率无法让源站尚未提供的新记录出现。

开发诊断可运行 `tools/probe_cnn_timing.ps1`（两次显式联网请求）查看源字段、HTTP 服务器时间和缓存头；隔离 UI 预览用 `tools/render_windows_preview.ps1`，它只使用演示状态，不启动抓取或发送通知。

## 公开源码前检查

`AGENTS.md`、`WORKLOG.md`、`docs/agent/PROJECT_STATE.md` 是公开的项目交接记录，构建和运行不依赖它们。可选的本机私人上下文只保存在 `agent.md`（单数），已经被 `.gitignore` 和源码快照工具排除；其他人不需要该文件。公开路径仅使用项目相对路径或通用环境变量，证据时间使用 UTC。W-007 按作者要求对历史记录做了隐私脱敏，原有源码清单描述的是脱敏前快照，并非当前文档校验依据。

首次提交以及以后每次添加文件前运行：

```powershell
python tools/check_public_files.py --list
```

脚本使用 Git 的实际忽略规则选择文件，未初始化仓库时也能检查，不会初始化、暂存或修改主项目的 Git 状态。发现私人文件、常见凭据模式或本机上下文标记时会报出文件和行号，不输出敏感原文。这是启发式检查，不覆盖全部凭据类型、Git 历史、已暂存文件的旧内容或手动上传的二进制包。提交时另外使用公开昵称和 GitHub noreply 邮箱，避免作者元数据泄露。

`.tools/`、`artifacts/`、缓存、签名密钥、日志和运行状态均属于本地内容，不要手动将整个工作目录打包公开。需要分发二进制时应独立检查发布包；旧 PDB、编译缓存可能含本机路径。当前 Git 忽略规则不会删除已经追踪的文件，检查脚本仍会检查这些文件。
