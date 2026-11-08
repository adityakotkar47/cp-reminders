import { createExecutionContext, createScheduledController, waitOnExecutionContext } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index.ts";
import { getMeta } from "../src/meta.ts";
import { NOW, mockFetch, resetDb } from "./helpers.ts";

beforeEach(async () => {
  await resetDb();
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function stubNetwork() {
  const mock = mockFetch();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => mock.fetcher(String(input), init));
  return mock.calls;
}

const call = (path: string, init?: RequestInit) => exports.default.fetch(`https://w.test${path}`, init);
const bearer = (token: string): RequestInit => ({ method: "POST", headers: { Authorization: `Bearer ${token}` } });

describe("POST /tick", () => {
  it("rejects missing, wrong and other-role tokens without running a tick", async () => {
    const calls = stubNetwork();
    expect((await call("/tick", { method: "POST" })).status).toBe(401);
    expect((await call("/tick", bearer("wrong"))).status).toBe(401);
    expect((await call("/tick", bearer(env.SENDER_TOKEN))).status).toBe(401);
    expect((await call("/tick", bearer(env.ADMIN_TOKEN))).status).toBe(401);
    expect((await call("/tick?token=tick-secret", { method: "POST" })).status).toBe(401);
    expect(calls.clist).toHaveLength(0);
    expect(await getMeta(env.DB, "last_tick_at")).toBeNull();
  });

  it("runs a tick and returns fetched, queued and woke", async () => {
    const calls = stubNetwork();
    const res = await call("/tick", bearer(env.TICK_TOKEN));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/application\/json/);
    expect(await res.json()).toMatchObject({ fetched: true, queued: 1, woke: true });
    expect(calls.clist).toHaveLength(1);
    expect(calls.github).toHaveLength(1);
    expect(await getMeta(env.DB, "last_tick_at")).toBe(new Date(NOW).toISOString());
  });

  it("rejects GET on /tick with 405", async () => {
    expect((await call("/tick", { headers: { Authorization: `Bearer ${env.TICK_TOKEN}` } })).status).toBe(405);
  });
});

describe("routing", () => {
  it("returns 404 for unknown paths", async () => {
    expect((await call("/nope")).status).toBe(404);
  });
});

describe("scheduled handler", () => {
  it("runs a tick on the cron trigger", async () => {
    stubNetwork();
    const ctx = createExecutionContext();
    await worker.scheduled!(createScheduledController({ scheduledTime: NOW, cron: "*/5 * * * *" }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(await getMeta(env.DB, "last_tick_at")).toBe(new Date(NOW).toISOString());
  });
});
