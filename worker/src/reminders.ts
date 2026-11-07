import type { Env } from "./env.ts";

export interface ClaimedItem {
  key: string;
  text: string;
  startUtc: string;
  deadlineUtc: string;
}

export const LEASE_MS = 10 * 60_000;
export const MAX_ATTEMPTS = 3;
export const MAX_CLAIM = 5;

const ELIGIBLE =
  "deadline_utc >= ?1 AND attempts < ?3 AND (status = 'queued' OR (status = 'claimed' AND claimed_at <= ?2))";

const iso = (ms: number) => new Date(ms).toISOString();

export function sweepStatements(db: D1Database, nowMs: number): D1PreparedStatement[] {
  const now = iso(nowMs);
  const leaseCut = iso(nowMs - LEASE_MS);
  return [
    db
      .prepare("UPDATE reminders SET status = 'expired', updated_at = ?1 WHERE status = 'queued' AND deadline_utc < ?1")
      .bind(now),
    db
      .prepare(
        "UPDATE reminders SET status = 'expired', updated_at = ?1 " +
          "WHERE status = 'claimed' AND claimed_at <= ?2 AND deadline_utc < ?1",
      )
      .bind(now, leaseCut),
    db
      .prepare(
        "UPDATE reminders SET status = 'failed', last_error = 'lease expired after max attempts', updated_at = ?1 " +
          "WHERE status = 'claimed' AND claimed_at <= ?2 AND attempts >= ?3",
      )
      .bind(now, leaseCut, MAX_ATTEMPTS),
  ];
}

interface ClaimedRow {
  key: string;
  text: string;
  start_utc: string;
  deadline_utc: string;
}

export async function claimReminders(env: Env, claimId: string, nowMs: number): Promise<ClaimedItem[]> {
  const now = iso(nowMs);
  const claim = env.DB
    .prepare(
      "UPDATE reminders SET status = 'claimed', claim_id = ?4, claimed_at = ?1, attempts = attempts + 1, updated_at = ?1 " +
        `WHERE key IN (SELECT key FROM reminders WHERE ${ELIGIBLE} ORDER BY start_utc, key LIMIT ?5) ` +
        "RETURNING key, text, start_utc, deadline_utc",
    )
    .bind(now, iso(nowMs - LEASE_MS), MAX_ATTEMPTS, claimId, MAX_CLAIM);
  const results = await env.DB.batch<ClaimedRow>([...sweepStatements(env.DB, nowMs), claim]);
  const rows = results[results.length - 1]?.results ?? [];
  return rows
    .sort((a, b) => a.start_utc.localeCompare(b.start_utc) || a.key.localeCompare(b.key))
    .map((r) => ({ key: r.key, text: r.text, startUtc: r.start_utc, deadlineUtc: r.deadline_utc }));
}
