import { useState } from "react";
import type { SidebarProps } from "../../types/components";
import { Icon } from "./icon";

export function Sidebar({ alertCount }: SidebarProps) {
  const [active, setActive] = useState("overview");
  return (
    <aside className="sidebar">
      <a className="brand" href="#overview" aria-label="FearIndex 首页">
        <span className="brand-mark">
          <Icon name="pulse" size={25} />
        </span>
        <span>
          FearIndex<span className="brand-sub">MARKET SENTIMENT ALARM</span>
        </span>
      </a>
      <div className="workspace">
        <span className="workspace-avatar">F</span>
        <div>
          个人工作台<small>本地独立监控</small>
        </div>
        <span className="workspace-dot" />
      </div>
      <span className="nav-label">WORKSPACE</span>
      <nav aria-label="主导航">
        {[
          ["overview", "grid", "市场概览"],
          ["events", "bell", "事件记录"],
          ["settings", "sliders", "监控设置"],
        ].map(([id, icon, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className={active === id ? "nav-item active" : "nav-item"}
            onClick={() => setActive(id)}
          >
            <Icon name={icon} />
            {label}
            {id === "events" && alertCount > 0 && (
              <span className="nav-count">{alertCount}</span>
            )}
          </a>
        ))}
      </nav>
      <div className="sidebar-note">
        <span className="note-symbol">“</span>
        <p>
          让情绪成为信号，
          <br />
          让决策保持冷静。
        </p>
        <small>STAY AWARE. STAY RATIONAL.</small>
      </div>
      <div className="sidebar-bottom">
        <span className="dot" />
        数据来自 CNN
        <small>
          Fear & Greed Index <Icon name="arrow" size={13} />
        </small>
        <div className="version">
          WEB EDITION <span>v0.1</span>
        </div>
      </div>
    </aside>
  );
}
