# Free hosting and scheduling

The sender has to open a websocket to WhatsApp, run Signal cryptography, and save session keys that change on every connection. It can either stay connected permanently, or wake up, connect, send, save and disconnect. Most free compute either runs briefly or sleeps when idle, which suits the second pattern; the first needs an always-on free machine.

## Compute

| Platform | Free tier | Fit |
|---|---|---|
| GitHub Actions | Standard runners are free and unmetered in public repositories; private repositories on GitHub Free get $12 of compute a month, about 2,000 Linux minutes, billed per started minute ([billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)). | Short jobs. |
| Cloudflare Workers | 100,000 requests a day, 10 ms CPU per HTTP request and per cron invocation, 5 cron triggers per account, 15 minutes of wall time per cron invocation, 128 MB memory ([limits](https://developers.cloudflare.com/workers/platform/limits/)). Outbound WebSockets are supported ([WebSockets](https://developers.cloudflare.com/workers/runtime-apis/websockets/)). Containers need the $5 Workers Paid plan ([Containers pricing](https://developers.cloudflare.com/containers/pricing/)). | A scheduler. 10 ms of CPU is too little for a WhatsApp handshake, and no WhatsApp library is reported to run on workerd. |
| Vercel Hobby | Cron jobs run at most once a day with ±59-minute precision ([cron usage](https://vercel.com/docs/cron-jobs/usage-and-pricing)); functions run up to 300 s with 2 GB and 1 vCPU ([function limits](https://vercel.com/docs/functions/limitations)). | Not a scheduler; no reports of running a WhatsApp library in a function. |
| Render Free | A web service sleeps after 15 minutes without inbound HTTP or WebSocket traffic; 750 instance-hours a month; no persistent disk; no free cron jobs or background workers; free Postgres expires after 30 days ([free tier](https://render.com/docs/free)). | Unsuitable. |
| Oracle Cloud Always Free | Ampere A1 up to 2 OCPUs and 12 GB, plus two E2.1.Micro VMs. An instance whose 95th-percentile CPU, network and (A1) memory use stay under 20% for 7 days can be reclaimed as idle. Free shapes can be out of capacity in the home region, where they must be created ([Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/resourceref.htm)). | The only always-on free VM; a small bot is exactly the idle load that reclamation targets. |
| Google Cloud | One e2-micro in us-west1, us-central1 or us-east1, 30 GB disk, 1 GB of egress a month ([free features](https://docs.cloud.google.com/free/docs/free-cloud-features)). | Always on, US regions only. |
| Northflank Sandbox | "2 services, 2 jobs, and 1 database", "Always on, no sleeping", no card ([pricing](https://northflank.com/pricing)); per-service resources are not published there. | Possible always-on host. |
| Koyeb | One free instance (512 MB, 0.1 vCPU) that scales to zero after an hour without traffic and cannot be a worker ([instances](https://www.koyeb.com/docs/reference/instances)). | Unsuitable. |
| Hugging Face Spaces | Free CPU Spaces sleep after 48 hours, and creating a Gradio or Docker Space requires a paid plan ([Spaces hardware](https://huggingface.co/docs/hub/spaces-gpus)). | Unsuitable. |
| Fly.io | No free tier for new organisations; the smallest always-on machine is $2.19 a month ([pricing](https://docs.fly.io/about/pricing)). | Paid. |
| Railway | A 30-day trial, then $1 of credit a month ([free trial](https://docs.railway.com/reference/pricing/free-trial)). | Too small. |
| PythonAnywhere | Free accounts reach the internet only through an HTTP proxy with an allowlist ([help](https://help.pythonanywhere.com/pages/403ForbiddenError/)). | Unsuitable. |

## GitHub Actions triggers

- `schedule` runs at most every 5 minutes, "can be delayed during periods of high loads", and "some queued jobs may be dropped"; the start of every hour is a high-load time ([events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)). Users report delays of several hours and missed runs ([community #209514](https://github.com/orgs/community/discussions/209514), [#201472](https://github.com/orgs/community/discussions/201472)).
- In public repositories, scheduled workflows are disabled after 60 days without repository activity ([events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)).
- `workflow_dispatch` started through the REST API runs on demand, which is the usual remedy for an unreliable schedule ([community #209514](https://github.com/orgs/community/discussions/209514)). GitHub publishes no latency figures for dispatch.
- GitHub's terms exclude using hosted runners for activity "unrelated to the production, testing, deployment, or publication of the software project" or "as part of a serverless application" ([additional product terms](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features)).

## External schedulers

| Service | Free tier |
|---|---|
| cron-job.org | Free; runs as often as every minute; 30-second request timeout; no punctuality guarantee; a job is disabled after more than 25 consecutive failures ([FAQ](https://cron-job.org/en/faq/)). |
| Upstash QStash | 1,000 messages a day, 10 schedules, 15-minute response timeout, messages delayed up to 7 days ([pricing](https://upstash.com/pricing/qstash)). |
| Cloudflare Workers | 5 cron triggers per account ([limits](https://developers.cloudflare.com/workers/platform/limits/)). |

## Storage for a session that changes on every run

| Option | Limits |
|---|---|
| GitHub Actions cache | Entries unused for 7 days are evicted and an existing entry cannot be changed ([dependency caching](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching)). Unsuitable. |
| Git branch | An encrypted file committed back after each run; the pattern is used by [baileys-agent-kit](https://github.com/I-No-oNe/baileys-agent-kit/releases/tag/v0.1.9). |
| Cloudflare KV | 1,000 writes a day ([KV pricing](https://developers.cloudflare.com/kv/platform/pricing/)). |
| Durable Objects (SQLite) | 5 GB, 100,000 rows written a day on Workers Free ([pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)). |
| Upstash Redis | 250 MB, 500,000 commands a month ([pricing](https://upstash.com/pricing/redis)). |
| Supabase | Free projects pause after about a week of low activity ([pausing](https://supabase.com/kb/faqs/platform/free-project-pausing)). |
| Render Postgres | Expires 30 days after creation ([free tier](https://render.com/docs/free)). |

Baileys recommends a database-backed auth state over its file-based helper for production ([authentication](https://www.mintlify.com/whiskeysockets/Baileys/concepts/authentication)); whatsmeow keeps the whole session in one SQL database.

## IP reputation

GitHub runners and cloud VMs connect from datacenter addresses. Reports claim WhatsApp restricts companion devices on datacenter IPs: a README recommending residential IPs ([arslanstack/whatsapp-baileys](https://awesome.ecosyste.ms/projects/github.com%2Farslanstack%2Fwhatsapp-baileys)), a cloud VPS session logged out and followed by a 24-hour "unofficial app" restriction ([evolution-api #2693](https://github.com/evolution-foundation/evolution-api/issues/2693)), and server IP blacklisting ([Baileys #225](https://github.com/WhiskeySockets/Baileys/issues/225)). All are anecdotal; WhatsApp publishes no policy, and there is no data comparing ban rates by IP type.

## Not documented

- Whether frequent short connections carry more ban risk than one long-lived session.
- Render's position on keep-alive pings.
- Northflank Sandbox's per-service CPU and memory.
- Free limits of Deno Deploy, Zeabur, Neon, Turso and MongoDB Atlas.
