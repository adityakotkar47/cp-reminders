import { type Contest, formatReminder, utcMs } from "./core/format.ts";
import { dueReminders, reminderKey } from "./core/select.ts";
import { rules, tipRules } from "./config.ts";
import { ensureSnapshot } from "./contests.ts";
import type { Env, Fetcher } from "./env.ts";
import { setMeta } from "./meta.ts";
import { sweepStatements } from "./reminders.ts";
import { loadOverrides } from "./tips.ts";
import { maybeWake } from "./wake.ts";

export interface TickResult {
  fetched: boolean;
  queued: number;
  woke: boolean;
  errors: string[];
}

const iso = (ms: number) => new Date(ms).toISOString();

function insertStatement(db: D1Database, c: Contest, text: string, nowMs: number): D1PreparedStatement {
  const startMs = utcMs(c.start);
  return db
    .prepare(
      "INSERT INTO reminders (key, resource_id, href, start_utc, deadline_utc, text, status, created_at, updated_at) " +
        "VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'queued', ?7, ?7) ON CONFLICT(key) DO NOTHING",
    )
    .bind(
      reminderKey(c),
      c.resource_id,
      c.href,
      iso(startMs),
      iso(startMs - rules.minLeadMinutes * 60_000),
      text,
      iso(nowMs),
    );
}

export async function runTick(env: Env, nowMs: number, fetcher: Fetcher): Promise<TickResult> {
  const errors: string[] = [];
  const snapshot = await ensureSnapshot(env, nowMs, fetcher);
  if (snapshot.error) errors.push(`contest fetch: ${snapshot.error}`);

  const due = dueReminders(snapshot.contests, rules, nowMs);
  const overrides = due.length > 0 ? await loadOverrides(env) : {};
  const inserts = due.map((c) => insertStatement(env.DB, c, formatReminder(c, tipRules, overrides), nowMs));

  const sweeps = sweepStatements(env.DB, nowMs);
  const outcomes = await env.DB.batch([
    ...sweeps,
    ...inserts,
    setMeta(env.DB, "last_tick_at", iso(nowMs)),
  ]);
  const queued = outcomes.slice(sweeps.length, sweeps.length + inserts.length).reduce((sum, o) => sum + o.meta.changes, 0);

  const wake = await maybeWake(env, nowMs, fetcher);
  if (wake.error) errors.push(wake.error);
  return { fetched: snapshot.fetched, queued, woke: wake.woke, errors };
}
