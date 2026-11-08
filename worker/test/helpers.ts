import { env } from "cloudflare:workers";
import { rules } from "../src/config.ts";
import { type Contest, isoUtc, utcMs } from "../src/core/format.ts";
import { reminderKey } from "../src/core/select.ts";
import upcoming from "./fixtures/clist-upcoming.json" with { type: "json" };
import type { Fetcher } from "../src/env.ts";

export const MIN = 60_000;

export const fixtureContests = upcoming.objects as unknown as Contest[];

export const STARTERS_264 = fixtureContests.find((c) => c.event === "Starters 264")!;
export const STARTERS_264_START = utcMs(STARTERS_264.start);
export const STARTERS_264_KEY = reminderKey(STARTERS_264);
export const STARTERS_264_DEADLINE = STARTERS_264_START - rules.minLeadMinutes * MIN;
export const NOW = STARTERS_264_START - rules.leadMinutes * MIN;

interface Call {
  url: string;
  init?: RequestInit;
}

interface MockOptions {
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

export async function resetDb(): Promise<void> {
  await env.DB.batch(
    ["contest_snapshot", "reminders", "tip_overrides", "meta"].map((table) => env.DB.prepare(`DELETE FROM ${table}`)),
  );
}

interface ReminderRow {
  key: string;
  resource_id: number;
  href: string;
  start_utc: string;
  deadline_utc: string;
  text: string;
  status: string;
  attempts: number;
  claim_id: string | null;
  claimed_at: string | null;
  message_id: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
}

export async function seedReminder(overrides: Partial<ReminderRow> & { key: string }): Promise<void> {
  const row: ReminderRow = {
    resource_id: 2,
    href: `https://example.test/${overrides.key}`,
    start_utc: isoUtc(NOW + 70 * MIN),
    deadline_utc: isoUtc(NOW + 60 * MIN),
    text: `text for ${overrides.key}`,
    status: "queued",
    attempts: 0,
    claim_id: null,
    claimed_at: null,
    message_id: null,
    last_error: null,
    created_at: isoUtc(NOW),
    updated_at: isoUtc(NOW),
    sent_at: null,
    ...overrides,
  };
  await env.DB.prepare(
    "INSERT INTO reminders (key, resource_id, href, start_utc, deadline_utc, text, status, attempts, claim_id, claimed_at, message_id, last_error, created_at, updated_at, sent_at) " +
      "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
  )
    .bind(
      row.key, row.resource_id, row.href, row.start_utc, row.deadline_utc, row.text, row.status, row.attempts,
      row.claim_id, row.claimed_at, row.message_id, row.last_error, row.created_at, row.updated_at, row.sent_at,
    )
    .run();
}

export async function getReminder(key: string): Promise<ReminderRow | null> {
  return env.DB.prepare("SELECT * FROM reminders WHERE key = ?1").bind(key).first<ReminderRow>();
}
