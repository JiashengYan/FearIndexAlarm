import type { MarketResult } from "../types/market.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluate, parseMarket, parseTimestamp } from "../lib/market.ts";
import { applyResult, initialState, readState } from "../lib/monitor.ts";
import { fetchMarket } from "../lib/cnn.ts";

const cases = readFileSync(
  new URL("../../shared/rule-cases.csv", import.meta.url),
  "utf8",
)
  .trim()
  .split(/\r?\n/)
  .slice(1);
for (const line of cases) {
  const [
    name,
    previous,
    previousTime,
    current,
    currentTime,
    now,
    accept,
    alert,
  ] = line.split(";");
  test(`shared rule: ${name}`, () => {
    const result = evaluate(
      previous
        ? { value: Number(previous), sourceTimeMs: Number(previousTime) }
        : null,
      { value: Number(current), sourceTimeMs: Number(currentTime) },
      Number(now),
    );
    assert.equal(result.accept, accept === "true");
    assert.equal(result.alert, alert === "true");
  });
}

test("timestamp parsing and public synthetic CNN fixture", () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL("../../shared/cnn-response.json", import.meta.url),
      "utf8",
    ),
  );
  const data = parseMarket(fixture);
  assert.equal(data.sample.value, fixture.fear_and_greed.score);
  assert.equal(
    data.sample.sourceTimeMs,
    Date.parse(fixture.fear_and_greed.timestamp),
  );
  for (const input of [
    1_792_425_422,
    "1792425422",
    1_792_425_422_000,
    "1792425422000",
    "2026-10-19T15:57:02Z",
  ])
    assert.equal(parseTimestamp(input), 1_792_425_422_000);
  for (const input of [null, "", "2026-10-19T15:57:02"])
    assert.ok(Number.isNaN(parseTimestamp(input)));
  for (const value of [NaN, Infinity, -1, 101])
    assert.equal(
      evaluate(null, { value, sourceTimeMs: 1000 }, 1000).accept,
      false,
    );
  assert.throws(() =>
    parseMarket({ fear_and_greed: { score: "24", timestamp: "bad" } }),
  );
});

test("history is validated, sorted, deduplicated; missing data stays absent", () => {
  const raw = {
    fear_and_greed: { score: 24, timestamp: 1000, previous_close: 26 },
    fear_and_greed_historical: {
      data: [
        { x: 900, y: 30 },
        { x: 800, y: 27 },
        { x: 900, y: 24 },
        { x: 999, y: 101 },
        { x: 3000, y: 30 },
        null,
      ],
    },
  };
  const data = parseMarket(raw, 1_000_000);
  assert.deepEqual(data.history, [
    { value: 27, sourceTimeMs: 800_000 },
    { value: 24, sourceTimeMs: 900_000 },
  ]);
  assert.equal(data.comparisons[0].value, 26);
  assert.equal(data.comparisons[1].value, null);
});

const result = (value: number, sourceTimeMs: number): MarketResult => ({
  ok: true,
  data: {
    sample: { value, sourceTimeMs },
    history: [],
    comparisons: [],
    receivedAt: 10_000_000,
  },
});

test("monitor persists alerts with baseline; duplicates, failures, stale data preserve baseline", () => {
  let state = { ...initialState(), enabled: true };
  let step = applyResult(state, result(26, 9_998_000), 10_000_000, true);
  assert.equal(step.notification, null);
  step = applyResult(step.state, result(24, 9_999_000), 10_000_000, true);
  assert.match(step.notification!, /26 → 24/);
  state = readState(JSON.stringify(step.state));
  assert.equal(state.baseline?.value, 24);
  assert.equal(state.events[0].kind, "alert");
  for (const incoming of [
    result(24, 9_999_000),
    result(23, 9_999_000),
    result(22, 5_000_000),
    { ok: false as const, error: "offline" },
  ]) {
    step = applyResult(state, incoming, 10_000_000, true);
    assert.deepEqual(step.state.baseline, state.baseline);
    assert.equal(step.notification, null);
  }
});

test("stopped/snoozed previews never alert or advance baseline", () => {
  const state = {
    ...initialState(),
    baseline: { value: 26, sourceTimeMs: 9_998_000 },
  };
  const step = applyResult(state, result(24, 9_999_000), 10_000_000, false);
  assert.equal(step.notification, null);
  assert.deepEqual(step.state.baseline, state.baseline);
  assert.equal(step.state.market?.sample.value, 24);
});

test("third consecutive request failure notifies once, success resets; logs bounded", () => {
  let state = initialState();
  for (let i = 1; i <= 205; i++) {
    const step = applyResult(
      state,
      { ok: false, error: "offline" },
      10_000_000 + i,
      true,
    );
    assert.equal(!!step.notification, i === 3);
    state = step.state;
  }
  assert.equal(state.events.length, 200);
  state = applyResult(state, result(24, 9_999_000), 10_000_000, true).state;
  assert.equal(state.failures, 0);
  assert.equal(state.error, null);
  assert.equal(state.nextCheck, 10_900_000);
});

test("invalid persisted state fails visibly, valid settings survive reload", () => {
  const state = {
    ...initialState(),
    interval: 60,
    enabled: true,
    snoozedUntil: 12345,
  };
  assert.deepEqual(readState(JSON.stringify(state)), state);
  assert.throws(() => readState("broken"));
  assert.throws(() => readState(""));
  for (const patch of [
    { interval: 59 },
    { interval: 60.5 },
    { interval: 604801 },
    { baseline: {} },
    { events: [{}] },
    { market: { sample: {} } },
    { version: 2 },
  ])
    assert.throws(() => readState(JSON.stringify({ ...state, ...patch })));
});

test("server transport uses fixed URL, no cache, bounded body, and reports upstream errors", async () => {
  const fixture = readFileSync(
    new URL("../../shared/cnn-response.json", import.meta.url),
    "utf8",
  );
  const fake: typeof fetch = async (url, options) => {
    assert.equal(
      url,
      "https://production.dataviz.cnn.io/index/fearandgreed/graphdata",
    );
    assert.equal(options?.cache, "no-store");
    assert.equal(options?.redirect, "error");
    assert.ok(options?.signal);
    return new Response(fixture);
  };
  assert.equal((await fetchMarket(fake)).ok, true);
  const blocked = await fetchMarket(
    async () => new Response("blocked", { status: 418 }),
  );
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.match(blocked.error, /418/);
  assert.equal(
    (await fetchMarket(async () => new Response("{invalid"))).ok,
    false,
  );
  assert.equal(
    (await fetchMarket(async () => new Response("x".repeat(2_000_001)))).ok,
    false,
  );
  assert.equal(
    (
      await fetchMarket(async () => {
        throw new Error("private upstream details");
      })
    ).ok,
    false,
  );
});
