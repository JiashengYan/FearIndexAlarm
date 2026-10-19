import { parseMarket } from "./market.ts";
import type { MarketResult } from "../types/market.ts";

const ENDPOINT =
  "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";

export async function fetchMarket(
  request: typeof fetch = fetch,
): Promise<MarketResult> {
  try {
    const response = await request(ENDPOINT, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        Accept: "application/json",
        Referer: "https://edition.cnn.com/markets/fear-and-greed",
        Origin: "https://edition.cnn.com",
      },
    });
    if (!response.ok)
      return {
        ok: false,
        error: `CNN 请求失败（HTTP ${response.status}），保留上次数据`,
      };
    if (!response.body) throw new Error("CNN 响应为空");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let size = 0,
      body = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2_000_000) throw new Error("CNN 响应超出大小限制");
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
    } finally {
      await reader.cancel();
    }
    return { ok: true, data: parseMarket(JSON.parse(body)) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "请求失败";
    return {
      ok: false,
      error: message.startsWith("CNN ")
        ? message
        : "暂时无法读取 CNN，请稍后重试；上次数据已保留",
    };
  }
}
