import type { Market, Sample } from "./market";
import type { MonitorController, MonitorEvent, MonitorState } from "./monitor";

export type IconProps = { name: string; size?: number };
export type GaugeProps = { value: number | null };
export type HistoryChartProps = { history: Sample[]; days: number };
export type SidebarProps = { alertCount: number };
export type TrendPanelProps = { market: Market | null };
export type MarketOverviewProps = {
  state: MonitorState;
  now: number;
  alertCount: number;
};
export type MonitorSettingsProps = { monitor: MonitorController };
export type EventLogProps = {
  events: MonitorEvent[];
  alertCount: number;
  onExport: () => void;
};
