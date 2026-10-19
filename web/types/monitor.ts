import type { Sample, Market } from "./market";

export type MonitorEvent = {
  id: string;
  at: number;
  kind: "alert" | "error" | "info";
  message: string;
};
export type MonitorState = {
  version: 1;
  enabled: boolean;
  interval: number;
  snoozedUntil: number;
  revision: number;
  baseline: Sample | null;
  market: Market | null;
  nextCheck: number;
  failures: number;
  events: MonitorEvent[];
  error: string | null;
};

export type MonitorSettings = Partial<
  Pick<MonitorState, "enabled" | "interval" | "snoozedUntil">
>;

export type MonitorUpdate = {
  state: MonitorState;
  notification: string | null;
};

export type MonitorController = {
  state: MonitorState;
  ready: boolean;
  busy: boolean;
  now: number;
  storageError: string | null;
  notice: string | null;
  setNotice: (notice: string | null) => void;
  permission: string;
  check: (force?: boolean) => Promise<void>;
  configure: (settings: MonitorSettings, message: string) => void;
  requestNotifications: (test?: boolean) => Promise<void>;
  exportEvents: () => void;
};
