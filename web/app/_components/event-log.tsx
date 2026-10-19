import { useState } from "react";
import { formatTime } from "../../lib/format";
import type { EventLogProps } from "../../types/components";
import { Icon } from "./icon";

export function EventLog({
  events: records,
  alertCount,
  onExport,
}: EventLogProps) {
  const [filter, setFilter] = useState("all");
  const events = records.filter(
    (event) =>
      filter === "all" ||
      (filter === "alerts" ? event.kind === "alert" : event.kind === "error"),
  );
  return (
    <section
      id="events"
      className="panel events-panel"
      aria-labelledby="events-title"
    >
      <div className="panel-heading">
        <div>
          <span className="eyebrow">ACTIVITY LOG</span>
          <h2 id="events-title">每一次变化，都有迹可循</h2>
        </div>
        <button className="button text-button" onClick={onExport}>
          <Icon name="download" size={16} />
          导出记录
        </button>
      </div>
      <div className="event-tabs" aria-label="事件筛选">
        {[
          ["all", "全部事件"],
          ["alerts", "市场告警"],
          ["errors", "读取异常"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={filter === key ? "selected" : ""}
          >
            {label}
            {key === "alerts" && <span>{alertCount}</span>}
          </button>
        ))}
      </div>
      {events.length === 0 ? (
        <div className="events-empty">
          <span>
            <Icon name={filter === "errors" ? "shield" : "bell"} size={24} />
          </span>
          <div>
            <strong>
              {filter === "errors"
                ? "暂时没有读取异常"
                : filter === "alerts"
                  ? "还没有市场告警"
                  : "新的观察，从这里开始"}
            </strong>
            <p>
              {filter === "alerts"
                ? "满足告警规则时，会在这里留下记录。"
                : "每次读取与操作都会记录在当前浏览器中。"}
            </p>
          </div>
        </div>
      ) : (
        <div className="events-table">
          <div className="table-head">
            <span>类型</span>
            <span>事件详情</span>
            <span>本地时间</span>
          </div>
          {events.slice(0, 8).map((event) => (
            <div className="event-row" key={event.id}>
              <span className={`event-kind ${event.kind}`}>
                <span className="dot" />
                {event.kind === "alert"
                  ? "市场告警"
                  : event.kind === "error"
                    ? "读取异常"
                    : "监控记录"}
              </span>
              <span>{event.message}</span>
              <time dateTime={new Date(event.at).toISOString()}>
                {formatTime(event.at)}
              </time>
            </div>
          ))}
          <div className="table-foot">
            显示最近 {Math.min(events.length, 8)} / {events.length} 条
            {events.length > 8 && " · 导出查看完整记录"}
          </div>
        </div>
      )}
    </section>
  );
}
