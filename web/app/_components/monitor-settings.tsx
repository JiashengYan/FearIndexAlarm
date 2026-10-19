import { useState } from "react";
import { formatDuration } from "../../lib/format";
import type { MonitorSettingsProps } from "../../types/components";
import { Icon } from "./icon";

export function MonitorSettings({ monitor }: MonitorSettingsProps) {
  const { state, ready, busy, now, storageError, permission } = monitor;
  const [intervalDraft, setIntervalDraft] = useState<string | null>(null);
  const [intervalError, setIntervalError] = useState("");
  const disabled = !ready || !!storageError;
  const snoozed = state.snoozedUntil > now;
  const running = state.enabled && !snoozed && !storageError;
  const nextIn = Math.max(
    0,
    Math.ceil(((snoozed ? state.snoozedUntil : state.nextCheck) - now) / 1000),
  );
  const countdown = `${Math.floor(nextIn / 60)
    .toString()
    .padStart(2, "0")}:${(nextIn % 60).toString().padStart(2, "0")}`;

  return (
    <section
      id="settings"
      className="panel settings-panel"
      aria-labelledby="settings-title"
    >
      <div className="panel-heading">
        <div>
          <span className="eyebrow">YOUR WATCH, YOUR PACE</span>
          <h2 id="settings-title">监控与提醒</h2>
        </div>
        <span className={`status-tag ${running ? "on" : ""}`}>
          {storageError
            ? "存储异常"
            : !state.enabled
              ? "未启用"
              : snoozed
                ? "休眠中"
                : "监控中"}
        </span>
      </div>
      <div className="control-row">
        <div>
          <strong>自动监控</strong>
          <p>按设定间隔检查指数变化</p>
        </div>
        <button
          className={`switch ${state.enabled ? "enabled" : ""}`}
          role="switch"
          aria-checked={state.enabled}
          aria-label="自动监控"
          disabled={disabled}
          onClick={() =>
            monitor.configure(
              { enabled: !state.enabled, snoozedUntil: 0 },
              state.enabled ? "已停止自动监控" : "已开启自动监控",
            )
          }
        >
          <span />
        </button>
      </div>
      <form
        className="interval-form"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(intervalDraft ?? state.interval);
          if (!Number.isInteger(n) || n < 60 || n > 604800) {
            setIntervalError("请输入 60–604800 之间的整数秒数");
            return;
          }
          monitor.configure(
            { interval: n },
            `检查间隔已设为 ${formatDuration(n)}`,
          );
          setIntervalDraft(null);
          setIntervalError("");
        }}
      >
        <div className="field-label">
          <label htmlFor="interval">检查间隔</label>
          <span>当前 {formatDuration(state.interval)}</span>
        </div>
        <div className="interval-input">
          <input
            id="interval"
            type="number"
            min="60"
            max="604800"
            step="1"
            required
            value={intervalDraft ?? state.interval}
            disabled={disabled}
            onChange={(e) => setIntervalDraft(e.target.value)}
            aria-describedby={intervalError ? "interval-error" : undefined}
          />
          <span>秒</span>
          <button className="button small secondary" disabled={disabled}>
            保存
          </button>
        </div>
        <div className="presets">
          {[60, 300, 900, 3600].map((n) => (
            <button
              type="button"
              key={n}
              disabled={disabled}
              className={state.interval === n ? "selected" : ""}
              onClick={() => {
                monitor.configure(
                  { interval: n },
                  `检查间隔已设为 ${formatDuration(n)}`,
                );
                setIntervalDraft(null);
                setIntervalError("");
              }}
            >
              {formatDuration(n)}
            </button>
          ))}
        </div>
        {intervalError && (
          <p id="interval-error" className="negative" role="alert">
            {intervalError}
          </p>
        )}
      </form>
      <div className="next-check">
        <span>
          <span className={`dot ${running ? "" : "gray"}`} />
          {snoozed && state.enabled ? "距离自动恢复" : "距离下次检查"}
        </span>
        <strong>
          {!state.enabled || storageError
            ? "— : —"
            : busy
              ? "读取中"
              : countdown}
        </strong>
      </div>
      <div className="control-actions">
        <button
          className="button secondary"
          disabled={disabled || !state.enabled}
          onClick={() =>
            monitor.configure(
              { snoozedUntil: snoozed ? 0 : Date.now() + 3_600_000 },
              snoozed ? "已结束休眠" : "已休眠 1 小时",
            )
          }
        >
          <Icon name={snoozed ? "pulse" : "moon"} size={16} />
          {snoozed ? "立即恢复" : "休眠 1 小时"}
        </button>
        <button
          className="button primary"
          onClick={() =>
            void monitor.requestNotifications(permission === "granted")
          }
        >
          <Icon name="bell" size={16} />
          {permission === "granted" ? "测试通知" : "开启通知"}
        </button>
      </div>
      <div className="permission-caption">
        <span className={`dot ${permission === "granted" ? "" : "gray"}`} />
        {permission === "granted"
          ? "浏览器通知已授权"
          : permission === "denied"
            ? "通知被阻止 · 请在站点设置中开启"
            : permission === "unsupported"
              ? "当前浏览器仅支持页内提醒"
              : "通知待授权 · 页内提醒始终可用"}
      </div>
    </section>
  );
}
