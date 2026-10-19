import { useState } from "react";
import { displayed, sentiment } from "../../lib/market";
import type { TrendPanelProps } from "../../types/components";
import { HistoryChart } from "./history-chart";
export function TrendPanel({ market }: TrendPanelProps) {
  const [days, setDays] = useState(30);
  return (
    <section className="panel trend-panel" aria-labelledby="trend-title">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">SENTIMENT HISTORY</span>
          <h2 id="trend-title">情绪走势</h2>
        </div>
        <div className="segmented" aria-label="历史范围">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              aria-pressed={days === d}
              className={days === d ? "selected" : ""}
              onClick={() => setDays(d)}
            >
              {d} 天
            </button>
          ))}
        </div>
      </div>
      <div className="chart-legend">
        <span>
          <i />
          恐惧与贪婪指数
        </span>
        <span>
          <i className="dashed" />
          告警阈值 25
        </span>
      </div>
      <HistoryChart history={market?.history ?? []} days={days} />
      <div className="comparisons">
        {(
          market?.comparisons ??
          ["上个收盘", "一周前", "一个月前", "一年前"].map((label) => ({
            label,
            value: null,
          }))
        ).map((c) => (
          <div key={c.label}>
            <span>{c.label}</span>
            <strong>
              {c.value === null ? "—" : displayed(c.value)}
              <small
                style={{
                  color:
                    c.value === null ? undefined : sentiment(c.value).color,
                }}
              >
                {c.value === null ? "暂无数据" : sentiment(c.value).label}
              </small>
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}
