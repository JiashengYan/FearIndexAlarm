# FearIndex Web

独立的 Next.js App Router 网页端：深色响应式仪表盘、指数仪表、7/30/90 天历史曲线、自动检查、间隔设置、休眠、浏览器通知和事件导出。CNN API 统一由 `app/actions.ts` 的 Server Action 调用，浏览器不直接访问 CNN。

## 运行

需要 Node.js 22.18+（包含测试所用的 TypeScript 类型剥离支持）和 npm。从仓库根目录运行：

```powershell
cd web
npm ci
npm run dev
```

打开 http://127.0.0.1:3000。生产模式：

```powershell
npm run build
npm start
```

两个启动命令默认只监听 `127.0.0.1`，不会暴露到局域网。需要常驻检查时，Next.js 进程和浏览器页面都要保持运行；本版没有服务器后台调度器、Service Worker 推送、账户或云同步。未部署到外网。不要用静态导出替代 Next.js 服务，Server Action 需要服务端运行时。

## 使用

- 首次打开自动读取一次行情，但自动监控默认关闭。点击“自动监控”启用并建立有效基准。
- 默认 900 秒，可用预设或输入 60–604800 的整数秒数。保存间隔不会启动已经停止的监控。
- 休眠期间不自动请求，手动刷新仍可查看行情；停止或休眠时不更新规则基准、不触发告警。配置在请求途中改变时，该次结果被丢弃。
- 点击“开启通知”请求浏览器权限并发送明确标识的测试通知；已授权后可再次测试。权限被拒绝或系统阻止弹窗时，告警仍保存在页内事件记录。
- 所有设置、有效基准、最近行情和最近 200 条事件存于当前浏览器的 `localStorage`，键为 `fear-index.web.v1`。不同浏览器、主机名、端口和协议各自独立。不会读取或修改原生应用的运行状态。
- 支持 Web Locks 的浏览器在同源标签页间共享请求锁；无该 API 时仅保证单标签页请求不重叠。多标签页通过 storage 事件刷新状态；不提供多用户事务服务。
- 导出 JSON 包含记录的 UTC ISO 导出时间和事件的 epoch 毫秒时间；UI 时间按浏览器本地时区显示。存储损坏或不可写时停止自动监控并提示，不静默重置；可导出原始记录排查。

## 告警与数据

沿用原生规则：按显示整数四舍五入，`当前值 < 25 && 当前值 < 上次有效值`。首次读数不告警；源数据超过 60 分钟、超过当前时间 5 分钟、时间倒退、重复或冲突均不推进基准。连续三次请求失败显示一次健康提醒，之后成功读取重置计数。图表和比较值只来自 CNN，缺失时明确显示空状态，无模拟实时行情兜底。

新基准和页内告警一起保存后才尝试系统通知。网页端的持久记录是页内事件，系统弹窗为尽力发送，不实现原生端的崩溃后待发通知重试。浏览器可能节流后台计时器；休眠、离线、关闭页面和服务停止会中断检查，恢复时跳过漏掉的周期，不补造读数。浏览器时间不准也会影响源时间校验。历史曲线以源站最后一个历史点为终点展示所选范围，保留实际数据间隙。

服务端固定访问 CNN 公共 HTTPS 地址，20 秒请求超时、2 MB 响应上限、禁用缓存和重定向，无用户可控 URL 和凭据。普通 CNN Referer/Origin/User-Agent 请求头与原生端一致；403/418、结构变化和不可达都会显式报错，保留上次行情。响应含指数与历史序列，不保存到服务器磁盘。启动环境应保持默认 TLS 证书验证。

## 检查

从 `web/` 顺序运行：

```powershell
npm test
npm run build
npm run typecheck
npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org
```

Node 内置测试读取仓库 `shared/rule-cases.csv` 的全部 23 个既有案例，另测时间戳、响应解析、错误/过期处理、本地状态和通知条件。Windows/Kotlin 规则和共享 CSV 未修改，不需要为网页新增功能重建原生应用。生产构建不请求 CNN；浏览器加载后通过 Server Action 请求，便于离线构建。

## 源码

```text
web/
  app/
    page.tsx                  # 页面入口
    actions.ts                # Server Action 边界
    _components/
      dashboard.tsx           # 组合页面、连接监控 Hook
      sidebar.tsx             # 导航及选中状态
      market-overview.tsx     # 指数、数据新鲜度和摘要
      trend-panel.tsx         # 历史范围及比较值
      history-chart.tsx       # 曲线绘制和交互
      gauge.tsx               # 指数仪表
      monitor-settings.tsx    # 监控设置表单及输入状态
      event-log.tsx           # 事件列表及筛选状态
      rule-panel.tsx          # 告警规则说明
      icon.tsx                # SVG 图标
    _hooks/use-monitor.ts     # 调度、持久化、跨标签页锁、通知
    globals.css               # 页面样式与响应式布局
  types/
    market.ts                 # 行情、采样和 API 返回类型
    monitor.ts                # 监控状态、事件、配置和 Hook 接口
    components.ts             # 界面组件 Props
  lib/
    cnn.ts                    # 固定数据源 HTTP 请求
    market.ts                 # 数据解析、校验和规则判断
    monitor.ts                # 本地状态及事件转换
    format.ts                 # 时间、间隔展示格式
  tests/monitor.test.ts        # 共享规则和数据流测试
```

`Dashboard` 是客户端入口，只创建一份 `useMonitor` 实例，将数据和操作传给组件。组件私有的筛选、图表范围和表单状态就近维护。`_components`、`_hooks` 是页面内部目录；类型通过 `import type` 引用，不依赖组件或 Hook 实现。保持显式文件导入，避免无必要的统一转导出层。

实现参考 [Next.js Server Functions 官方文档](https://nextjs.org/docs/app/getting-started/mutating-data)。依赖版本由 `package-lock.json` 固定。
