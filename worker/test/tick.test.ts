import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { runTick } from "../src/tick.ts";
import {
  MIN,
  NOW,
  STARTERS_264_KEY,
  fixtureContests,
  getReminder,
  jsonResponse,
  metaValue,
  mockFetch,
  resetDb,
  seedReminder,
} from "./helpers.ts";

beforeEach(resetDb);

const iso = (ms: number) => new Date(ms).toISOString();
const count = async (where = "1 = 1") =>
  (await env.DB.prepare(`SELECT COUNT(*) AS n FROM reminders WHERE ${where}`).first<{ n: number }>())!.n;

describe("runTick: queueing", () => {
  it("queues a due reminder with its rendered text and deadline", async () => {
    const { fetcher } = mockFetch();
    const result = await runTick(env, NOW, fetcher);

    expect(result).toMatchObject({ fetched: true, queued: 1 });
    const row = await getReminder(STARTERS_264_KEY);
    expect(row).toMatchObject({
      resource_id: 2,
      href: "https://www.codechef.com/START264",
      start_utc: "2026-11-11T14:30:00.000Z",
      deadline_utc: "2026-11-11T14:20:00.000Z",
      status: "queued",
      attempts: 0,
      created_at: iso(NOW),
    });
    expect(row?.text).toBe(
      [
        "🚨 Contest Reminder 🚨",
        "",
        "📍 Platform: Codechef",
        "🏆 Contest Name: Starters 264",
        "🕒 Timing: 8:00 PM",
        "⏳ Duration: 2 hours",
        "🔗 Contest Link: https://www.codechef.com/START264",
      ].join("\n"),
    );
  });

  it("queues nothing outside the send window", async () => {
    const { fetcher } = mockFetch();
    expect((await runTick(env, NOW - 30 * MIN, fetcher)).queued).toBe(0);
    expect((await runTick(env, Date.parse("2026-11-11T14:25:00Z"), fetcher)).queued).toBe(0);
    expect(await count()).toBe(0);
  });

  it("is idempotent across ticks", async () => {
    const { fetcher } = mockFetch();
    const first = await runTick(env, NOW, fetcher);
    const second = await runTick(env, NOW + 5 * MIN, fetcher);
    expect([first.queued, second.queued]).toEqual([1, 0]);
    expect(await count()).toBe(1);
  });

  it("is idempotent under two overlapping ticks", async () => {
    const { fetcher } = mockFetch();
    const [a, b] = await Promise.all([runTick(env, NOW, fetcher), runTick(env, NOW, fetcher)]);
    expect(a.queued + b.queued).toBe(1);
    expect(await count()).toBe(1);
  });

  it("does not requeue a reminder that was already sent", async () => {
    await seedReminder({ key: STARTERS_264_KEY, status: "sent", attempts: 1, text: "original" });
    const { fetcher } = mockFetch();
    expect((await runTick(env, NOW, fetcher)).queued).toBe(0);
    expect(await getReminder(STARTERS_264_KEY)).toMatchObject({ status: "sent", text: "original" });
  });

  it("gives a rescheduled contest a new reminder", async () => {
    const moved = fixtureContests.map((c) => (c.href.endsWith("START264") ? { ...c, start: "2026-11-11T14:45:00" } : c));
    await seedReminder({ key: STARTERS_264_KEY, status: "sent", attempts: 1 });
    const { fetcher } = mockFetch({ clist: () => jsonResponse({ objects: moved }) });
    expect((await runTick(env, NOW + 10 * MIN, fetcher)).queued).toBe(1);
    expect(await count()).toBe(2);
    expect(await getReminder("2|https://www.codechef.com/START264|2026-11-11T14:45:00.000Z")).toMatchObject({
      status: "queued",
    });
  });

  it("keeps queueing from the old snapshot when every source fails", async () => {
    const { fetcher: ok } = mockFetch();
    await runTick(env, NOW - 3 * 60 * MIN, ok);
    const { fetcher } = mockFetch({ clist: () => new Response("x", { status: 500 }) });
    const result = await runTick(env, NOW, fetcher);
    expect(result).toMatchObject({ fetched: false, queued: 1 });
    expect(result.errors.join(" ")).toMatch(/clist HTTP 500/);
  });
});

describe("runTick: tips", () => {
  const link = "https://www.codechef.com/START264";

  it("merges D1 tip overrides into the rendered text", async () => {
    await env.DB.prepare("INSERT INTO tip_overrides (href, tip, updated_at) VALUES (?1, 'bring snacks', ?2)")
      .bind(link, iso(NOW))
      .run();
    const { fetcher } = mockFetch();
    await runTick(env, NOW, fetcher);
    expect((await getReminder(STARTERS_264_KEY))?.text).toMatch(/\n\n📌 Tip: bring snacks$/);
  });

  it("treats an empty override as suppressing the tip", async () => {
    await env.DB.prepare("INSERT INTO tip_overrides (href, tip, updated_at) VALUES (?1, '', ?2)").bind(link, iso(NOW)).run();
    const { fetcher } = mockFetch();
    await runTick(env, NOW, fetcher);
    expect((await getReminder(STARTERS_264_KEY))?.text).not.toContain("Tip");
  });
});

describe("runTick: housekeeping and wake", () => {
  it("expires reminders whose deadline passed", async () => {
    await seedReminder({ key: "late", deadline_utc: iso(NOW - MIN), start_utc: iso(NOW + 9 * MIN) });
    const { fetcher } = mockFetch();
    await runTick(env, NOW, fetcher);
    expect((await getReminder("late"))?.status).toBe("expired");
  });

  it("records last_tick_at", async () => {
    const { fetcher } = mockFetch();
    await runTick(env, NOW, fetcher);
    expect(await metaValue("last_tick_at")).toBe(iso(NOW));
  });

  it("wakes the workflow once for a new reminder and debounces the next tick", async () => {
    const { fetcher, calls } = mockFetch();
    const first = await runTick(env, NOW, fetcher);
    const second = await runTick(env, NOW + 2 * MIN, fetcher);
    expect([first.woke, second.woke]).toEqual([true, false]);
    expect(calls.github).toHaveLength(1);
  });

  it("does not wake when nothing is pending", async () => {
    const { fetcher, calls } = mockFetch();
    const result = await runTick(env, NOW - 30 * MIN, fetcher);
    expect(result.woke).toBe(false);
    expect(calls.github).toHaveLength(0);
  });

  it("keeps the reminder queued and retries the wake when dispatch fails", async () => {
    const bad = mockFetch({ github: () => new Response("down", { status: 502 }) });
    const first = await runTick(env, NOW, bad.fetcher);
    expect(first).toMatchObject({ queued: 1, woke: false });
    expect(first.errors.join(" ")).toMatch(/dispatch HTTP 502/);
    expect(await metaValue("last_wake_at")).toBeNull();

    const good = mockFetch();
    const second = await runTick(env, NOW + MIN, good.fetcher);
    expect(second).toMatchObject({ queued: 0, woke: true });
    expect(good.calls.github).toHaveLength(1);
  });
});
