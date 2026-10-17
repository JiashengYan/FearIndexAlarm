# v0.1 验证记录

日期：2026-10-16。环境：Windows 开发机；尚未在物理 Android 设备或 Android 模拟器上安装运行。

通过的检查：

- Windows/core：34 个检查，包含 23 个共享规则场景、无效数值、CNN JSON 结构/时间戳解析、HTTP 418、成功请求、重启恢复基准与待发提醒、损坏状态检测。
- Android：共享规则场景、无效数值和时间戳单元测试通过。
- 显式联网检查：实际 .NET HttpClient 与 Android 客户端使用的 Java HttpURLConnection 均从 CNN 成功读取了合法指数与源时间戳。Java 检查运行于桌面 JVM，不代表手机网络和后台行为。
- Android lint：`No issues found`。
- Python 日志分析器：2 个检查通过，验证缺失一分钟/失败请求能体现在统计中，以及空日志不能被判为可靠。
- Windows Release self-contained win-x64 发布成功。
- Android debug APK 构建成功，APK v2 签名校验通过；包名 `com.fearindexalarm`，min SDK 26 / target SDK 35。

未验证：Windows 窗口/托盘交互和系统通知的端到端行为、手机安装/界面/通知、厂商系统后台保活、锁屏实际请求间隔、72 小时连续性及额外耗电。没有连接的 USB 调试设备。不能把本记录理解为满足手机硬实时保证。

本次构建产物 SHA-256：

```text
C5243E9F63FFD432C0D04771CA084FEBEAEFD7EE110474A35450002503CE0FD7  FearIndexAlarm-debug.apk
B2C02BFE500D6B29D2A28B7D286290ECAF79CAD019EB9DCD3353C9C48B5FDD7F  FearIndexAlarm-windows-x64.zip
```

Android 请先安装并允许通知、后台活动及电池优化豁免，开启持续监控，锁屏运行后导出日志。使用 `tools/analyze_timing.py` 查看实际请求间隔，不能用“常驻通知还在”替代调度证据。
