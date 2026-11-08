import { isoUtc } from "./core/format.ts";
import { json } from "./http.ts";
import { getAllMeta } from "./meta.ts";
import type { Route } from "./router.ts";

const DAY_MS = 24 * 3600_000;

interface Counts {
  queued: number | null;
  claimed: number | null;
  failed24h: number | null;
  expired24h: number | null;
}

export const healthRoute: Route = {
  method: "GET",
  path: "/health",
  async handle({ env, now }) {
    const since = isoUtc(now - DAY_MS);
    const [counts, meta] = await Promise.all([
      env.DB
        .prepare(
          "SELECT " +
            "SUM(status = 'queued') AS queued, " +
            "SUM(status = 'claimed') AS claimed, " +
            "SUM(status = 'failed' AND updated_at >= ?1) AS failed24h, " +
            "SUM(status = 'expired' AND updated_at >= ?1) AS expired24h " +
            "FROM reminders",
        )
        .bind(since)
        .first<Counts>(),
      getAllMeta(env.DB),
    ]);
    return json({
      lastTickAt: meta.get("last_tick_at") ?? null,
      lastFetchAt: meta.get("last_fetch_at") ?? null,
      lastFetchSource: meta.get("last_fetch_source") ?? null,
      lastFetchError: meta.get("last_fetch_error") ?? null,
      queued: counts?.queued ?? 0,
      claimed: counts?.claimed ?? 0,
      failed24h: counts?.failed24h ?? 0,
      expired24h: counts?.expired24h ?? 0,
    });
  },
};
