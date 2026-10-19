export const formatTime = (at: number) =>
  at
    ? new Date(at).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "尚未读取";

export const formatDuration = (seconds: number) =>
  seconds >= 3600
    ? `${(seconds / 3600).toFixed(seconds % 3600 ? 1 : 0)} 小时`
    : `${(seconds / 60).toFixed(seconds % 60 ? 1 : 0)} 分钟`;
