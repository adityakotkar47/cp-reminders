import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { maybeWake } from "../src/wake.ts";
import { MIN, NOW, jsonResponse, metaValue, mockFetch, resetDb, seedReminder } from "./helpers.ts";

beforeEach(resetDb);

const iso = (ms: number) => new Date(ms).toISOString();
const setLastWake = (ms: number) =>
  env.DB.prepare("INSERT INTO meta (k, v) VALUES ('last_wake_at', ?1)").bind(iso(ms)).run();

describe("maybeWake", () => {
  it("does not wake when the outbox is empty", async () => {
    const { fetcher, calls } = mockFetch();
    expect(await maybeWake(env, NOW, fetcher)).toEqual({ woke: false });
    expect(calls.github).toHaveLength(0);
    expect(await metaValue("last_wake_at")).toBeNull();
  });

  it("dispatches send.yml with only a ref and records last_wake_at after a 204", async () => {
    await seedReminder({ key: "a" });
    const { fetcher, calls } = mockFetch();
    expect(await maybeWake(env, NOW, fetcher)).toEqual({ woke: true });

    expect(calls.github).toHaveLength(1);
    const call = calls.github[0]!;
    expect(call.url).toBe("https://api.github.com/repos/adityakotkar47/cp-reminders/actions/workflows/send.yml/dispatches");
    expect(call.init?.method).toBe("POST");
    expect(JSON.parse(String(call.init?.body))).toEqual({ ref: "main" });
    const headers = call.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer ghp_test");
    expect(headers.Accept).toBe("application/vnd.github+json");
    expect(headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
    expect(headers["User-Agent"]).toBeTruthy();
    expect(await metaValue("last_wake_at")).toBe(iso(NOW));
  });

  it("treats a 200 response with a run id as success", async () => {
    await seedReminder({ key: "a" });
    const { fetcher } = mockFetch({ github: () => jsonResponse({ workflow_run_id: 1, run_url: "u", html_url: "h" }) });
    expect(await maybeWake(env, NOW, fetcher)).toEqual({ woke: true });
    expect(await metaValue("last_wake_at")).toBe(iso(NOW));
  });

  it.each([401, 403, 404, 422, 500, 503])("does not record last_wake_at after HTTP %i", async (status) => {
    await seedReminder({ key: "a" });
    const { fetcher } = mockFetch({ github: () => new Response("nope", { status }) });
    const result = await maybeWake(env, NOW, fetcher);
    expect(result.woke).toBe(false);
    expect(result.error).toContain(String(status));
    expect(await metaValue("last_wake_at")).toBeNull();
  });

  it("does not record last_wake_at when the request itself throws", async () => {
    await seedReminder({ key: "a" });
    const result = await maybeWake(env, NOW, async () => {
      throw new Error("network down");
    });
    expect(result).toEqual({ woke: false, error: "network down" });
    expect(await metaValue("last_wake_at")).toBeNull();
  });

  it("debounces wakes within 4 minutes", async () => {
    await seedReminder({ key: "a" });
    await setLastWake(NOW - 3 * MIN);
    const { fetcher, calls } = mockFetch();
    expect(await maybeWake(env, NOW, fetcher)).toEqual({ woke: false });
    expect(calls.github).toHaveLength(0);
    expect(await maybeWake(env, NOW + 1 * MIN, fetcher)).toEqual({ woke: true });
    expect(calls.github).toHaveLength(1);
  });

  it("wakes for a claimed reminder whose lease expired but not for one in flight", async () => {
    await seedReminder({ key: "inflight", status: "claimed", attempts: 1, claim_id: "c", claimed_at: iso(NOW - 2 * MIN) });
    const { fetcher, calls } = mockFetch();
    expect(await maybeWake(env, NOW, fetcher)).toEqual({ woke: false });
    await seedReminder({ key: "stale", status: "claimed", attempts: 1, claim_id: "c", claimed_at: iso(NOW - 11 * MIN) });
    expect(await maybeWake(env, NOW, fetcher)).toEqual({ woke: true });
    expect(calls.github).toHaveLength(1);
  });

  it("does not wake for reminders that are terminal, exhausted or past their deadline", async () => {
    await seedReminder({ key: "s", status: "sent" });
    await seedReminder({ key: "f", status: "failed" });
    await seedReminder({ key: "e", status: "expired" });
    await seedReminder({ key: "late", deadline_utc: iso(NOW - MIN) });
    await seedReminder({ key: "worn", status: "claimed", attempts: 3, claim_id: "c", claimed_at: iso(NOW - 11 * MIN) });
    const { fetcher, calls } = mockFetch();
    expect(await maybeWake(env, NOW, fetcher)).toEqual({ woke: false });
    expect(calls.github).toHaveLength(0);
  });
});
