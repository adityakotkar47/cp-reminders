# Formatter and selection rules

`worker/src/core/format.ts` turns a clist contest into the exact reminder text. `worker/src/core/select.ts` decides which contests get a reminder and when. Both are pure (no I/O); the Worker calls them when it queues a reminder, and the golden tests below cover the same code.

## Message format

```
🚨 Contest Reminder 🚨

📍 Platform: Codeforces
🏆 Contest Name: Codeforces Round 1123 (Div. 2)
🕒 Timing: 8:05 PM
⏳ Duration: 2:15 hours
🔗 Contest Link: https://codeforces.com/contests/2267

📌 Tip: ...            (only when a tip applies)
```

Conventions, all taken from the 34 manual reminders in the community's history:

| Field | Rule |
|---|---|
| Platform | `Codeforces`, `Codechef`, `Atcoder`, `LeetCode` (spelled as in the manual posts) |
| Timing | IST, 12-hour clock, e.g. `8:05 PM`. clist returns UTC without a `Z`; it is treated as UTC. |
| Duration | `H:MM hours`, except whole hours which are `2 hours` |
| Name: CodeChef | trailing rating note removed: `Starters 254 (Rated till 6 star)` → `Starters 254` |
| Name: Codeforces sponsored | `WorldQuant Round 1 (Codeforces Round 1128, Div. 1 + Div. 2)` → `Codeforces Round 1128 (Div. 1 + Div. 2)` |
| Name: AtCoder sponsored | `JIJ Programming Contest 2026（AtCoder Beginner Contest 476）` → `AtCoder Beginner Contest 476` (full-width or ASCII parentheses) |
| Link: LeetCode | trailing `/` added |

## Which contests are posted

Configured in `worker/config/rules.json`:

| Key | Meaning |
|---|---|
| `include` | Per platform, regexes on the contest name; a contest must match one. Defaults: Codeforces rounds and Global Rounds, CodeChef Starters, LeetCode Weekly/Biweekly, AtCoder Beginner Contests. |
| `maxDurationHours` | Longer contests are skipped (Kotlin Heroes practice, heuristic contests, Placement Prep). |
| `mergeCodeforcesDivs` | When a Div. 1 and a Div. 2 round start together, post one reminder with the Div. 2 link, labelled `(Div. 1 + Div. 2)`. |
| `leadMinutes` | Reminder is due this many minutes before the start (75, matching the manual median). |
| `minLeadMinutes` | Never send when the start is closer than this, e.g. after scheduler downtime. |

Reminder identity and reschedule handling are described in [architecture.md](architecture.md#key-design-decisions) (decision 3).

## Tips

Configured in `worker/config/tips.json`. Tips are optional; most reminders have none.

- `rules`: checked in order, first match wins. Each may constrain `platform`, `startsBeforeIST` (`"12:00"` = morning contests) and `eventMatches` (regex on the name).
- `overrides`: contest link → tip text for a single contest. An empty string suppresses the tip for that contest.

The scheduler also merges one-off tips from its D1 `tip_overrides` table, set with `PUT /tips` without a redeploy (see `docs/scheduler.md`).

## Tests

`pnpm --filter cp-reminders-worker test` runs `worker/test/core/format.test.ts` with the rest of the Worker tests, against real clist data in `worker/test/fixtures/`:

- Golden test: the bot's output is compared with every manual reminder in `worker/test/fixtures/history.json`. 29 match byte-for-byte. The other 5 are manual mistakes the bot gets right (three contests delayed to 8:15 PM but posted with the old time, one wrong link pasted, one name typo); they are listed in the test as known manual errors.
- Every contest that was posted manually is selected by the rules.
- Noise is dropped (Div. 1 twin, Monday Munch, Placement Prep, Kotlin practice, heuristic contests).
- Due-window, reschedule-key and tip-override behaviour.

The fixtures are frozen golden data captured on 2026-11-07 and are not refreshed.
