import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isoUtc } from "../src/core/format.ts";
import { setMeta } from "../src/meta.ts";
import { MIN, NOW, resetDb, seedReminder } from "./helpers.ts";

beforeEach(async () => {
  await resetDb();
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
});

const badge = () => exports.default.fetch("https://w.test/badge");
const badgeBody = async () => (await badge()).json();
const meta = (key: string, value: string) => setMeta(env.DB, key, value).run();
const tickedMinutesAgo = (minutes: number) => meta("last_tick_at", isoUtc(NOW - minutes * MIN));

describe("GET /badge", () => {
  it("is public and returns a cacheable shields.io endpoint document", async () => {
    await tickedMinutesAgo(3);
    const res = await badge();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/^application\/json/);
    expect(res.headers.get("Cache-Control")).toBe("max-age=300");
    expect(await res.json()).toEqual({ schemaVersion: 1, label: "bot", message: "ok · tick 3m ago", color: "brightgreen" });
  });

  it("is down when the scheduler never ticked", async () => {
    expect(await badgeBody()).toMatchObject({ message: "never ticked", color: "red" });
  });

  it("is down when the last tick is more than 15 minutes old", async () => {
    await tickedMinutesAgo(23);
    expect(await badgeBody()).toMatchObject({ message: "no tick for 23m", color: "red" });
  });

  it("is not down when the last tick is exactly 15 minutes old", async () => {
    await tickedMinutesAgo(15);
    expect(await badgeBody()).toMatchObject({ message: "ok · tick 15m ago", color: "brightgreen" });
  });

  it("is down one second past 15 minutes", async () => {
    await meta("last_tick_at", isoUtc(NOW - 15 * MIN - 1000));
    expect(await badgeBody()).toMatchObject({ message: "no tick for 15m", color: "red" });
  });

  it("is failing when reminders failed or expired in the last 24 hours", async () => {
    await tickedMinutesAgo(3);
    await seedReminder({ key: "f", status: "failed", updated_at: isoUtc(NOW - 60 * MIN) });
    await seedReminder({ key: "e", status: "expired", updated_at: isoUtc(NOW - 23 * 60 * MIN) });
    await seedReminder({ key: "old", status: "failed", updated_at: isoUtc(NOW - 25 * 60 * MIN) });
    expect(await badgeBody()).toMatchObject({ message: "2 missed in 24h", color: "red" });
  });

  it("reports down before failing", async () => {
    await tickedMinutesAgo(30);
    await seedReminder({ key: "f", status: "failed" });
    expect(await badgeBody()).toMatchObject({ message: "no tick for 30m", color: "red" });
  });

  it("is degraded when the last fetch recorded an error", async () => {
    await tickedMinutesAgo(3);
    await meta("last_fetch_error", "clist HTTP 500");
    expect(await badgeBody()).toMatchObject({ message: "degraded: clist", color: "yellow" });
  });

  it("reports failing before degraded", async () => {
    await tickedMinutesAgo(3);
    await meta("last_fetch_error", "clist HTTP 500");
    await seedReminder({ key: "e", status: "expired" });
    expect(await badgeBody()).toMatchObject({ message: "1 missed in 24h", color: "red" });
  });

  it("exposes only the badge fields, never message text, errors or secrets", async () => {
    await tickedMinutesAgo(3);
    await meta("last_fetch_error", "clist HTTP 500 boom detail");
    await seedReminder({ key: "k", text: "TOP SECRET MESSAGE BODY", href: "https://private.test/contest", status: "failed", last_error: "send detail" });
    const raw = await (await badge()).text();
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(["color", "label", "message", "schemaVersion"]);
    for (const leaked of ["TOP SECRET", "private.test", "boom detail", "send detail", env.TICK_TOKEN, env.SENDER_TOKEN, env.ADMIN_TOKEN, env.GH_TOKEN, env.CLIST_API_KEY]) {
      expect(raw).not.toContain(leaked);
    }
  });

  it("rejects non-GET methods", async () => {
    expect((await exports.default.fetch("https://w.test/badge", { method: "POST" })).status).toBe(405);
  });
});
