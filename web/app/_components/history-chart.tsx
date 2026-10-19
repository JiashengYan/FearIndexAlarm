import { useState } from "react";
import { displayed, sentiment } from "../../lib/market";
import type { Sample } from "../../types/market";
import type { HistoryChartProps } from "../../types/components";
import { Icon } from "./icon";
export function HistoryChart({ history, days }: HistoryChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const end = history.at(-1)?.sourceTimeMs ?? 0;
  const points = history.filter(
    (p) => p.sourceTimeMs >= end - days * 86_400_000,
  );
  if (points.length < 2)
    return (
      <div className="chart-empty">
        <Icon name="pulse" size={35} />
        <strong>等待历史数据</strong>
        <p>成功连接 CNN 后，这里将显示真实的情绪走势。</p>
      </div>
    );
  const first = points[0].sourceTimeMs;
  const px = (p: Sample) =>
    35 + ((p.sourceTimeMs - first) / Math.max(end - first, 1)) * 680;
  const py = (p: Sample) => 202 - p.value * 1.75;
  const path = points
    .map((p, i) => `${i ? "L" : "M"}${px(p).toFixed(2)},${py(p).toFixed(2)}`)
    .join(" ");
  const selected =
    points[Math.min(hover ?? points.length - 1, points.length - 1)];
  return (
    <div className="history-plot">
      <div className="chart-tooltip">
        <span>
          {new Date(selected.sourceTimeMs).toLocaleDateString("zh-CN")}
        </span>
        <strong>{displayed(selected.value)}</strong>
        <span style={{ color: sentiment(selected.value).color }}>
          {sentiment(selected.value).label}
        </span>
      </div>
      <svg
        viewBox="0 0 760 242"
        role="img"
        aria-label={`最近 ${days} 天恐惧与贪婪指数走势，最近值 ${displayed(points.at(-1)!.value)}`}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const timestamp =
            first +
            ((((e.clientX - rect.left) / rect.width) * 760 - 35) / 680) *
              (end - first);
          let closest = 0;
          points.forEach((p, i) => {
            if (
              Math.abs(p.sourceTimeMs - timestamp) <
              Math.abs(points[closest].sourceTimeMs - timestamp)
            )
              closest = i;
          });
          setHover(closest);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#c9f675" stopOpacity=".18" />
            <stop offset="1" stopColor="#c9f675" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="35" y="158.25" width="680" height="43.75" fill="#ed8f7910" />
        {[0, 25, 50, 75, 100].map((n) => (
          <g key={n}>
            <line
              x1="35"
              y1={202 - n * 1.75}
              x2="715"
              y2={202 - n * 1.75}
              stroke={n === 25 ? "#99644f" : "#2a322b"}
              strokeDasharray={n === 25 ? "4 5" : "2 5"}
            />
            <text x="735" y={206 - n * 1.75} textAnchor="middle">
              {n}
            </text>
          </g>
        ))}
        <text x="44" y="179" className="threshold-text">
          极度恐惧区间
        </text>
        <path d={`${path} L715,202 L35,202 Z`} fill="url(#chart-fill)" />
        <path
          d={path}
          fill="none"
          stroke="#c9f675"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <line
          x1={px(selected)}
          y1="24"
          x2={px(selected)}
          y2="202"
          stroke="#829071"
          strokeDasharray="3 5"
        />
        <circle
          cx={px(selected)}
          cy={py(selected)}
          r="5"
          fill="#c9f675"
          stroke="#172018"
          strokeWidth="3"
        />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <text
            key={t}
            x={35 + 680 * t}
            y="231"
            textAnchor={t === 0 ? "start" : t === 1 ? "end" : "middle"}
          >
            {new Date(first + (end - first) * t).toLocaleDateString("zh-CN", {
              month: "2-digit",
              day: "2-digit",
            })}
          </text>
        ))}
      </svg>
      <label className="sr-only">
        选择历史数据点
        <input
          type="range"
          min="0"
          max={points.length - 1}
          value={hover ?? points.length - 1}
          onChange={(e) => setHover(Number(e.target.value))}
        />
      </label>
    </div>
  );
}
