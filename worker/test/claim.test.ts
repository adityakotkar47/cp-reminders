import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { claimReminders } from "../src/reminders.ts";
import { MIN, NOW, getReminder, resetDb, seedReminder } from "./helpers.ts";

beforeEach(resetDb);

const iso = (ms: number) => new Date(ms).toISOString();

describe("claimReminders", () => {
  it("claims queued reminders and returns key, text, startUtc and deadlineUtc", async () => {
    await seedReminder({ key: "a", start_utc: iso(NOW + 70 * MIN), deadline_utc: iso(NOW + 60 * MIN) });
    const items = await claimReminders(env, "claim-1", NOW);

    expect(items).toEqual([
      { key: "a", text: "text for a", startUtc: iso(NOW + 70 * MIN), deadlineUtc: iso(NOW + 60 * MIN) },
    ]);
    expect(await getReminder("a")).toMatchObject({
      status: "claimed",
      claim_id: "claim-1",
      claimed_at: iso(NOW),
      attempts: 1,
      updated_at: iso(NOW),
    });
  });

  it("returns an empty list when nothing is pending", async () => {
    expect(await claimReminders(env, "claim-1", NOW)).toEqual([]);
  });

  it("claims at most 5 per call, earliest start first", async () => {
    for (let i = 0; i < 7; i++) {
      await seedReminder({ key: `r${i}`, start_utc: iso(NOW + (100 - i) * MIN), deadline_utc: iso(NOW + (90 - i) * MIN) });
    }
    const items = await claimReminders(env, "c", NOW);
    expect(items.map((i) => i.key)).toEqual(["r6", "r5", "r4", "r3", "r2"]);
    const rest = await claimReminders(env, "c2", NOW);
    expect(rest.map((i) => i.key)).toEqual(["r1", "r0"]);
  });

  it("does not hand out a reminder whose lease is still valid", async () => {
    await seedReminder({ key: "a" });
    await claimReminders(env, "first", NOW);
    expect(await claimReminders(env, "second", NOW + 9 * MIN)).toEqual([]);
    expect(await getReminder("a")).toMatchObject({ claim_id: "first", attempts: 1 });
  });

  it("re-claims a reminder after its 10 minute lease expires", async () => {
    await seedReminder({ key: "a" });
    await claimReminders(env, "first", NOW);
    const items = await claimReminders(env, "second", NOW + 10 * MIN);
    expect(items.map((i) => i.key)).toEqual(["a"]);
    expect(await getReminder("a")).toMatchObject({ status: "claimed", claim_id: "second", attempts: 2 });
  });

  it("two overlapping claims never receive the same reminder", async () => {
    for (let i = 0; i < 8; i++) await seedReminder({ key: `r${i}`, start_utc: iso(NOW + (100 + i) * MIN), deadline_utc: iso(NOW + (90 + i) * MIN) });
    const [a, b] = await Promise.all([claimReminders(env, "A", NOW), claimReminders(env, "B", NOW)]);
    const keys = [...a, ...b].map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(8);
  });

  it("expires queued reminders past their deadline instead of handing them out", async () => {
    await seedReminder({ key: "late", start_utc: iso(NOW + 5 * MIN), deadline_utc: iso(NOW - 5 * MIN) });
    expect(await claimReminders(env, "c", NOW)).toEqual([]);
    expect(await getReminder("late")).toMatchObject({ status: "expired", attempts: 0 });
  });

  it("expires a claimed reminder whose lease ran out after the deadline", async () => {
    await seedReminder({
      key: "stuck",
      status: "claimed",
      attempts: 1,
      claim_id: "old",
      claimed_at: iso(NOW - 20 * MIN),
      start_utc: iso(NOW + 5 * MIN),
      deadline_utc: iso(NOW - 5 * MIN),
    });
    expect(await claimReminders(env, "c", NOW)).toEqual([]);
    expect(await getReminder("stuck")).toMatchObject({ status: "expired", claim_id: "old" });
  });

  it("leaves a claimed reminder with a valid lease alone even past its deadline", async () => {
    await seedReminder({
      key: "inflight",
      status: "claimed",
      attempts: 1,
      claim_id: "old",
      claimed_at: iso(NOW - 2 * MIN),
      start_utc: iso(NOW + 5 * MIN),
      deadline_utc: iso(NOW - 1 * MIN),
    });
    expect(await claimReminders(env, "c", NOW)).toEqual([]);
    expect(await getReminder("inflight")).toMatchObject({ status: "claimed", claim_id: "old" });
  });

  it("marks a reminder failed when its lease expires after the third attempt", async () => {
    await seedReminder({
      key: "worn",
      status: "claimed",
      attempts: 3,
      claim_id: "old",
      claimed_at: iso(NOW - 11 * MIN),
    });
    expect(await claimReminders(env, "c", NOW)).toEqual([]);
    expect(await getReminder("worn")).toMatchObject({ status: "failed" });
    expect((await getReminder("worn"))?.last_error).toMatch(/lease expired/);
  });

  it("never touches sent, failed or expired reminders", async () => {
    for (const status of ["sent", "failed", "expired"]) await seedReminder({ key: status, status, attempts: 1 });
    expect(await claimReminders(env, "c", NOW)).toEqual([]);
    for (const status of ["sent", "failed", "expired"]) expect((await getReminder(status))?.status).toBe(status);
  });
});
