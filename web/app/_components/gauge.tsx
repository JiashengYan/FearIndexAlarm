import { displayed } from "../../lib/market";
import type { GaugeProps } from "../../types/components";
export function Gauge({ value }: GaugeProps) {
  const angle = ((value ?? 50) / 100) * Math.PI;
  const x = 160 - 124 * Math.cos(angle),
    y = 150 - 124 * Math.sin(angle);
  return (
    <div className="gauge">
      <svg viewBox="0 0 320 192" aria-hidden="true">
        <defs>
          <linearGradient id="gauge-spectrum">
            <stop stopColor="#ef8b78" />
            <stop offset="0.3" stopColor="#deb876" />
            <stop offset="0.55" stopColor="#b8c69c" />
            <stop offset="1" stopColor="#bde77c" />
          </linearGradient>
        </defs>
        <path
          d="M36 150a124 124 0 0 1 248 0"
          fill="none"
          stroke="#292f2c"
          strokeWidth="13"
          strokeLinecap="round"
        />
        <path
          d="M36 150a124 124 0 0 1 248 0"
          fill="none"
          stroke="url(#gauge-spectrum)"
          strokeWidth="13"
          strokeLinecap="round"
          opacity={value === null ? ".25" : "1"}
        />
        <path
          d="M57 150a103 103 0 0 1 206 0"
          fill="none"
          stroke="#394039"
          strokeWidth="1"
          strokeDasharray="1 12.5"
        />
        {value !== null && (
          <>
            <circle
              cx={x}
              cy={y}
              r="12"
              fill="#141a17"
              stroke="#e8eddf"
              strokeWidth="3"
            />
            <circle cx={x} cy={y} r="4" fill="#e8eddf" />
          </>
        )}
        <text x="32" y="181">
          0
        </text>
        <text x="276" y="181">
          100
        </text>
      </svg>
      <div className="gauge-value">
        <strong>{value === null ? "—" : displayed(value)}</strong>
        <span>/ 100</span>
      </div>
    </div>
  );
}
