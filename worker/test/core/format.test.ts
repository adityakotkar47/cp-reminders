import { describe, expect, test } from "vitest";
import { baseOverrides, rules, tipRules } from "../../src/config.ts";
import { type Contest, type Tip, formatDuration, formatReminder, formatTime } from "../../src/core/format.ts";
import { type Rules, dueReminders, reminderKey, selectContests } from "../../src/core/select.ts";
import clistPast from "../fixtures/clist-past.json" with { type: "json" };
import clistUpcoming from "../fixtures/clist-upcoming.json" with { type: "json" };
import history from "../fixtures/history.json" with { type: "json" };

const past = clistPast.objects as unknown as Contest[];
const upcoming = clistUpcoming.objects as unknown as Contest[];
const all = [...past, ...upcoming];
const norm = (u: string) => u.replace(/\/+$/, "").toLowerCase();
const linkOf = (text: string) => text.match(/Contest Link: (\S+)/)![1]!;
const byEvent = (event: string) => all.find((c) => c.event === event)!;

const TEST_RULES: Rules = {
  include: {
    Codeforces: ["Codeforces Round", "Kotlin Heroes"],
    Codechef: ["^Starters"],
    LeetCode: ["Contest"],
    Atcoder: ["Beginner Contest"],
  },
  maxDurationHours: 5,
  mergeCodeforcesDivs: true,
  leadMinutes: 60,
  minLeadMinutes: 15,
};

describe("golden: the configured rules and tips reproduce the community's manual reminders", () => {
  test("bot output matches every manual reminder except the known manual mistakes", () => {
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
    expect(compared).toBe(history.length - Object.keys(knownManualErrors).length);
    expect(diffs).toEqual([]);
  });

  test("every manually posted contest is selected", () => {
    const selected = new Set(selectContests(all, rules).map((c) => norm(c.href)));
    const missed = history.map((h) => linkOf(h.text)).filter((l) => !selected.has(norm(l)));
    expect(missed).toEqual([]);
  });
});

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

describe("selection", () => {
  const names = (r: Rules) => selectContests(all, r).map((c) => c.event);

  test("keeps only contests whose name matches their platform's patterns", () => {
    const selected = names(TEST_RULES);
    expect(selected).toContain("Starters 264");
    expect(selected.some((n) => n.startsWith("Monday Munch"))).toBe(false);
    expect(selected.some((n) => n.startsWith("Placement Prep"))).toBe(false);
  });

  test("drops events longer than maxDurationHours", () => {
    const selected = names(TEST_RULES);
    expect(selected).toContain("Kotlin Heroes: Episode 15");
    expect(selected).not.toContain("Kotlin Heroes: Practice 15");
    expect(names({ ...TEST_RULES, maxDurationHours: 24 * 7 })).toContain("Kotlin Heroes: Practice 15");
  });

  test("merges simultaneous Codeforces Div. 1 and Div. 2 rounds into one Div. 2 reminder", () => {
    const merged = selectContests(all, TEST_RULES).filter((c) => c.event.startsWith("Codeforces Round 1133"));
    expect(merged.map((c) => c.event)).toEqual(["Codeforces Round 1133 (Div. 1 + Div. 2)"]);
    expect(merged[0]!.href).toBe(byEvent("Codeforces Round 1133 (Div. 2)").href);
    expect(names({ ...TEST_RULES, mergeCodeforcesDivs: false })).toEqual(
      expect.arrayContaining(["Codeforces Round 1133 (Div. 1)", "Codeforces Round 1133 (Div. 2)"]),
    );
  });
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

test("due window: from leadMinutes before the start until minLeadMinutes before it", () => {
  const c = byEvent("Starters 264");
  const start = Date.parse(c.start + "Z");
  const at = (minBefore: number) => start - minBefore * 60_000;
  expect(dueReminders([c], TEST_RULES, at(TEST_RULES.leadMinutes) - 1000)).toHaveLength(0);
  expect(dueReminders([c], TEST_RULES, at(TEST_RULES.leadMinutes))).toHaveLength(1);
  expect(dueReminders([c], TEST_RULES, at(TEST_RULES.minLeadMinutes))).toHaveLength(1);
  expect(dueReminders([c], TEST_RULES, at(TEST_RULES.minLeadMinutes) + 1000)).toHaveLength(0);
});

test("reminder key identifies the contest, whatever its source or start time", () => {
  const c = byEvent("Starters 264");
  expect(reminderKey({ ...c, start: `${c.start}Z` })).toBe(reminderKey(c));
  expect(reminderKey({ ...c, start: "2026-11-11T14:45:00" })).toBe(reminderKey(c));
  expect(reminderKey(c)).toBe("2|https://www.codechef.com/START264");
});

describe("tips", () => {
  const morning = byEvent("Weekly Contest 527");
  const evening = byEvent("Biweekly Contest 195");
  const abc = byEvent("AtCoder Beginner Contest 484");
  const tips: Tip[] = [
    { platform: "LeetCode", startsBeforeIST: "12:00", text: "early" },
    { platform: "Atcoder", eventMatches: "Beginner", text: "beginner" },
  ];

  test("the first matching rule applies; a contest matching none gets no tip", () => {
    expect(formatReminder(morning, tips)).toMatch(/\n\n📌 Tip: early$/);
    expect(formatReminder(abc, tips)).toMatch(/\n\n📌 Tip: beginner$/);
    expect(formatReminder(evening, tips)).not.toMatch(/Tip/);
  });

  test("an override sets a tip for one contest, and an empty override suppresses it", () => {
    expect(formatReminder(morning, tips, { [morning.href]: "custom" })).toMatch(/Tip: custom$/);
    expect(formatReminder(evening, tips, { [evening.href]: "custom" })).toMatch(/Tip: custom$/);
    expect(formatReminder(morning, tips, { [morning.href]: "" })).not.toMatch(/Tip/);
  });
});
