# Free-tier hosting and scheduling for a WhatsApp (Baileys/whatsmeow) contest-reminder bot (as of Nov 2026)

## Q1. Architecture (A) always-on websocket process vs (B) cron-triggered "connect, send, save, disconnect" job: which fits free tiers?

### Takeaway
Most free compute is either short-lived (functions/CI) or sleeps when idle, so (B) is the realistic $0 pattern. (A) only works on genuinely always-on free compute: Oracle Always Free VM, GCP e2-micro, Northflank Sandbox (documented "always on, no sleeping"). (B) depends on writing the Baileys/whatsmeow auth state back to storage after every run, and on a trigger that fires at about the right time.

### Cited Findings
- The free scale-to-zero services sleep: a Render Free web service spins down after 15 min with no inbound traffic, and inbound traffic "includes both HTTP requests and WebSocket messages from existing connections" (an outbound socket to WhatsApp does not obviously count as inbound) — [Render Free docs](https://render.com/docs/free)
- A Koyeb Free Instance scales to zero after 1 hour with no traffic — [Koyeb instances docs](https://www.koyeb.com/docs/reference/instances)
- A Hugging Face free cpu-basic Space sleeps after 48 h of inactivity. A custom sleep time or never-sleep requires paid hardware — [HF Spaces docs](https://huggingface.co/docs/hub/spaces-gpus)
- Always-on with no sleeping on a free tier: Northflank Sandbox says "Always on, no sleeping", with 2 services, 2 jobs and 1 database, and "No card needed" — [Northflank pricing](https://northflank.com/pricing)
- Baileys' multi-file auth state is described as fine for bots and small apps but not recommended for production. A DB-backed auth state is recommended instead — [Baileys auth docs (Mintlify mirror)](https://www.mintlify.com/whiskeysockets/Baileys/concepts/authentication)
- A third-party package (baileys-agent-kit v0.1.9) advertises "encrypted GitHub Actions state synchronization" for Baileys with no cache, artifact or hosted DB. It also says it persists "safety reservations" before sending, to avoid duplicate sends from scheduled runs. The README was not verified — [baileys-agent-kit release](https://github.com/I-No-oNe/baileys-agent-kit/releases/tag/v0.1.9)

### Inferences
- In (B), each run must restore the auth dir/keys, connect, wait for the connection to open (and possibly for pending notifications and app-state sync), send, wait for the server ack, flush `creds.update`/key writes to storage, and then close. Signal keys change as you use them, so the saved state must be written back on every run; a read-only secret is not enough.
- The "safety reservation" idea (record "message X sent/claimed" in durable storage before or around sending) matters for (B) because cron triggers can fire twice, late, or overlap.
- (A) has an extra advantage: one long-lived linked-device session looks more like a normal WhatsApp Web client than frequent reconnects from changing CI IPs. This is not sourced. It is a plausible ban-risk consideration (see the IP-risk findings in Q5).

### Gaps
- No official WhatsApp or Baileys guidance on whether frequent short reconnects (for example 4/day) raise ban risk compared with a persistent session.
- I did not measure how long a Baileys cold connect takes (connect, initial sync, send). Community experience suggests seconds to tens of seconds. That is fine for GitHub Actions and Vercel's 300 s, but over cron-job.org's 30 s HTTP timeout if the job runs inside the HTTP request.

## Q2. Platform-by-platform free limits and fit

### Takeaway
The best $0 options are GitHub Actions (B), Oracle Always Free ARM VM (A), Northflank Sandbox (A or B), and GCP e2-micro (A, but US-only and 1 GB egress). Vercel Hobby cron is daily-only with ±59 min precision, though a Vercel function can be triggered externally. Cloudflare Workers can open outbound WebSockets, but Baileys on workerd is unproven, and Cloudflare Containers need the $5 paid plan. Render, Koyeb and HF sleep when idle. HF compute Spaces now need a paid plan to create. Fly.io and Railway have effectively no free tier. PythonAnywhere free blocks non-allowlisted hosts.

### Cited Findings

**GitHub Actions (scheduled workflows): best $0 fit for (B)**
- Minimum interval: "The shortest interval you can run scheduled workflows is once every 5 minutes." — [GitHub docs: events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- Delays and drops: "The `schedule` event can be delayed during periods of high loads…" and "If the load is sufficiently high enough, some queued jobs may be dropped." "High load times include the start of every hour"; GitHub advises picking another minute. — [same](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- Schedules run only on the latest commit of the default branch. They are UTC by default, and an IANA timezone can now optionally be specified — [same](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- 60-day auto-disable: "In a public repository, scheduled workflows are automatically disabled when no repository activity has occurred in 60 days." — [same](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- Real-world drift: users report average delays of about 3 h, individual delays of 5–7 h, and missing runs (2026 community threads). A third-party guide claims a typical 5–30 min delay at the top of the hour and shorter at :30 (unofficial). — [Community #209514](https://github.com/orgs/community/discussions/209514), [#201472](https://github.com/orgs/community/discussions/201472), [#211258](https://github.com/orgs/community/discussions/211258), [cronuru guide](https://cronuru.com/guides/github-actions-scheduled-workflows)
- Common workaround: trigger with `workflow_dispatch` / `repository_dispatch` through the API from an external scheduler, and add a dead-man heartbeat — [Community #209514](https://github.com/orgs/community/discussions/209514)
- Minutes: standard GitHub-hosted runners in public repos are free and unmetered. Private repos on GitHub Free get $12/month of included compute (about 2,000 Linux min at $0.006/min), and usage is blocked after that without a payment method — [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- Storage: 500 MB artifacts (shared with Packages) and 10 GB cache per repo on Free — [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- Cache gotchas for session storage: "GitHub will remove any cache entries that have not been accessed in over 7 days". "You cannot change the contents of an existing cache" (you need a new key each run). Branch scoping also applies — [GitHub dependency caching](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching)
- ToS: on GitHub-hosted runners, Actions must not be used for "any other activity unrelated to the production, testing, deployment, or publication of the software project", nor "as part of a serverless application", nor for activity that places a "disproportionate" burden — [GitHub Terms for Additional Products](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features)

**Cloudflare Workers / Durable Objects / Containers**
- Workers Free: 100,000 requests/day, 10 ms CPU per HTTP request and per Cron Trigger, 5 Cron Triggers per account, 15 min max wall time per cron invocation, 50 subrequests/request, 6 simultaneous outgoing connections, 128 MB memory, 64 MiB worker size — [CF Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- Outbound WebSockets are supported: a Worker can use `new WebSocket(url)` or `fetch()` with `Upgrade: websocket` and then `resp.webSocket.accept()`. Incoming messages are capped at 32 MiB, and connections can drop during runtime updates — [CF WebSockets API](https://developers.cloudflare.com/workers/runtime-apis/websockets/)
- Durable Objects are available on Workers Free, SQLite-backed only: 100,000 requests/day, 13,000 GB-s/day duration, 5 GB storage, 5M rows read/day, 100k rows written/day. Hibernation applies to the WebSocket Hibernation API (server-side sockets), and pending I/O can keep a DO in memory for up to 15 min — [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- Containers are not available on Workers Free (marked N/A). They require Workers Paid at $5/month, which includes 25 GiB-h memory, 375 vCPU-min and 200 GB-h disk. The smallest instance, `lite`, is 1/16 vCPU, 256 MiB RAM, 2 GB disk — [CF Containers pricing](https://developers.cloudflare.com/containers/pricing/)
- KV Free: 100,000 reads/day, 1,000 writes/day, 1 GB storage — [CF KV pricing](https://developers.cloudflare.com/kv/platform/pricing/)

**Vercel (Hobby)**
- Cron on Hobby: 100 cron jobs/project, minimum interval "Once per day", precision "Per-hour (±59 min)". Expressions that run more often fail deployment. Vercel calls Cron Jobs "a legacy feature" being migrated to "Schedules" (page updated 2026-07-15) — [Vercel cron usage & pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- Functions on Hobby (Fluid compute): 300 s default and maximum duration, 2 GB / 1 vCPU, "Full Node.js coverage", 1,024 file descriptors. Vercel also lists a changelog item: "WebSocket support is now in Public Beta" (inbound server sockets) — [Vercel Functions limits](https://vercel.com/docs/functions/limitations)

**Render (free web service)**
- Spins down after 15 min without inbound traffic. 750 free instance-hours/workspace/month, after which free services are suspended. No persistent disks. "Other service types don't support Free instances" (so no free cron jobs or background workers). Free Postgres expires 30 days after creation (14-day grace) — [Render Free docs](https://render.com/docs/free)

**Oracle Cloud Always Free: best $0 fit for (A)**
- A1 Flex: 1,500 OCPU-h and 9,000 GB-h per month, equal to 2 OCPUs and 12 GB on Always Free tenancies. Plus up to two VM.Standard.E2.1.Micro (1/8 OCPU, 1 GB) — [OCI Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/resourceref.htm)
- Idle reclamation: an instance counts as idle if over 7 days the 95th-percentile CPU is under 20%, network utilization is under 20%, and memory utilization is under 20% (A1 only) — [OCI Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/resourceref.htm)
- Thresholds have changed before: 10% was cited in 2023 and raised to 15% on 2023-04-19 per community posts. Users report converting to Pay-As-You-Go stops reclamation, and some run load scripts (community advice, not Oracle guidance) — [51sec blog](https://blog.51sec.org/2023/02/oracle-cloud-cleaning-up-idle-compute.html), [oracommit 2026](https://oracommit.blogspot.com/2026/02/understanding-oci-always-free-compute.html)
- Capacity: "out of host capacity" errors mean a temporary lack of Always Free shapes in your home region. Always Free instances must be created in the home region — [OCI Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/resourceref.htm)

**Google Cloud e2-micro (Always Free)**
- 1 non-preemptible e2-micro per month in us-west1, us-central1 or us-east1. 30 GB-months standard PD. 1 GB/month egress from North America (excluding China and Australia) — [GCP free features](https://docs.cloud.google.com/free/docs/free-cloud-features)

**Fly.io**
- "New organizations don't have a free tier or a monthly free usage allowance". The trial is $1 credit for 7 days. The smallest always-on app (shared-cpu-1x, 256 MB) is $2.19/30 days. Orgs on plans discontinued in Oct 2024 keep their legacy allowances — [Fly pricing](https://docs.fly.io/about/pricing)

**Koyeb**
- One Free Instance per org: 512 MB RAM, 0.1 vCPU, 2 GB SSD, Frankfurt or Washington D.C. only. It scales to zero after 1 h without traffic. It cannot be a Worker Service, cannot use Volumes, and is "not for production" — [Koyeb instances](https://www.koyeb.com/docs/reference/instances)
- The current pricing page did not show the free compute instance at all (only free Postgres), so the free instance may be de-emphasized — [Koyeb pricing](https://www.koyeb.com/pricing)

**Railway**
- 30-day trial with a one-time $5 grant, then a Free plan with "$1 of free credit per month". Unverified trial accounts get "restricted outbound network access" — [Railway free trial docs](https://docs.railway.com/reference/pricing/free-trial)

**Hugging Face Spaces**
- CPU Basic (2 vCPU, 16 GB) is free per hour, but "creating a new Space that runs on compute (Gradio or Docker) requires a paid plan". Free Spaces sleep after 48 h of inactivity — [HF Spaces GPU/hardware docs](https://huggingface.co/docs/hub/spaces-gpus)

**PythonAnywhere (free)**
- "Free accounts' internet access goes via a proxy 'allowlist'". This is an HTTP proxy (`proxy.server:3128`), and some libraries "don't work through the proxy at all" — [PythonAnywhere help](https://help.pythonanywhere.com/pages/403ForbiddenError/)

**Northflank Sandbox**
- Free: "2 services, 2 jobs, and 1 database", "Always on, no sleeping", "No card needed". The page also showed a banner about a Northflank security incident and asked users to rotate credentials — [Northflank pricing](https://northflank.com/pricing)
- A community gist says Northflank free instances are non-persistent (no volume) — [bmaupin gist](https://gist.github.com/bmaupin/d2d243218863320b01b0c1e1ca0cf5f3)

**Deno Deploy**
- The limits page states only 512 MB memory and a 1 GB deployment size. Free request, CPU and cron limits are not stated there — [Deno Deploy pricing & limits](https://docs.deno.com/deploy/pricing_and_limits/)

**Back4app / Zeabur**
- Back4app containers: community and aggregator sources cite a free tier of 256 MB RAM, 0.25 shared CPU, 100 GB transfer and 600 active hours. These are not official — [bmaupin gist](https://gist.github.com/bmaupin/d2d243218863320b01b0c1e1ca0cf5f3), [agentdeals](https://agentdeals.dev/vendor/back4app)

### Inferences
- **GitHub Actions + (B)** works for $0 with a public repo (unlimited minutes), as long as you tolerate drift. Use a cron at an odd minute, for example `*/10` offset or `7,22,37,52 * * * *`. A better option is to trigger exact times with `workflow_dispatch` from cron-job.org or QStash, which call the GitHub REST API. Daily commits by the bot (for example updating a "last sent" JSON) also count as activity and stop the 60-day disable.
  - For a private repo, polling every 15 min is 96 runs/day × 30 ≈ 2,880 runs/month. At about 1 billed minute each, that is roughly 2,880 min, more than the about 2,000 min the $12 credit covers. Computed-time triggers at about 4/day come to about 120 min/month, which fits easily. Each job is billed by the minute, rounded up.
  - ToS gray area: a notifier bot is arguably "unrelated to the software project". This is low-risk in practice but should be flagged.
  - Changing GitHub runner IPs are datacenter IPs (see the Q5 ban-risk notes).
- **Cloudflare Workers:** the 10 ms CPU limit per cron invocation on Free is a serious obstacle for Baileys' crypto (Noise handshake, Signal encryption), even if Node compatibility let it load. Baileys also depends on Node's `ws`, `libsignal` and protobuf, and media libraries. I consider Workers Free unsuitable for Baileys. A small Worker is still a good free scheduler: its Cron Trigger computes times and calls a GitHub `workflow_dispatch` or a Northflank job.
- **Vercel Hobby:** native cron is useless for 5–15 min or exact times. A function (300 s, full Node) triggered by an external cron could, in principle, run the Baileys connect-send-disconnect if the session lives in an external DB. The cron-job.org 30 s timeout would not matter if the function keeps running after the trigger, but synchronous calls would time out at the trigger side. Unverified whether Baileys runs on Vercel.
- **Render free** can't host (A) reliably: it needs inbound pings every under-15 min (a ToS stance was not found), uses about 750 h/month (a whole month is 720–744 h, so one service just fits), and has no disk, so the session must be in an external DB. Each spin-down also kills the WS.
- **Oracle A1** is the strongest always-on $0 option. The risks are "out of capacity" at signup in popular regions such as Mumbai/Hyderabad, and idle reclamation, because a tiny bot will sit below 20% CPU/network/memory. Mitigations: upgrade to PAYG (still $0 within limits; card required) or allocate a small A1 shape. GCP e2-micro is US-only, and 1 GB egress is ample for a few messages a day.

### Gaps
- Could not confirm whether Baileys or whatsmeow has been run successfully on Cloudflare Workers (`nodejs_compat`) or Vercel Functions; no community reports found.
- Northflank Sandbox per-service CPU/RAM specs were not on the pricing page summary.
- Render's Acceptable Use Policy text could not be fetched (page content not rendered), so its stance on keep-alive pinging is unknown.
- Deno Deploy free limits (requests, CPU, Deno.cron) and whether Deploy Classic has been sunset: not stated on the fetched page.
- Zeabur free-plan limits: no reliable source found.
- Whether GCP charges for the external IPv4 on a free e2-micro: not stated on the free-tier page. Other GCP pages (not fetched) suggest in-use IPv4 is charged.
- Koyeb: conflicting signals (docs list a Free Instance; the pricing page shows none).

## Q3. External free cron triggers for exact-time wakeups

### Takeaway
cron-job.org (free, 1-minute granularity, 30 s timeout) and Upstash QStash (free: 1,000 msgs/day, 10 schedules, 15 min response timeout) can both hit a webhook at precise times. Typical uses are calling GitHub's `workflow_dispatch` API or waking a sleeping service. QStash's longer timeout and one-off delayed messages (up to 7 days) suit "computed times", for example 1 hour before each contest.

### Cited Findings
- cron-job.org: free ("entirely free of charge"), up to every minute, 30 s request timeout, 64 KB response cap, no guarantee on punctuality, and jobs auto-disabled after more than 25 consecutive failures — [cron-job.org FAQ](https://cron-job.org/en/faq/)
- Upstash QStash Free: 1,000 messages/day (soft limit), 10 active schedules, 15 min max HTTP response duration, 1 MB message size, max delay 7 days, 3-day DLQ/log retention — [QStash pricing](https://upstash.com/pricing/qstash)
- Community advice for unreliable GitHub cron: use an external scheduler to call the workflow dispatch API — [GitHub Community #209514](https://github.com/orgs/community/discussions/209514)
- Cloudflare Workers Free includes 5 Cron Triggers per account — [CF Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

### Inferences
- Pattern: a daily job fetches contests and publishes QStash delayed messages (`Upstash-Delay` / `Upstash-Not-Before`) for each reminder time. Each message calls GitHub `POST /repos/{owner}/{repo}/actions/workflows/{id}/dispatches` with a fine-grained PAT, and the Actions job sends the WhatsApp message.
  - GitHub dispatch queueing latency is usually seconds to minutes, which is far better than schedule drift.
  - Alternative: cron-job.org every 5 min calls dispatch only when the bot's state says something is due. That wastes dispatches, so it is better to have the scheduler call a cheap "is anything due?" endpoint, such as a Cloudflare Worker.

### Gaps
- No official latency figures for `workflow_dispatch` queueing.
- I did not verify the exact QStash headers or the PAT scopes.

## Q4. Free persistent storage for session/auth state

### Takeaway
The session is small (KB to a few MB), so almost any free DB works. The traps are Supabase's inactivity pause, Render Postgres's 30-day expiry, Cloudflare KV's 1,000 writes/day, and GitHub cache's 7-day eviction and immutable keys. Upstash Redis (250 MB, 500K commands/month) or Cloudflare D1/DO SQLite are low-maintenance choices. With frequent runs, Baileys writes keys often, so batch them into a single blob write per run.

### Cited Findings
- Upstash Redis Free: 250 MB data, 500K commands/month, 1 free database — [Upstash Redis pricing](https://upstash.com/pricing/redis)
- Cloudflare KV Free: 100k reads/day, 1k writes/day, 1 GB — [CF KV pricing](https://developers.cloudflare.com/kv/platform/pricing/)
- Durable Objects SQLite on Free: 5 GB, 100k rows written/day — [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- Supabase Free: 2 projects, 500 MB DB each. Free projects are paused after low activity over about a week, with a warning email first. They are restorable for up to 1 year, and activity such as a few DB requests a day usually prevents pausing (not guaranteed) — [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [Supabase pausing FAQ](https://supabase.com/kb/faqs/platform/free-project-pausing)
- Render Free Postgres expires 30 days after creation — [Render Free docs](https://render.com/docs/free)
- GitHub Actions cache: entries unused for more than 7 days are evicted, and caches can't be overwritten. Artifacts share a 500 MB quota on Free — [GitHub caching](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching), [GitHub billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- Baileys docs recommend a DB-backed auth state over multi-file for production — [Baileys auth docs](https://www.mintlify.com/whiskeysockets/Baileys/concepts/authentication)

### Inferences
- For GitHub Actions (B):
  - Option 1: encrypt the auth folder (for example with `age` or `openssl` and a key in Secrets), then commit it to the repo or a separate private repo, or push it to Upstash/R2. Committing also keeps the 60-day timer alive. Never commit plaintext creds to a public repo.
  - Option 2: GitHub cache with a key of `wa-session-${run_id}` and restore-keys prefix matching. This works but is fragile because of the 7-day eviction if runs stop.
  - Updating a repo secret from the workflow needs a PAT and the libsodium-sealed-box API. That is possible but clunky.
- whatsmeow uses a SQL store (sqlstore with SQLite/Postgres), so a Postgres URL (Neon/Supabase) plugs in directly. Baileys needs a custom `AuthenticationState` adapter or a community Redis/Mongo/Postgres auth-state package.

### Gaps
- Not fetched: Neon free limits (scale-to-zero and compute hours), Turso free limits, MongoDB Atlas M0 limits (commonly 512 MB), Cloudflare D1 and R2 free limits. These need verification from the official pricing pages.
- No figure on Baileys auth-state size or write frequency per run.

## Q5. Most reliable $0 combination, and few-$/month fallback

### Takeaway
The most reliable $0 option is architecture (B): GitHub Actions (public repo, or private within $12/month) triggered at exact times by QStash or cron-job.org via `workflow_dispatch`, with the encrypted Baileys/whatsmeow session in Upstash Redis, a committed encrypted file, or Cloudflare storage. Plain GitHub `schedule` remains as a backup. The $0 always-on alternative is an Oracle A1 VM (or Northflank Sandbox) running (A). Fallbacks: a spare Android phone on home Wi-Fi/mobile data with Termux (a residential IP, which may lower ban risk), or a cheap VPS / Fly.io from about $2.19/month.

### Cited Findings
- GitHub schedule drift and drops are documented, and an external trigger is the community fix — [GitHub docs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), [Community #209514](https://github.com/orgs/community/discussions/209514)
- Fly.io's smallest always-on machine is $2.19/30 days, with no free tier for new orgs — [Fly pricing](https://docs.fly.io/about/pricing)
- Cloudflare Workers Paid ($5/month) unlocks Containers, which include 25 GiB-h memory and 375 vCPU-min. A `lite` instance (256 MiB) left always-on would exceed 25 GiB-h (about 0.25 GiB × 730 h ≈ 183 GiB-h), so expect overage — [CF Containers pricing](https://developers.cloudflare.com/containers/pricing/)
- IP-reputation risk:
  - A third-party README claims WhatsApp silently restricts Baileys companion devices connecting from datacenter/VPS IPs and recommends residential IPs — [awesome.ecosyste.ms entry: arslanstack/whatsapp-baileys](https://awesome.ecosyste.ms/projects/github.com%2Farslanstack%2Fwhatsapp-baileys)
  - An Evolution API issue reports a Baileys session on a cloud VPS logged out, followed by a 24-h "unofficial app" restriction on the phone — [evolution-api #2693](https://github.com/evolution-foundation/evolution-api/issues/2693)
  - Older reports blame server IP blacklisting — [Baileys #225](https://github.com/WhiskeySockets/Baileys/issues/225)
  - All of these reports are anecdotal; I found no official policy.

### Inferences
- Recommended $0 stack:
  1. A public or private GitHub repo with the bot (Node + Baileys, or a Go whatsmeow static binary, which starts faster and uses less memory).
  2. A daily job (GitHub cron at an odd minute, or a CF Worker cron) that fetches contests and schedules QStash delayed messages for reminder times.
  3. QStash calls GitHub `workflow_dispatch`.
  4. The job restores the encrypted session, sends, saves the session back, records sent IDs (idempotency), and exits.
  5. Use a dedicated secondary WhatsApp number as the bot (not the student's main number), and make that account an admin of the Community announcements group.
  6. Alert via email or Telegram if the session is logged out, because a QR re-pair has to be done manually.
- Why not Vercel, Cloudflare or Render (the student's suggestions):
  - Vercel Hobby cron is once a day with ±59 min precision.
  - Cloudflare Free Workers have 10 ms CPU and Baileys is unproven there; Containers need $5/month.
  - Render free sleeps after 15 min, has no free cron or workers, and no disk.
  - Each of them can still act as part of the system: a CF Worker is a fine free scheduler or "due?" endpoint, and Vercel is a fine host for a status page.
- Few-$ fallback ranking: a spare Android phone with Termux plus a wake-lock (residential IP, $0 extra, but depends on home power and network) > Oracle PAYG (still $0 in practice) > a cheap VPS (for example Hetzner, price not verified here) > Fly.io at $2.19/month.

### Gaps
- Hetzner's current cheapest cloud VPS price (post-2025 price changes) and India-region latency were not verified.
- No sourced guidance on Termux reliability (Android battery optimization and phantom-process killing on Android 12+). This needs a separate check.
- No hard data on WhatsApp ban rates for GitHub Actions IPs compared with residential IPs.
