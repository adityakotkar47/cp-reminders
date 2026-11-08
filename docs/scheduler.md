# Scheduler (Cloudflare Worker)

The Worker in `worker/` decides what to send and when, stores every reminder in D1, wakes the sender, and serves the outbox the sender drains. It never talks to WhatsApp and never knows the target chat. The design rationale is in `architecture.md`; this page describes the implementation, the HTTP API and how to deploy it.

## Layout

| File | Responsibility |
|---|---|
| `src/index.ts` | Route table, `fetch` and `scheduled` entry points. |
| `src/router.ts` | Path and method matching, bearer authentication per route. |
| `src/auth.ts` | Bearer parsing and constant-time token comparison (SHA-256 digests compared in a fixed-length loop). |
| `src/contests.ts` | Snapshot cache: clist, then Codeforces fallback. |
| `src/tick.ts` | One tick: refresh snapshot, queue due reminders, expire, wake. |
| `src/reminders.ts` | Claim, ack, lease and expiry SQL. |
| `src/wake.ts` | `workflow_dispatch` with debounce. |
| `src/outbox.ts`, `src/admin.ts`, `src/health.ts` | Route handlers and request validation. |
| `src/tips.ts`, `src/preview.ts` | Tip overrides from D1, preview rendering. |
| `src/config.ts` | Imports `config/rules.json` and `config/tips.json`, bundled at deploy. |
| `migrations/0001_init.sql` | D1 schema, identical to `architecture.md`. |

The Worker imports `src/format.ts` and `src/select.ts` from the repository root, so the text it stores is produced by the same code the golden tests cover.

## HTTP API

Auth is `Authorization: Bearer <token>`. A token in the query string is never accepted. Each secret protects only its own routes, so a leaked `SENDER_TOKEN` cannot trigger ticks or edit tips. Authentication runs before the body is read. Wrong method on a known path is 405, unknown path 404.

| Method and path | Token | Body | Response |
|---|---|---|---|
| `GET /health` | none | | `{lastTickAt, lastFetchAt, lastFetchSource, lastFetchError, queued, claimed, failed24h, expired24h}`. Counters and meta only: no message text, links or secrets. |
| `POST /tick` | `TICK_TOKEN` | | `{fetched, queued, woke, errors}` |
| `GET /preview` | `ADMIN_TOKEN` | | Plain text: the next 10 reminders with send time in IST and the rendered message. |
| `PUT /tips` | `ADMIN_TOKEN` | `{href, tip}` | `{ok: true}`. An empty `tip` suppresses the tip for that contest. `tip` is at most 500 characters. |
| `DELETE /tips` | `ADMIN_TOKEN` | `{href}` | `{deleted: 0 \| 1}` |
| `POST /outbox/claim` | `SENDER_TOKEN` | `{claimId}` | `{items: [{key, text, startUtc, deadlineUtc}]}`, at most 5. |
| `POST /outbox/ack` | `SENDER_TOKEN` | `{claimId, results: [{key, status: "sent" \| "failed", messageId?, error?}]}` | `{applied: n}` |

```sh
BASE=https://cp-reminders.<your-subdomain>.workers.dev

curl "$BASE/health"
curl -X POST -H "Authorization: Bearer $TICK_TOKEN" "$BASE/tick"
curl -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/preview"

curl -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"href":"https://www.codechef.com/START264","tip":"bring snacks"}' "$BASE/tips"
curl -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"href":"https://www.codechef.com/START264","tip":""}' "$BASE/tips"
curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"href":"https://www.codechef.com/START264"}' "$BASE/tips"

curl -X POST -H "Authorization: Bearer $SENDER_TOKEN" -H "Content-Type: application/json" \
  -d '{"claimId":"manual-1"}' "$BASE/outbox/claim"
curl -X POST -H "Authorization: Bearer $SENDER_TOKEN" -H "Content-Type: application/json" \
  -d '{"claimId":"manual-1","results":[{"key":"<key>","status":"sent","messageId":"WAMID"}]}' "$BASE/outbox/ack"
```

A tip override applies to reminders queued after it is set. The text of a reminder already in the outbox does not change.

## Tick

`POST /tick` and the `*/5 * * * *` cron trigger run the same function, so the two triggers are interchangeable and overlapping calls are safe.

1. `ensureSnapshot`: if `contest_snapshot.fetched_at` is older than 60 minutes, fetch clist (`resource_id__in=1,2,93,102`, `start__gt` is now without `Z`, `limit=100`, header `Authorization: ApiKey user:key`). A non-2xx response or an empty list falls back to `https://codeforces.com/api/contest.list?gym=false`, keeping `phase == BEFORE` and mapping to `href = https://codeforces.com/contests/{id}`. The Codeforces list replaces only Codeforces rows; other platforms are carried over from the previous snapshot while they are still upcoming. If both fail, the old snapshot stays and `meta.last_fetch_error` records both errors.
2. `dueReminders(snapshot, rules, now)` from `src/select.ts` gives the contests whose window has opened. The text is rendered once with `formatReminder` using `config/tips.json` overrides merged with the `tip_overrides` table.
3. One `DB.batch` runs the expiry statements, one `INSERT ... ON CONFLICT(key) DO NOTHING` per due reminder, and the `last_tick_at` upsert. `queued` in the response is the sum of `meta.changes` over the inserts, so a second overlapping tick reports 0.
4. `maybeWake`: if any reminder is claimable (queued, or claimed with an expired lease, within deadline and below 3 attempts) and `last_wake_at` is at least 4 minutes old, dispatch `send.yml` with body `{"ref":"main"}` and no inputs. `last_wake_at` is written only after a 2xx response. GitHub's reference now documents a 200 response with the run id for this endpoint, and older behaviour was 204, so any 2xx counts as success. A failed dispatch leaves `last_wake_at` untouched and the next tick retries.

### Reminder state changes

| Event | SQL effect |
|---|---|
| Claim | One `UPDATE ... WHERE key IN (SELECT ... LIMIT 5) RETURNING` sets `status='claimed'`, `claim_id`, `claimed_at`, `attempts+1`. Eligible rows are `queued`, or `claimed` with `claimed_at <= now - 10 min`, with `deadline_utc >= now` and `attempts < 3`. |
| Sweep (inside every tick and claim batch) | `queued` past deadline becomes `expired`. `claimed` with an expired lease past deadline becomes `expired`. `claimed` with an expired lease and `attempts >= 3` becomes `failed`. |
| Ack `sent` | Applies when `claim_id` matches and status is `claimed` or `expired`. An ack from a different `claimId`, or a repeated ack, changes nothing. |
| Ack `failed` | Applies when `claim_id` matches and status is `claimed`. Back to `queued` while `attempts < 3`, otherwise `failed`. |

The claim batch also runs the sweep statements, so claiming and expiring happen in one transaction.

Deviation from the lifecycle diagram: a `sent` ack is also accepted for a row that was swept to `expired` while the message was in flight (same `claimId`). The message really went out, so the ledger records the truth instead of an alert for a delivered reminder. A `failed` ack never revives an expired row.

## D1 semantics relied on

| Behaviour | Where used | How it is verified |
|---|---|---|
| `DB.batch()` runs statements as one transaction in order and returns one result per statement ([D1 Worker API](https://developers.cloudflare.com/d1/worker-api/d1-database/)) | Snapshot save, sweep plus claim, tick, ack | Overlapping-claim and overlapping-tick tests. |
| `meta.changes` per statement | `queued` and `applied` counts | Tick and ack tests. |
| `UPDATE ... RETURNING` and `INSERT ... ON CONFLICT DO NOTHING` | Claim, enqueue, upserts | The D1 pages do not list these explicitly (D1 is SQLite), so they are exercised on the local D1 engine in `test/claim.test.ts` and `test/tick.test.ts`. |

## Cost and limits

| Resource | Use | Free limit ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)) |
|---|---|---|
| CPU per invocation | Small JSON parse of the snapshot plus a few statements; the awaited network and D1 time is not CPU | 10 ms |
| Subrequests per tick | At most 3 (clist, Codeforces, GitHub) | 50 |
| Requests | About 600 per day from two triggers | 100,000 |
| D1 rows written | About 300 meta upserts, 24 snapshots, a handful of reminder rows | 100,000 per day |
| D1 rows read | Low thousands | 5,000,000 per day |

## Setup

All commands run in `worker/`. Nothing here is done by the build agent; it needs your Cloudflare and GitHub accounts.

```sh
pnpm install
pnpm exec wrangler login
pnpm exec wrangler d1 create cp-reminders
```

Copy the printed `database_id` into `d1_databases[0].database_id` in `wrangler.jsonc`. Check `vars.GH_REPO` (`owner/repo` of this repository). Then:

```sh
pnpm run db:migrate:remote       # wrangler d1 migrations apply cp-reminders --remote
pnpm run deploy
```

Secrets (`wrangler secret put <NAME>`; each prompts for the value). Generate the three random tokens with `openssl rand -hex 32` and keep them distinct.

| Secret | Value |
|---|---|
| `CLIST_USERNAME`, `CLIST_API_KEY` | From your clist.by API page. |
| `GH_TOKEN` | Fine-grained personal access token, only this repository, permission Actions: read and write. |
| `TICK_TOKEN` | Random. Used by cron-job.org. |
| `ADMIN_TOKEN` | Random. For `/preview` and `/tips`. |
| `SENDER_TOKEN` | Random. Also stored as the GitHub secret `SENDER_TOKEN`. |

`wrangler.jsonc` lists them under `secrets.required`, so `wrangler types` generates a typed `Env` and local dev warns about missing ones.

### Second trigger on cron-job.org

Create a job: URL `https://cp-reminders.<subdomain>.workers.dev/tick`, schedule every 5 minutes, request method POST, and under Advanced add the header `Authorization: Bearer <TICK_TOKEN>`. cron-job.org disables a job after many consecutive failures, so check `/health` (`lastTickAt`) now and then. The Worker's own cron and cron-job.org overlapping is fine.

### Verify

```sh
curl "$BASE/health"
curl -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/preview"
curl -X POST -H "Authorization: Bearer $TICK_TOKEN" "$BASE/tick"
```

## Development

```sh
pnpm run typecheck          # wrangler types (generates worker-configuration.d.ts), then tsc --noEmit
pnpm test                   # wrangler types, then vitest in the Workers runtime with a real local D1
pnpm run db:migrate:local   # apply migrations/ to the local D1 that wrangler dev uses
pnpm run dev                # wrangler dev --test-scheduled
```

Tests use [`@cloudflare/vitest-plugin`](https://developers.cloudflare.com/workers/testing/vitest-integration/get-started/write-your-first-test/) with Vitest 4. Migrations from `migrations/` are applied to the test D1 in `test/setup.ts`. Outbound HTTP is replaced by an injected fetcher (unit tests) or by spying on `globalThis.fetch` (route tests); no test touches the network.

Test secrets live once, in `TEST_SECRETS` in `vitest.config.ts`. Wrangler loads the keys listed in `secrets.required` from `.dev.vars`, `.env` or `process.env` and warns about missing ones ([secrets in local development](https://developers.cloudflare.com/workers/configuration/secrets/#local-development-with-secrets)), so the config copies `TEST_SECRETS` into `process.env` before the plugin reads `wrangler.jsonc`. The same object is passed as `miniflare.bindings`, which take precedence over the Wrangler config ([configuration](https://developers.cloudflare.com/workers/testing/vitest-integration/configuration/)), so a developer's own `.dev.vars` or `.env` never leaks into tests.
