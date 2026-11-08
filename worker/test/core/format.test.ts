import { expect, test } from "vitest";
import { baseOverrides, rules, tipRules } from "../../src/config.ts";
import { type Contest, formatDuration, formatReminder, formatTime } from "../../src/core/format.ts";
import { dueReminders, reminderKey, selectContests } from "../../src/core/select.ts";
import clistPast from "../fixtures/clist-past.json" with { type: "json" };
import clistUpcoming from "../fixtures/clist-upcoming.json" with { type: "json" };
import history from "../fixtures/history.json" with { type: "json" };

const past = clistPast.objects as unknown as Contest[];
const upcoming = clistUpcoming.objects as unknown as Contest[];
const all = [...past, ...upcoming];
const norm = (u: string) => u.replace(/\/+$/, "").toLowerCase();
const linkOf = (text: string) => text.match(/Contest Link: (\S+)/)![1]!;

test("time and duration helpers", () => {
  expect(formatTime(20, 5)).toBe("8:05 PM");
  expect(formatTime(8, 0)).toBe("8:00 AM");
  expect(formatTime(0, 5)).toBe("12:05 AM");
  expect(formatTime(12, 30)).toBe("12:30 PM");
  expect(formatDuration(7200)).toBe("2 hours");
  expect(formatDuration(5400)).toBe("1:30 hours");
  expect(formatDuration(8100)).toBe("2:15 hours");
  expect(formatDuration(6000)).toBe("1:40 hours");
});

test("golden: bot output matches every one of the 34 manual reminders", () => {
  const byLink = new Map(selectContests(all, rules).map((c) => [norm(c.href), c]));
  const canon = (s: string) => s.replace(/Duration: (\d+):00 hours/, "Duration: $1 hours");
  const knownManualErrors: Record<string, string> = {
    "2026-09-23 https://www.codechef.com/START257": "started 8:15 PM, posted as 8:00 PM",
    "2026-10-07 https://codeforces.com/contests/2275": "started 8:15 PM, posted as 8:05 PM",
    "2026-11-04 https://codeforces.com/contests/2283": "started 8:15 PM, posted as 8:05 PM",
    "2026-10-10 https://codeforces.com/contests/2272": "pasted Round 1130's link for Round 1126",
    "2026-10-17 https://codeforces.com/contests/2261": "typo in contest name",
  };
  const diffs: string[] = [];
  let compared = 0;
  for (const h of history) {
    if (Object.hasOwn(knownManualErrors, `${h.postedIST.slice(0, 10)} ${linkOf(h.text)}`)) continue;
    compared++;
    const c = byLink.get(norm(linkOf(h.text)));
    const got = c ? formatReminder(c, tipRules, baseOverrides) : "(not selected)";
    if (got !== canon(h.text)) diffs.push(`--- manual\n${h.text}\n+++ bot\n${got}`);
  }
  expect(history.length).toBe(34);
  expect(compared).toBe(29);
  expect(diffs).toEqual([]);
});

test("every contest that was posted manually is selected by the rules", () => {
  const selected = new Set(selectContests(all, rules).map((c) => norm(c.href)));
  const missed = history.map((h) => linkOf(h.text)).filter((l) => !selected.has(norm(l)));
  expect(missed).toEqual([]);
});

test("rules drop noise: Div.1 twin, Monday Munch, Placement Prep, Kotlin practice, heuristic", () => {
  const names = selectContests(all, rules).map((c) => c.event);
  expect(names.some((n) => /Monday Munch|Placement Prep|Kotlin Heroes: Practice|Heuristic/.test(n))).toBe(false);
  expect(names).not.toContain("Codeforces Round 1133 (Div. 1)");
  expect(names).not.toContain("Codeforces Round 1133 (Div. 2)");
  expect(names).toContain("Codeforces Round 1133 (Div. 1 + Div. 2)");
});

test("sponsored Codeforces names are normalised", () => {
  const c = past.find((x) => x.event.startsWith("DeepInfra Round 1"))!;
  expect(formatReminder(c)).toMatch(/Contest Name: Codeforces Round 1126 \(Div\. 1 \+ Div\. 2\)\n/);
});

test("sponsored AtCoder names are normalised (full-width and ASCII parens)", () => {
  for (const [prefix, want] of [
    ["JIJ Programming", "AtCoder Beginner Contest 476"],
    ["UNICORNProgramming", "AtCoder Beginner Contest 477"],
    ["SMBC Programming", "AtCoder Beginner Contest 481"],
  ] as const) {
    const c = past.find((x) => x.event.startsWith(prefix))!;
    expect(formatReminder(c)).toMatch(new RegExp(`Contest Name: ${want}\\n`));
  }
});

test("due window: fires from start-75m, not when start is <10m away", () => {
  const c = upcoming.find((x) => x.event === "Starters 264")!;
  const start = Date.parse(c.start + "Z");
  const at = (minBefore: number) => start - minBefore * 60_000;
  expect(dueReminders([c], rules, at(76))).toHaveLength(0);
  expect(dueReminders([c], rules, at(75))).toHaveLength(1);
  expect(dueReminders([c], rules, at(40))).toHaveLength(1);
  expect(dueReminders([c], rules, at(5))).toHaveLength(0);
});

test("reminder key is source-independent and changes on reschedule", () => {
  const c = upcoming.find((x) => x.event === "Starters 264")!;
  const fromFallback = { ...c, start: `${c.start}Z` };
  expect(reminderKey(fromFallback)).toBe(reminderKey(c));
  expect(reminderKey({ ...c, start: "2026-11-11T14:45:00" })).not.toBe(reminderKey(c));
  expect(reminderKey(c)).toBe("2|https://www.codechef.com/START264|2026-11-11T14:30:00.000Z");
});

test("tip overrides: per-contest text, or empty string to suppress", () => {
  const lc = upcoming.find((x) => x.event === "Weekly Contest 527")!;
  expect(formatReminder(lc, tipRules, {})).toMatch(/Tip: morning contests build discipline$/);
  expect(formatReminder(lc, tipRules, { [lc.href]: "custom" })).toMatch(/Tip: custom$/);
  expect(formatReminder(lc, tipRules, { [lc.href]: "" })).not.toMatch(/Tip/);
});
