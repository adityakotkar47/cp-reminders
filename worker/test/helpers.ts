import { env } from "cloudflare:workers";
import type { Contest } from "../../src/format.ts";
import upcoming from "../../fixtures/clist-upcoming.json" with { type: "json" };
import type { Fetcher } from "../src/env.ts";

export const MIN = 60_000;
export const NOW = Date.parse("2026-11-11T13:20:00Z");
export const STARTERS_264_KEY = "2|https://www.codechef.com/START264|2026-11-11T14:30:00.000Z";

export const fixtureContests = upcoming.objects as unknown as Contest[];

export interface Call {
  url: string;
  init?: RequestInit;
}

export interface MockOptions {
  clist?: () => Response;
  codeforces?: () => Response;
  github?: () => Response;
}

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export function mockFetch(options: MockOptions = {}) {
  const calls = { clist: [] as Call[], codeforces: [] as Call[], github: [] as Call[] };
  const fetcher: Fetcher = async (url, init) => {
    if (url.startsWith("https://clist.by/")) {
      calls.clist.push({ url, init });
      return (options.clist ?? (() => jsonResponse({ objects: fixtureContests })))();
    }
    if (url.startsWith("https://codeforces.com/api/")) {
      calls.codeforces.push({ url, init });
      return (options.codeforces ?? (() => jsonResponse({ status: "FAILED", comment: "down" }, 503)))();
    }
    if (url.startsWith("https://api.github.com/")) {
      calls.github.push({ url, init });
      return (options.github ?? (() => new Response(null, { status: 204 })))();
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  return { fetcher, calls };
}

export async function metaValue(key: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT v FROM meta WHERE k = ?").bind(key).first<{ v: string }>();
  return row?.v ?? null;
}

export async function resetDb(): Promise<void> {
  await env.DB.batch(
    ["contest_snapshot", "reminders", "tip_overrides", "meta"].map((table) => env.DB.prepare(`DELETE FROM ${table}`)),
  );
}
