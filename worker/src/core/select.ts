import { type Contest, PLATFORM, hhmmToMinutes, istClock, utcMs } from "./format.ts";

export interface Rules {
  include: Record<string, string[]>;
  maxDurationHours: number;
  istWindow?: [string, string];
  mergeCodeforcesDivs: boolean;
  leadMinutes: number;
  minLeadMinutes: number;
}

const PURE_DIV = { 1: /Div\.\s*1(?!\s*\+)\b/, 2: /Div\.\s*2\b/ } as const;
const COMBINED_DIV = /Div\.\s*1\s*\+/;

function isPureDiv(c: Contest, div: 1 | 2): boolean {
  return c.resource_id === 1 && PURE_DIV[div].test(c.event) && !COMBINED_DIV.test(c.event);
}

function matchesRules(c: Contest, rules: Rules): boolean {
  const platform = PLATFORM[c.resource_id];
  if (!platform || c.duration > rules.maxDurationHours * 3600) return false;
  const patterns = rules.include[platform] ?? [];
  if (!patterns.some((p) => new RegExp(p, "i").test(c.event))) return false;
  if (!rules.istWindow) return true;
  const { h, m } = istClock(utcMs(c.start));
  const t = h * 60 + m;
  return t >= hhmmToMinutes(rules.istWindow[0]) && t < hhmmToMinutes(rules.istWindow[1]);
}

function mergeCodeforcesDivs(contests: Contest[]): Contest[] {
  const hasTwin = (c: Contest, div: 1 | 2) => contests.some((o) => o !== c && o.start === c.start && isPureDiv(o, div));
  return contests.flatMap((c) => {
    if (isPureDiv(c, 1) && hasTwin(c, 2)) return [];
    if (isPureDiv(c, 2) && hasTwin(c, 1)) return [{ ...c, event: c.event.replace(PURE_DIV[2], "Div. 1 + Div. 2") }];
    return [c];
  });
}

export function selectContests(list: readonly Contest[], rules: Rules): Contest[] {
  const kept = list.filter((c) => matchesRules(c, rules));
  return rules.mergeCodeforcesDivs ? mergeCodeforcesDivs(kept) : kept;
}

export const reminderKey = (c: Contest): string =>
  `${c.resource_id}|${c.href}|${new Date(utcMs(c.start)).toISOString()}`;

export function dueReminders(list: readonly Contest[], rules: Rules, nowMs: number): Contest[] {
  return selectContests(list, rules).filter((c) => {
    const start = utcMs(c.start);
    return nowMs >= start - rules.leadMinutes * 60_000 && nowMs <= start - rules.minLeadMinutes * 60_000;
  });
}
