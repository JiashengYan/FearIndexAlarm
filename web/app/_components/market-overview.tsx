import type { CSSProperties } from "react";
import { displayed, sentiment } from "../../lib/market";
import { formatTime } from "../../lib/format";
import type { MarketOverviewProps } from "../../types/components";
import { Gauge } from "./gauge";
import { TrendPanel } from "./trend-panel";
import { Icon } from "./icon";

export function MarketOverview({
  state,
  now,
  alertCount,
}: MarketOverviewProps) {
  const sample = state.market?.sample;
  const value = sample?.value ?? null;
  const mood = value === null ? null : sentiment(value);
  const age = sample
    ? Math.max(0, Math.floor((now - sample.sourceTimeMs) / 60_000))
    : null;
  const stale = sample
    ? now - sample.sourceTimeMs > 3_600_000 ||
      sample.sourceTimeMs > now + 300_000
    : false;
  const previous = state.market?.comparisons[0]?.value;
  const delta =
    value !== null && previous != null
      ? displayed(value) - displayed(previous)
      : null;

  return (
    <>
      <section
        className="panel index-panel"
        aria-labelledby="index-title"
        style={
          {
            "--mood": stale ? "#9aa69b" : (mood?.color ?? "#c9f675"),
          } as CSSProperties
        }
      >
        <div className="panel-heading">
          <div>
            <span className="eyebrow">FEAR & GREED INDEX</span>
            <h2 id="index-title">恐惧与贪婪指数</h2>
          </div>
          <span className={`data-badge ${stale ? "muted" : ""}`}>
            <span className="dot" />
            {!sample ? "等待数据" : stale ? "历史数据" : "最新读取"}
          </span>
        </div>
        <Gauge value={value} />
        <div className="mood-label">
          {mood?.label ?? "连接市场中"}
          <span>{mood?.english ?? "WAITING FOR DATA"}</span>
        </div>
        <div className="day-change">
          {delta === null ? (
            "成功读取后展示市场变化"
          ) : (
            <>
              <span className={delta >= 0 ? "positive" : "negative"}>
                {delta >= 0 ? "↗" : "↘"} {delta > 0 ? "+" : ""}
                {delta}
              </span>{" "}
              较上个收盘
            </>
          )}
        </div>
        <div className="spectrum">
          <div />
          <div className="spectrum-labels">
            <span>极度恐惧</span>
            <span>中性</span>
            <span>极度贪婪</span>
          </div>
        </div>
        <div className="source-caption">
          <Icon name="clock" size={14} />
          <span>源时间 {sample ? formatTime(sample.sourceTimeMs) : "—"}</span>
          <a
            href="https://edition.cnn.com/markets/fear-and-greed"
            target="_blank"
            rel="noreferrer"
            aria-label="查看 CNN 数据来源"
          >
            <Icon name="arrow" size={15} />
          </a>
        </div>
      </section>
      <TrendPanel market={state.market} />
      <section className="stats-row" aria-label="监控摘要">
        <div className="stat-card">
          <span className="stat-icon">
            <Icon name="pulse" />
          </span>
          <div>
            <span>上次有效基准</span>
            <strong>
              {state.baseline ? displayed(state.baseline.value) : "—"}
              <small>
                {state.baseline
                  ? sentiment(state.baseline.value).label
                  : "启用后建立"}
              </small>
            </strong>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">
            <Icon name="clock" />
          </span>
          <div>
            <span>源数据年龄</span>
            <strong>
              {age === null
                ? "—"
                : age >= 60
                  ? `${Math.floor(age / 60)} 小时`
                  : `${age} 分钟`}
              <small className={stale ? "negative" : ""}>
                {stale ? "不参与告警" : "有效期 60 分钟"}
              </small>
            </strong>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">
            <Icon name="bell" />
          </span>
          <div>
            <span>已记录告警</span>
            <strong>
              {alertCount.toString().padStart(2, "0")}
              <small>保留最近 200 条事件</small>
            </strong>
          </div>
        </div>
      </section>
    </>
  );
}
