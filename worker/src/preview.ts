import { formatReminder, formatTime, istClock, utcMs } from "./core/format.ts";
import { selectContests } from "./core/select.ts";
import { rules, tipRules } from "./config.ts";
import { ensureSnapshot } from "./contests.ts";
import type { Env, Fetcher } from "./env.ts";
import { loadOverrides } from "./tips.ts";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const IST_OFFSET_MS = 330 * 60_000;
const PREVIEW_LIMIT = 10;
const SEPARATOR = "\n\n----------------------------------------\n\n";

function formatIst(ms: number): string {
  const d = new Date(ms + IST_OFFSET_MS);
  const { h, m } = istClock(ms);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${formatTime(h, m)} IST`;
}

export async function renderPreview(env: Env, nowMs: number, fetcher: Fetcher): Promise<string> {
  const { contests } = await ensureSnapshot(env, nowMs, fetcher);
  const upcoming = selectContests(contests, rules)
    .map((c) => ({ c, sendAt: utcMs(c.start) - rules.leadMinutes * 60_000, start: utcMs(c.start) }))
    .filter(({ start }) => start - rules.minLeadMinutes * 60_000 > nowMs)
    .sort((a, b) => a.sendAt - b.sendAt)
    .slice(0, PREVIEW_LIMIT);
  if (upcoming.length === 0) return "No upcoming reminders.\n";
  const overrides = await loadOverrides(env);
  return (
    upcoming
      .map(({ c, sendAt }, i) => `#${i + 1}  sends ${formatIst(sendAt)}\n\n${formatReminder(c, tipRules, overrides)}`)
      .join(SEPARATOR) + "\n"
  );
}
