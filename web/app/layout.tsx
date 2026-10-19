import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FearIndex — 市场情绪监控",
  description:
    "关注市场情绪，在恐惧加深时收到提醒。独立的 CNN 恐惧与贪婪指数监控面板。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      {/* Extensions such as ColorZilla may inject attributes before hydration. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
