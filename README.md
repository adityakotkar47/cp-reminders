# cp-reminders

[![ci](https://github.com/adityakotkar47/cp-reminders/actions/workflows/ci.yml/badge.svg)](https://github.com/adityakotkar47/cp-reminders/actions/workflows/ci.yml)
[![bot](https://img.shields.io/endpoint?url=https%3A%2F%2Fcp-reminders.c122.workers.dev%2Fbadge)](https://cp-reminders.c122.workers.dev/health)

Posts a reminder for every Codeforces, CodeChef, LeetCode and AtCoder contest into the Announcements group of the CP community's WhatsApp Community, 45 minutes before it starts.

```
🚨 Contest Reminder 🚨

📍 Platform: LeetCode
🏆 Contest Name: Weekly Contest 527
🕒 Timing: 8:00 AM
⏳ Duration: 1:30 hours
🔗 Contest Link: https://leetcode.com/contest/weekly-contest-527/

📌 Tip: morning contests build discipline
```

## How it works

- A **Cloudflare Worker** reads upcoming contests from [clist.by](https://clist.by) every hour, queues each reminder in D1 when it becomes due, and wakes the sender.
- A **GitHub Actions** job runs the **Go sender**, a WhatsApp linked device on a dedicated number, which posts the queued reminders to the Announcements group and nowhere else.
- Everything runs on free tiers. The badges above show the checks and the bot's live health: red after 15 minutes without a tick or after a missed reminder, yellow when clist is failing and the Codeforces fallback is in use.

## Repository

| Path | Contents |
|---|---|
| `worker/` | Cloudflare Worker: scheduling, contest selection and formatting, outbox API, health and badge. |
| `worker/config/` | Which contests get reminders, lead times and tips. |
| `sender/` | Go WhatsApp sender. |
| `.github/workflows/` | `send.yml` drains the outbox; `ci.yml` runs the checks. |
| `docs/` | Design and operation. |
| `docs/pfp/` | The sender's WhatsApp profile picture: `books-cascade.svg` is the source, `books-cascade.png` the 640×640 image set on the account. |

Branch `state` holds the sender's WhatsApp login, encrypted with age (`session.db.age`; the key is the GitHub secret `AGE_IDENTITY`), and its delivery log (`sent.json`). Each run replaces it with a single new commit; it must not be merged or deleted, since deleting it logs the bot out.

## Documentation

- [Architecture](docs/architecture.md): design, data model, interfaces and failure handling.
- [Formatter](docs/formatter.md): message format, contest selection and tips.
- [Scheduler](docs/scheduler.md): the Worker, its API, deployment and development.
- [Sender](docs/sender.md): commands, pairing and troubleshooting.
- [Workflows](docs/workflow.md): `send.yml` and `ci.yml`.
- [Research](docs/research/report.md): the findings behind the design.

## Operating

| Task | How |
|---|---|
| See upcoming reminders | `GET /preview` ([scheduler.md](docs/scheduler.md#http-api)) |
| Add or suppress a tip for one contest | `PUT /tips` ([scheduler.md](docs/scheduler.md#http-api)) |
| Change which contests are posted, or the standard tips | Edit `worker/config/` and redeploy the Worker ([formatter.md](docs/formatter.md)) |
| A reminder failed | GitHub emails the failed `send` run; its summary holds the text to post by hand. |
| The sender is logged out | Pair again ([sender.md](docs/sender.md#pairing)) |
| Keep the session alive | Open WhatsApp on the sender's phone at least every 14 days. |
| Post to a different community | Add the sender's number to the community and make it a community admin. Find the community's Announcements JID with `wa groups` ([sender.md](docs/sender.md#announcements-jid)), then set it as the GitHub secret: `gh secret set ANNOUNCE_JID`. The next send run uses it. |
| Rotate a Worker token or the GitHub token | Generate a new value and set it with `pnpm exec wrangler secret put <NAME>` in `worker/`. `SENDER_TOKEN` is also a GitHub secret, so set the same value with `gh secret set SENDER_TOKEN`. `GH_TOKEN` is a fine-grained token limited to this repository with Actions read and write ([architecture.md](docs/architecture.md#secrets)). |
| Add a second trigger | Optional: an external scheduler calling `POST /tick` every 5 minutes ([scheduler.md](docs/scheduler.md#optional-second-trigger)). |

## Checks

```sh
pnpm install
pnpm --filter cp-reminders-worker typecheck
pnpm --filter cp-reminders-worker test
go -C sender vet ./...
go -C sender test ./...
```
