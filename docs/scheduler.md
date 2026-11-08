# Scheduler (Cloudflare Worker)

The Worker in `worker/` decides what to send and when, stores every reminder in D1, wakes the sender, and serves the outbox the sender drains. The design is in [architecture.md](architecture.md); this page covers the implementation and how to run it.

## Layout

| File | Responsibility |
|---|---|
| `src/index.ts` | Route table, `fetch` and `scheduled` entry points. |
| `src/router.ts` | Path and method matching, bearer authentication per route. |
| `src/auth.ts` | Bearer parsing and constant-time token comparison (SHA-256 digests compared in a fixed-length loop). |
| `src/core/` | Pure contest selection and message formatting, documented in [formatter.md](formatter.md). |
| `src/contests.ts` | Snapshot cache: clist, then Codeforces fallback. |
| `src/tick.ts` | One tick: refresh snapshot, queue due reminders, expire, wake. |
| `src/reminders.ts` | Claim, ack, lease and expiry SQL. |
| `src/wake.ts` | `workflow_dispatch` with debounce. |
| `src/outbox.ts`, `src/admin.ts`, `src/health.ts` | Route handlers and request validation. |
| `src/tips.ts`, `src/preview.ts` | Tip overrides from D1, preview rendering. |
| `src/config.ts` | Imports `config/rules.json` and `config/tips.json`, bundled at deploy. |
| `migrations/0001_init.sql` | D1 schema. |

## HTTP API

The routes are specified in [architecture.md](architecture.md#worker-http-api). Implementation details: a token in the query string is never accepted, authentication runs before the body is read, a wrong method on a known path is 405 and an unknown path is 404. `tip` and `href` are at most 500 characters.

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

## Tick and reminder states

The tick steps are in [architecture.md](architecture.md#tick-every-5-minutes-from-two-independent-triggers) and the state transitions in [architecture.md](architecture.md#reminder-lifecycle). `POST /tick` and the `*/5 * * * *` cron trigger call the same `runTick`.

## D1 semantics relied on

| Behaviour | Where used | How it is verified |
|---|---|---|
| `DB.batch()` runs statements as one transaction in order and returns one result per statement ([D1 Worker API](https://developers.cloudflare.com/d1/worker-api/d1-database/)) | Snapshot save, sweep plus claim, tick, ack | Overlapping-claim and overlapping-tick tests. |
| `meta.changes` per statement | `queued` and `applied` counts | Tick and ack tests. |
| `UPDATE ... RETURNING` and `INSERT ... ON CONFLICT DO NOTHING` | Claim, enqueue, upserts | The D1 pages do not list these explicitly (D1 is SQLite), so they are exercised on the local D1 engine in `test/claim.test.ts` and `test/tick.test.ts`. |

Free-tier usage is estimated in [architecture.md](architecture.md#capacity).

## Setup

All commands run in `worker/` and need your Cloudflare and GitHub accounts.

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

Set each Worker secret listed in [architecture.md](architecture.md#secrets) with `pnpm exec wrangler secret put <NAME>`, which prompts for the value. Generate `TICK_TOKEN`, `ADMIN_TOKEN` and `SENDER_TOKEN` with `openssl rand -hex 32` and keep them distinct. `wrangler.jsonc` lists the secrets under `secrets.required`, so `wrangler types` generates a typed `Env` and local runs warn about missing ones.

### Second trigger on cron-job.org

Create a job: URL `https://cp-reminders.<subdomain>.workers.dev/tick`, schedule every 5 minutes, request method POST, and under Advanced add the header `Authorization: Bearer <TICK_TOKEN>`. cron-job.org disables a job after many consecutive failures, so check `/health` (`lastTickAt`) now and then.

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
