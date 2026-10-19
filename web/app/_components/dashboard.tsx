"use client";
import { startTransition } from "react";
import { useMonitor } from "../_hooks/use-monitor";
import { formatTime } from "../../lib/format";
import { Icon } from "./icon";
import { Sidebar } from "./sidebar";
import { MarketOverview } from "./market-overview";
import { MonitorSettings } from "./monitor-settings";
import { RulePanel } from "./rule-panel";
import { EventLog } from "./event-log";

export default function Dashboard() {
  const monitor = useMonitor();
  const { state, ready, busy, now, storageError, notice } = monitor;
  const alertCount = state.events.filter(
    (event) => event.kind === "alert",
  ).length;
  const disabled = !ready || !!storageError;
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        跳至主要内容
      </a>
      <Sidebar alertCount={alertCount} />

      <div className="main-shell">
        <header className="topbar">
          <div>
            <span className="breadcrumb">工作台</span>
            <span className="slash">/</span>市场概览
          </div>
          <div className="topbar-right">
            <span className="local-badge">
              <span className="dot" />
              浏览器本地状态
            </span>
            <a className="icon-button" href="#settings" aria-label="通知设置">
              <Icon name="bell" />
            </a>
            <span className="profile">FI</span>
          </div>
        </header>
        <main id="main">
          <section id="overview" className="page-intro">
            <div>
              <div className="eyebrow">
                <span /> MARKET PULSE
              </div>
              <h1>
                读懂情绪，静候信号<span>。</span>
              </h1>
              <p>追踪市场的恐惧与贪婪，把每一次情绪变化尽收眼底。</p>
            </div>
            <button
              className="button secondary refresh-button"
              disabled={busy || disabled}
              onClick={() =>
                startTransition(() => {
                  void monitor.check(true);
                })
              }
            >
              <span className={busy ? "spin" : ""}>
                <Icon name="refresh" size={16} />
              </span>
              {busy ? "正在读取…" : "立即刷新"}
            </button>
          </section>

          {(storageError || state.error) && (
            <div className="error-banner" role="alert">
              <Icon name="shield" size={19} />
              <span>{storageError || state.error}</span>
              {storageError && (
                <button onClick={monitor.exportEvents}>导出原记录</button>
              )}
            </div>
          )}
          <div className="dashboard-grid">
            <MarketOverview state={state} now={now} alertCount={alertCount} />

            <MonitorSettings monitor={monitor} />

            <RulePanel />

            <EventLog
              events={state.events}
              alertCount={alertCount}
              onExport={monitor.exportEvents}
            />
          </div>
          <footer>
            <span>
              <span className="footer-logo">
                <Icon name="pulse" size={15} />
              </span>
              FearIndex <span className="footer-separator">/</span>{" "}
              保持觉察，独立判断。
            </span>
            <span>
              读取时间{" "}
              {state.market ? formatTime(state.market.receivedAt) : "—"}{" "}
              <span className="footer-separator">·</span> 数据仅供参考
            </span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <span>
            <Icon name="bell" size={18} />
          </span>
          <p>{notice}</p>
          <button
            className="icon-button"
            aria-label="关闭提示"
            onClick={() => monitor.setNotice(null)}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
