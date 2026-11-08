import { type Health, readHealth } from "./health.ts";
import { json } from "./http.ts";
import type { Route } from "./router.ts";

const MIN_MS = 60_000;
export const DOWN_AFTER_MS = 15 * MIN_MS;
export const CACHE_CONTROL = "max-age=300";

interface Badge {
  schemaVersion: 1;
  label: "bot";
  message: string;
  color: "red" | "yellow" | "brightgreen";
}

function status(health: Health, nowMs: number): Pick<Badge, "message" | "color"> {
  if (health.lastTickAt === null) return { message: "never ticked", color: "red" };
  const sinceTick = nowMs - Date.parse(health.lastTickAt);
  const minutes = Math.floor(sinceTick / MIN_MS);
  if (sinceTick > DOWN_AFTER_MS) return { message: `no tick for ${minutes}m`, color: "red" };
  if (health.lastWakeError !== null) return { message: "dispatch failing", color: "red" };
  const missed = health.failed24h + health.expired24h;
  if (missed > 0) return { message: `${missed} missed in 24h`, color: "red" };
  if (health.lastFetchError !== null) return { message: "degraded: clist", color: "yellow" };
  return { message: `ok · tick ${minutes}m ago`, color: "brightgreen" };
}

export const badgeRoute: Route = {
  method: "GET",
  path: "/badge",
  async handle({ env, now }) {
    const badge: Badge = { schemaVersion: 1, label: "bot", ...status(await readHealth(env.DB, now), now) };
    return json(badge, 200, CACHE_CONTROL);
  },
};
