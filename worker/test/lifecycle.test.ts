import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { isoUtc } from "../src/core/format.ts";
import { MIN, NOW, STARTERS_264_KEY, getReminder, mockFetch, resetDb, seedReminder } from "./helpers.ts";

beforeEach(async () => {
  await resetDb();
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  const mock = mockFetch();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => mock.fetcher(String(input), init));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const api = (method: string, path: string, token: string, body?: unknown) =>
  exports.default.fetch(`https://w.test${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

it("tick -> claim -> failed ack -> reclaim -> sent ack, with a lost sender in between", async () => {
  expect((await (await api("POST", "/tick", env.TICK_TOKEN)).json())).toMatchObject({ queued: 1, woke: true });

  const first = (await (await api("POST", "/outbox/claim", env.SENDER_TOKEN, { claimId: "run-1" })).json()) as {
    items: { key: string }[];
  };
  expect(first.items.map((i) => i.key)).toEqual([STARTERS_264_KEY]);

  vi.setSystemTime(NOW + 11 * MIN);
  const second = (await (await api("POST", "/outbox/claim", env.SENDER_TOKEN, { claimId: "run-2" })).json()) as {
    items: { key: string }[];
  };
  expect(second.items).toHaveLength(1);
  expect(await getReminder(STARTERS_264_KEY)).toMatchObject({ claim_id: "run-2", attempts: 2 });

  const stale = await api("POST", "/outbox/ack", env.SENDER_TOKEN, {
    claimId: "run-1",
    results: [{ key: STARTERS_264_KEY, status: "sent", messageId: "late" }],
  });
  expect(await stale.json()).toEqual({ applied: 0 });

  const fresh = await api("POST", "/outbox/ack", env.SENDER_TOKEN, {
    claimId: "run-2",
    results: [{ key: STARTERS_264_KEY, status: "sent", messageId: "WAMID.OK" }],
  });
  expect(await fresh.json()).toEqual({ applied: 1 });

  const health = await (await exports.default.fetch("https://w.test/health")).json();
  expect(health).toMatchObject({ queued: 0, claimed: 0 });
  expect(await getReminder(STARTERS_264_KEY)).toMatchObject({ status: "sent", message_id: "WAMID.OK" });
});

it("a reminder whose sender never acks ends failed after three attempts", async () => {
  await seedReminder({ key: "unacked", start_utc: isoUtc(NOW + 120 * MIN), deadline_utc: isoUtc(NOW + 110 * MIN) });
  for (const attempt of [1, 2, 3]) {
    vi.setSystemTime(NOW + (attempt - 1) * 11 * MIN);
    const res = (await (await api("POST", "/outbox/claim", env.SENDER_TOKEN, { claimId: `run-${attempt}` })).json()) as {
      items: unknown[];
    };
    expect(res.items).toHaveLength(1);
  }
  vi.setSystemTime(NOW + 33 * MIN);
  const none = (await (await api("POST", "/outbox/claim", env.SENDER_TOKEN, { claimId: "run-4" })).json()) as {
    items: unknown[];
  };
  expect(none.items).toEqual([]);
  expect(await getReminder("unacked")).toMatchObject({ status: "failed", attempts: 3 });
  const health = await (await exports.default.fetch("https://w.test/health")).json();
  expect(health).toMatchObject({ failed24h: 1, queued: 0, claimed: 0 });
});
