export type Sample = { value: number; sourceTimeMs: number };
export type Market = {
  sample: Sample;
  history: Sample[];
  comparisons: { label: string; value: number | null }[];
  receivedAt: number;
};
export type MarketResult =
  | { ok: true; data: Market }
  | { ok: false; error: string };
