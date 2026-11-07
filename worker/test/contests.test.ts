import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { ensureSnapshot } from "../src/contests.ts";
import { MIN, NOW, fixtureContests, jsonResponse, metaValue, mockFetch, resetDb } from "./helpers.ts";

beforeEach(resetDb);

const snapshotRow = () =>
  env.DB.prepare("SELECT source, fetched_at, payload FROM contest_snapshot WHERE id = 1").first<{
    source: string;
    fetched_at: string;
    payload: string;
  }>();

const cfResponse = (startSeconds: number) =>
  jsonResponse({
    status: "OK",
    result: [
      { id: 9001, name: "Codeforces Round 9001 (Div. 2)", phase: "BEFORE", durationSeconds: 7200, startTimeSeconds: startSeconds },
      { id: 9000, name: "Codeforces Round 9000 (Div. 2)", phase: "FINISHED", durationSeconds: 7200, startTimeSeconds: 1 },
    ],
  });

describe("ensureSnapshot: clist", () => {
  it("fetches clist when there is no snapshot and stores it", async () => {
    const { fetcher, calls } = mockFetch();
    const result = await ensureSnapshot(env, NOW, fetcher);

    expect(result.fetched).toBe(true);
    expect(result.contests).toHaveLength(fixtureContests.length);
    expect(calls.clist).toHaveLength(1);
    expect(calls.clist[0]!.url).toBe(
      "https://clist.by/api/v4/contest/?resource_id__in=1,2,93,102&start__gt=2026-11-11T13:20:00&order_by=start&limit=100",
    );
    expect(calls.clist[0]!.init?.headers).toEqual({ Authorization: "ApiKey user:key" });

    const row = await snapshotRow();
    expect(row?.source).toBe("clist");
    expect(row?.fetched_at).toBe("2026-11-11T13:20:00.000Z");
    expect(Object.keys(JSON.parse(row!.payload)[0]).sort()).toEqual(["duration", "event", "href", "id", "resource_id", "start"]);
    expect(await metaValue("last_fetch_at")).toBe("2026-11-11T13:20:00.000Z");
    expect(await metaValue("last_fetch_source")).toBe("clist");
    expect(await metaValue("last_fetch_error")).toBeNull();
  });

  it("does not refetch within 60 minutes but does after", async () => {
    const { fetcher, calls } = mockFetch();
    await ensureSnapshot(env, NOW, fetcher);
    const cached = await ensureSnapshot(env, NOW + 59 * MIN, fetcher);
    expect(cached.fetched).toBe(false);
    expect(cached.contests).toHaveLength(fixtureContests.length);
    expect(calls.clist).toHaveLength(1);
    await ensureSnapshot(env, NOW + 60 * MIN, fetcher);
    expect(calls.clist).toHaveLength(2);
  });
});

describe("ensureSnapshot: Codeforces fallback", () => {
  it("falls back when clist returns a non-2xx status", async () => {
    const { fetcher: first } = mockFetch();
    await ensureSnapshot(env, NOW - 2 * 60 * MIN, first);

    const start = Math.floor((NOW + 60 * MIN) / 1000);
    const { fetcher, calls } = mockFetch({ clist: () => new Response("boom", { status: 500 }), codeforces: () => cfResponse(start) });
    const result = await ensureSnapshot(env, NOW, fetcher);

    expect(calls.codeforces).toHaveLength(1);
    expect(calls.codeforces[0]!.url).toBe("https://codeforces.com/api/contest.list?gym=false");
    expect(result.fetched).toBe(true);
    const cf = result.contests.filter((c) => c.resource_id === 1);
    expect(cf).toEqual([
      {
        id: 9001,
        resource_id: 1,
        event: "Codeforces Round 9001 (Div. 2)",
        start: new Date(start * 1000).toISOString().slice(0, 19),
        duration: 7200,
        href: "https://codeforces.com/contests/9001",
      },
    ]);
    expect(result.contests.some((c) => c.resource_id === 2)).toBe(true);
    expect((await snapshotRow())?.source).toBe("codeforces");
    expect(await metaValue("last_fetch_source")).toBe("codeforces");
    expect(await metaValue("last_fetch_error")).toMatch(/clist HTTP 500/);
  });

  it("falls back when clist returns an empty list", async () => {
    const start = Math.floor((NOW + 60 * MIN) / 1000);
    const { fetcher, calls } = mockFetch({ clist: () => jsonResponse({ objects: [] }), codeforces: () => cfResponse(start) });
    const result = await ensureSnapshot(env, NOW, fetcher);
    expect(calls.codeforces).toHaveLength(1);
    expect(result.contests.map((c) => c.href)).toEqual(["https://codeforces.com/contests/9001"]);
    expect(await metaValue("last_fetch_error")).toMatch(/no contests/);
  });
});

describe("ensureSnapshot: total failure", () => {
  it("keeps the old snapshot and records last_fetch_error", async () => {
    const { fetcher: ok } = mockFetch();
    await ensureSnapshot(env, NOW - 2 * 60 * MIN, ok);
    const before = await snapshotRow();

    const { fetcher } = mockFetch({ clist: () => new Response("x", { status: 502 }) });
    const result = await ensureSnapshot(env, NOW, fetcher);

    expect(result.fetched).toBe(false);
    expect(result.contests).toHaveLength(fixtureContests.length);
    expect(await snapshotRow()).toEqual(before);
    const error = await metaValue("last_fetch_error");
    expect(error).toMatch(/clist HTTP 502/);
    expect(error).toMatch(/codeforces/);
  });

  it("returns no contests when nothing was ever fetched", async () => {
    const { fetcher } = mockFetch({ clist: () => new Response("x", { status: 500 }) });
    const result = await ensureSnapshot(env, NOW, fetcher);
    expect(result).toMatchObject({ contests: [], fetched: false });
    expect(await snapshotRow()).toBeNull();
  });

  it("clears the error after a later successful fetch", async () => {
    const { fetcher: bad } = mockFetch({ clist: () => new Response("x", { status: 500 }) });
    await ensureSnapshot(env, NOW, bad);
    expect(await metaValue("last_fetch_error")).not.toBeNull();
    const { fetcher: good } = mockFetch();
    await ensureSnapshot(env, NOW + 5 * MIN, good);
    expect(await metaValue("last_fetch_error")).toBeNull();
  });
});
