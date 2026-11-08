# Formatter and selection rules

Two pure modules decide what the bot says and about which contests:

- `worker/src/core/select.ts` picks the contests that get a reminder and decides when each reminder is due.
- `worker/src/core/format.ts` renders a contest into the reminder text.

The Worker calls both when it queues a reminder ([architecture.md](architecture.md#tick-workers-cron-every-5-minutes)).

## Message format

```
🚨 Contest Reminder 🚨

📍 Platform: Codeforces
🏆 Contest Name: Codeforces Round 1123 (Div. 2)
🕒 Timing: 8:05 PM
⏳ Duration: 2:15 hours
🔗 Contest Link: https://codeforces.com/contests/2267

📌 Tip: …
```

The tip line and the blank line before it appear only when a tip applies. The format follows the community's own reminder posts:

| Field | Rule |
|---|---|
| Platform | `Codeforces`, `Codechef`, `Atcoder` or `LeetCode`. |
| Contest name, Codeforces | Sponsored names become the round name: `WorldQuant Round 1 (Codeforces Round 1128, Div. 1 + Div. 2)` → `Codeforces Round 1128 (Div. 1 + Div. 2)`. |
| Contest name, CodeChef | The trailing rating note is dropped: `Starters 254 (Rated till 6 star)` → `Starters 254`. |
| Contest name, AtCoder | Sponsored names become the contest name, with ASCII or full-width parentheses: `JIJ Programming Contest 2026（AtCoder Beginner Contest 476）` → `AtCoder Beginner Contest 476`. |
| Timing | Start time in IST on a 12-hour clock, such as `8:05 PM`. Start times without a zone are UTC. |
| Duration | `H:MM hours`, or `H hours` for whole hours, rounded to the minute. |
| Link | The contest link; LeetCode links end with `/`. |

## Selection

`worker/config/rules.json`:

| Key | Value | Meaning |
|---|---|---|
| `include` | per platform, regular expressions on the contest name | A contest is posted only if its name matches one of its platform's patterns: Codeforces rounds and Global Rounds, CodeChef Starters, LeetCode Weekly and Biweekly contests, AtCoder Beginner Contests. |
| `maxDurationHours` | `5` | Longer events are skipped, such as Kotlin Heroes practice rounds, heuristic contests and Placement Prep weekends. |
| `mergeCodeforcesDivs` | `true` | A Div. 1 and a Div. 2 round starting together get one reminder: the Div. 2 link, named `(Div. 1 + Div. 2)`. |
| `leadMinutes` | `45` | A reminder becomes due 45 minutes before the start. |
| `minLeadMinutes` | `10` | A reminder is not sent once the start is less than 10 minutes away. |

A reminder is therefore sendable from 45 to 10 minutes before the start. Each contest is reminded at most once, even if it is rescheduled ([architecture.md](architecture.md#design-decisions)).

## Tips

`worker/config/tips.json`:

- `rules` are checked in order and the first match wins. A rule can require a `platform`, a start before a given IST time (`startsBeforeIST`, such as `"12:00"` for morning contests) and a contest name matching `eventMatches`. The configured rules add a discipline tip to morning LeetCode contests and a recommendation to AtCoder Beginner Contests.
- `overrides` map a contest link to a tip for that contest alone; an empty string suppresses the tip.

One-off tips set through `PUT /tips` are stored in D1 and take precedence over both ([scheduler.md](scheduler.md)).

## Tests

`worker/test/core/format.test.ts` runs with the Worker tests against frozen data in `worker/test/fixtures/`: clist responses and the community's 34 manual reminders, captured on 2026-11-07.

- **Golden tests** use the real `rules.json` and `tips.json` on purpose: they fail when a configuration change would break the community's format or skip a contest the community posts. For every manual reminder, the bot's text for the same contest is compared byte for byte, and every manually posted contest must be selected. Five manual posts are listed in the test as known mistakes and skipped: three contests that started at 8:15 PM but were posted with 8:00 or 8:05 PM, one post carrying another round's link, and one name typo.
- **Rule tests** define their own rules and tips in the test, so they hold whatever the configuration says: name patterns, the duration limit, Div. 1 and Div. 2 merging, the due window, sponsored names, the reminder key, tip rules and overrides.

The Worker's other tests take every time and limit from the configuration and from the constants exported by its modules (lease, attempts, claim size, wake debounce, snapshot age, badge threshold, length limits), so changing any of them needs no test changes.
