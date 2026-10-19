import type { Sample, Market } from "../types/market.ts";

export const displayed = (value: number) => Math.round(value);
export const validSample = (s: Sample) =>
  Number.isFinite(s.value) &&
  s.value >= 0 &&
  s.value <= 100 &&
  Number.isFinite(s.sourceTimeMs) &&
  s.sourceTimeMs > 0;

export function evaluate(
  previous: Sample | null,
  current: Sample,
  now: number,
) {
  const reject = (reason: string) => ({ accept: false, alert: false, reason });
  if (!validSample(current)) return reject("无效数据");
  if (current.sourceTimeMs > now + 300_000)
    return reject("源时间超前超过 5 分钟");
  if (now - current.sourceTimeMs > 3_600_000)
    return reject("源数据超过 60 分钟未更新");
  if (previous && current.sourceTimeMs < previous.sourceTimeMs)
    return reject("忽略旧时间戳");
  if (previous && current.sourceTimeMs === previous.sourceTimeMs)
    return reject(
      current.value === previous.value ? "源数据未更新" : "同一时间戳数值冲突",
    );
  const alert =
    previous !== null &&
    displayed(current.value) < 25 &&
    displayed(current.value) < displayed(previous.value);
  return {
    accept: true,
    alert,
    reason: alert
      ? "低于 25 且较上次下降"
      : previous
        ? "已更新监控基准"
        : "已建立监控基准",
  };
}

export function sentiment(value: number) {
  const n = displayed(value);
  if (n < 25)
    return { label: "极度恐惧", english: "EXTREME FEAR", color: "#f18b79" };
  if (n < 45) return { label: "恐惧", english: "FEAR", color: "#e6b471" };
  if (n <= 55) return { label: "中性", english: "NEUTRAL", color: "#b9c4ba" };
  if (n < 75) return { label: "贪婪", english: "GREED", color: "#8ecab0" };
  return { label: "极度贪婪", english: "EXTREME GREED", color: "#c9f675" };
}

export function parseTimestamp(raw: unknown): number {
  if (
    typeof raw === "number" ||
    (typeof raw === "string" && /^\d+$/.test(raw))
  ) {
    const n = Number(raw);
    return n < 100_000_000_000 ? n * 1000 : n;
  }
  // A timezone is required; never reinterpret CNN time in the server's local zone.
  return typeof raw === "string" && /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw)
    ? Date.parse(raw)
    : NaN;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("CNN 数据结构发生变化");
  return value as Record<string, unknown>;
}

export function parseMarket(raw: unknown, now = Date.now()): Market {
  const root = object(raw);
  const current = object(root.fear_and_greed);
  const sample = {
    value: typeof current.score === "number" ? current.score : NaN,
    sourceTimeMs: parseTimestamp(current.timestamp),
  };
  if (!validSample(sample)) throw new Error("CNN 返回了无效指数或时间戳");
  const historical = root.fear_and_greed_historical;
  const rows =
    historical && typeof historical === "object"
      ? (historical as Record<string, unknown>).data
      : [];
  const unique = new Map<number, Sample>();
  if (Array.isArray(rows))
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const s = { value: row.y, sourceTimeMs: parseTimestamp(row.x) };
      if (validSample(s) && s.sourceTimeMs <= now + 300_000)
        unique.set(s.sourceTimeMs, s);
    }
  return {
    sample,
    receivedAt: now,
    history: [...unique.values()]
      .sort((a, b) => a.sourceTimeMs - b.sourceTimeMs)
      .slice(-400),
    comparisons: [
      ["上个收盘", "previous_close"],
      ["一周前", "previous_1_week"],
      ["一个月前", "previous_1_month"],
      ["一年前", "previous_1_year"],
    ].map(([label, key]) => {
      const v = current[key];
      return {
        label,
        value:
          typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100
            ? v
            : null,
      };
    }),
  };
}
