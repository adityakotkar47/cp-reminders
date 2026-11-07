import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { type Contest, formatReminder, formatDuration, formatTime } from "../src/format.ts";
import { selectContests, dueReminders, reminderKey, type Rules } from "../src/select.ts";

const load = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const rules: Rules = load("../config/rules.json");
const tips = load("../config/tips.json");
const past: Contest[] = load("../fixtures/clist-past.json").objects;
const upcoming: Contest[] = load("../fixtures/clist-upcoming.json").objects;
const history: { postedIST: string; text: string }[] = load("../fixtures/history.json");
const all = [...past, ...upcoming];
const norm = (u: string) => u.replace(/\/+$/, "").toLowerCase();
const linkOf = (text: string) => text.match(/Contest Link: (\S+)/)![1];

test("time and duration helpers", () => {
  assert.equal(formatTime(20, 5), "8:05 PM");
  assert.equal(formatTime(8, 0), "8:00 AM");
  assert.equal(formatTime(0, 5), "12:05 AM");
  assert.equal(formatTime(12, 30), "12:30 PM");
  assert.equal(formatDuration(7200), "2 hours");
  assert.equal(formatDuration(5400), "1:30 hours");
  assert.equal(formatDuration(8100), "2:15 hours");
  assert.equal(formatDuration(6000), "1:40 hours");
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
    const got = c ? formatReminder(c, tips.rules, tips.overrides) : "(not selected)";
    if (got !== canon(h.text)) diffs.push(`--- manual\n${h.text}\n+++ bot\n${got}`);
  }
  assert.equal(history.length, 34);
  assert.equal(compared, 29);
  assert.deepEqual(diffs, []);
});

test("every contest that was posted manually is selected by the rules", () => {
  const selected = new Set(selectContests(all, rules).map((c) => norm(c.href)));
  const missed = history.map((h) => linkOf(h.text)).filter((l) => !selected.has(norm(l)));
  assert.deepEqual(missed, []);
});

test("rules drop noise: Div.1 twin, Monday Munch, Placement Prep, Kotlin practice, heuristic", () => {
  const names = selectContests(all, rules).map((c) => c.event);
  assert.ok(!names.some((n) => /Monday Munch|Placement Prep|Kotlin Heroes: Practice|Heuristic/.test(n)));
  assert.ok(!names.includes("Codeforces Round 1133 (Div. 1)"));
  assert.ok(!names.includes("Codeforces Round 1133 (Div. 2)"));
  assert.ok(names.includes("Codeforces Round 1133 (Div. 1 + Div. 2)"));
});

test("sponsored Codeforces names are normalised", () => {
  const c = past.find((x) => x.event.startsWith("DeepInfra Round 1"))!;
  assert.match(formatReminder(c), /Contest Name: Codeforces Round 1126 \(Div\. 1 \+ Div\. 2\)\n/);
});

test("sponsored AtCoder names are normalised (full-width and ASCII parens)", () => {
  for (const [prefix, want] of [
    ["JIJ Programming", "AtCoder Beginner Contest 476"],
    ["UNICORNProgramming", "AtCoder Beginner Contest 477"],
    ["SMBC Programming", "AtCoder Beginner Contest 481"],
  ]) {
    const c = past.find((x) => x.event.startsWith(prefix))!;
    assert.match(formatReminder(c), new RegExp(`Contest Name: ${want}\\n`));
  }
});

test("due window: fires from start-75m, never twice, not when start is <10m away", () => {
  const c = upcoming.find((x) => x.event === "Starters 264")!;
  const start = Date.parse(c.start + "Z");
  const at = (minBefore: number) => start - minBefore * 60_000;
  assert.equal(dueReminders([c], rules, at(76)).length, 0);
  assert.equal(dueReminders([c], rules, at(75)).length, 1);
  assert.equal(dueReminders([c], rules, at(40)).length, 1);
  assert.equal(dueReminders([c], rules, at(40), new Set([reminderKey(c)])).length, 0);
  assert.equal(dueReminders([c], rules, at(5)).length, 0);
});

test("reminder key is source-independent and changes on reschedule", () => {
  const c = upcoming.find((x) => x.event === "Starters 264")!;
  const fromFallback = { ...c, id: -1, start: `${c.start}Z` };
  assert.equal(reminderKey(fromFallback), reminderKey(c));
  assert.notEqual(reminderKey({ ...c, start: "2026-11-11T14:45:00" }), reminderKey(c));
  assert.equal(reminderKey(c), "2|https://www.codechef.com/START264|2026-11-11T14:30:00.000Z");
});

test("tip overrides: per-contest text, or empty string to suppress", () => {
  const lc = upcoming.find((x) => x.event === "Weekly Contest 527")!;
  assert.match(formatReminder(lc, tips.rules, {}), /Tip: morning contests build discipline$/);
  assert.match(formatReminder(lc, tips.rules, { [lc.href]: "custom" }), /Tip: custom$/);
  assert.doesNotMatch(formatReminder(lc, tips.rules, { [lc.href]: "" }), /Tip/);
});
