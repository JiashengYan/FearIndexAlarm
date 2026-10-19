"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  MonitorState,
  MonitorSettings,
  MonitorController,
} from "../../types/monitor";
import { readMarketAction } from "../actions";
import {
  addEvent,
  applyResult,
  initialState,
  readState,
  STORAGE_KEY,
} from "../../lib/monitor";

export function useMonitor(): MonitorController {
  const [state, setState] = useState<MonitorState>(initialState);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [permission, setPermission] = useState<string>("default");
  const inFlight = useRef(false);
  const alive = useRef(false);

  const save = useCallback((next: MonitorState) => {
    // Commit baseline and in-app alerts together before any OS notification.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    if (alive.current) setState(next);
  }, []);

  const storageFailed = useCallback(() => {
    if (alive.current)
      setStorageError(
        "无法读取或保存本地记录，自动监控已停止。请检查浏览器存储；原记录不会被覆盖。",
      );
  }, []);

  const check = useCallback(
    async (force = false) => {
      if (inFlight.current) return;
      inFlight.current = true;
      const execute = async () => {
        const before = readState(localStorage.getItem(STORAGE_KEY));
        const started = Date.now();
        if (
          !force &&
          (!before.enabled ||
            before.snoozedUntil > started ||
            before.nextCheck > started)
        )
          return;
        if (alive.current) setBusy(true);
        let result;
        try {
          result = await readMarketAction();
        } catch {
          result = {
            ok: false as const,
            error: "连接应用服务失败，请确认 Next.js 服务正在运行",
          };
        }
        if (!alive.current) return;
        const current = readState(localStorage.getItem(STORAGE_KEY));
        // Stop, snooze, or configuration changes during I/O invalidate that attempt.
        if (current.revision !== before.revision) {
          setState(current);
          return;
        }
        const finished = Date.now();
        const { state: next, notification } = applyResult(
          current,
          result,
          finished,
          current.enabled && current.snoozedUntil <= finished,
        );
        save(next);
        if (notification) {
          setNotice(notification);
          if (
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            try {
              new Notification("FearIndex · 市场提醒", {
                body: notification,
                icon: "/icon.svg",
                tag: "fear-index-alarm",
              });
            } catch {
              setNotice(`${notification}（系统通知不可用，已保存在事件记录）`);
            }
          }
        }
      };
      try {
        if (navigator.locks) {
          await navigator.locks.request(
            "fear-index.web.fetch",
            { ifAvailable: true },
            async (lock) => {
              if (lock) await execute();
              else if (force && alive.current)
                setNotice("另一个标签页正在读取，请稍后刷新。");
            },
          );
        } else await execute();
      } catch {
        storageFailed();
      } finally {
        inFlight.current = false;
        if (alive.current) setBusy(false);
      }
    },
    [save, storageFailed],
  );

  useEffect(() => {
    alive.current = true;
    setNow(Date.now());
    try {
      setState(readState(localStorage.getItem(STORAGE_KEY)));
      setReady(true);
    } catch {
      storageFailed();
    }
    setPermission(
      "Notification" in window ? Notification.permission : "unsupported",
    );
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      try {
        setState(readState(localStorage.getItem(STORAGE_KEY)));
      } catch {
        storageFailed();
      }
    };
    window.addEventListener("storage", sync);
    return () => {
      alive.current = false;
      window.removeEventListener("storage", sync);
    };
  }, [storageFailed]);

  useEffect(() => {
    if (!ready || storageError) return;
    // Initial read is a preview unless the user previously enabled monitoring.
    const initial = setTimeout(
      () =>
        startTransition(() => {
          void check(true);
        }),
      150,
    );
    const timer = setInterval(() => {
      setNow(Date.now());
      startTransition(() => {
        void check();
      });
    }, 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [ready, storageError, check]);

  function configure(patch: MonitorSettings, message: string) {
    if (storageError || !ready) return;
    try {
      const current = readState(localStorage.getItem(STORAGE_KEY));
      const next = { ...current, ...patch, revision: current.revision + 1 };
      if (patch.enabled === true) next.failures = 0;
      next.nextCheck =
        patch.enabled === true || patch.snoozedUntil === 0
          ? 0
          : patch.snoozedUntil !== undefined
            ? patch.snoozedUntil
            : patch.interval !== undefined
              ? Date.now() + next.interval * 1000
              : current.nextCheck;
      save(addEvent(next, "info", message));
      setNow(Date.now());
      setNotice(message);
    } catch {
      storageFailed();
    }
  }

  async function requestNotifications(test = false) {
    if (!("Notification" in window)) {
      setNotice("此浏览器不支持系统通知，告警仍保存在页面内。");
      return;
    }
    try {
      const status = await Notification.requestPermission();
      setPermission(status);
      if (status === "granted") {
        new Notification("FearIndex · 测试通知", {
          body: "通知已启用。这是一条测试，不是市场告警。",
          icon: "/icon.svg",
        });
        setNotice(
          test
            ? "测试通知已提交给浏览器。"
            : "浏览器通知已开启，已发送一条测试通知。",
        );
      } else
        setNotice(
          "通知未获授权，您仍可在页面内查看告警。可在浏览器站点设置中更改权限。",
        );
    } catch {
      setNotice("系统通知暂不可用，您仍可在页面内查看告警。");
    }
  }

  function exportEvents() {
    try {
      const data = storageError
        ? (localStorage.getItem(STORAGE_KEY) ?? "{}")
        : JSON.stringify(
            { exportedAt: new Date().toISOString(), events: state.events },
            null,
            2,
          );
      const url = URL.createObjectURL(
        new Blob([data], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "fear-index-events.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("记录已导出。");
    } catch {
      setNotice("无法导出记录，请检查浏览器下载与存储权限。");
    }
  }

  return {
    state,
    ready,
    busy,
    now,
    storageError,
    notice,
    setNotice,
    permission,
    check,
    configure,
    requestNotifications,
    exportEvents,
  };
}
