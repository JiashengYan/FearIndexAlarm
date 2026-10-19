import { evaluate, validSample, displayed } from "./market.ts";
import type { MarketResult } from "../types/market.ts";
import type {
  MonitorState,
  MonitorEvent,
  MonitorUpdate,
} from "../types/monitor.ts";

export const STORAGE_KEY = "fear-index.web.v1";
export function initialState(): MonitorState {
  return {
    version: 1,
    enabled: false,
    interval: 900,
    snoozedUntil: 0,
    revision: 0,
    baseline: null,
    market: null,
    nextCheck: 0,
    failures: 0,
    events: [],
    error: null,
  };
}
export function addEvent(
  state: MonitorState,
  kind: MonitorEvent["kind"],
  message: string,
  now = Date.now(),
): MonitorState {
  return {
    ...state,
    events: [
      { id: crypto.randomUUID(), at: now, kind, message },
      ...state.events,
    ].slice(0, 200),
  };
}
export function readState(raw: string | null): MonitorState {
  if (raw === null) return initialState();
  const s = JSON.parse(raw) as MonitorState;
  if (
    s.version !== 1 ||
    typeof s.enabled !== "boolean" ||
    !Number.isInteger(s.interval) ||
    s.interval < 60 ||
    s.interval > 604800 ||
    ![s.snoozedUntil, s.revision, s.nextCheck, s.failures].every(
      (n) => Number.isFinite(n) && n >= 0,
    ) ||
    (s.baseline !== null && (!s.baseline || !validSample(s.baseline))) ||
    (s.error !== null && typeof s.error !== "string") ||
    !Array.isArray(s.events) ||
    s.events.length > 200 ||
    s.events.some(
      (e) =>
        !e ||
        typeof e.id !== "string" ||
        !Number.isFinite(e.at) ||
        Math.abs(e.at) > 8_640_000_000_000_000 ||
        typeof e.message !== "string" ||
        !["alert", "error", "info"].includes(e.kind),
    )
  )
    throw new Error(
      "本地监控记录损坏，已停止自动监控。请导出本地记录后检查浏览器存储。",
    );
  if (
    s.market !== null &&
    (!validSample(s.market.sample) ||
      !Array.isArray(s.market.history) ||
      s.market.history.some((p) => !validSample(p)) ||
      !Number.isFinite(s.market.receivedAt) ||
      !Array.isArray(s.market.comparisons) ||
      s.market.comparisons.some(
        (c) =>
          typeof c.label !== "string" ||
          (c.value !== null &&
            (!Number.isFinite(c.value) || c.value < 0 || c.value > 100)),
      ))
  )
    throw new Error("本地行情记录损坏，已停止自动监控。");
  return s;
}

export function applyResult(
  state: MonitorState,
  result: MarketResult,
  now: number,
  mayEvaluate: boolean,
): MonitorUpdate {
  let next = { ...state, nextCheck: now + state.interval * 1000 };
  if (!result.ok) {
    next = addEvent(
      { ...next, failures: state.failures + 1, error: result.error },
      "error",
      result.error,
      now,
    );
    return {
      state: next,
      notification:
        mayEvaluate && next.failures === 3
          ? "连续 3 次读取失败，请检查网络或数据源。"
          : null,
    };
  }
  next = { ...next, market: result.data, failures: 0, error: null };
  if (!mayEvaluate)
    return {
      state: addEvent(
        next,
        "info",
        `已刷新行情 · ${state.enabled ? "监控休眠中" : "监控未启用"}，不评估告警`,
        now,
      ),
      notification: null,
    };
  const decision = evaluate(state.baseline, result.data.sample, now);
  if (decision.accept) next.baseline = result.data.sample;
  const message = decision.alert
    ? `恐惧加深：${displayed(state.baseline!.value)} → ${displayed(result.data.sample.value)}，低于 25`
    : decision.reason;
  return {
    state: addEvent(next, decision.alert ? "alert" : "info", message, now),
    notification: decision.alert ? message : null,
  };
}
