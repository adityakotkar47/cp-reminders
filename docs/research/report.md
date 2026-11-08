# Post contest reminders through a linked spare number

Research snapshot from 2026-11-07, before implementation. The implemented design is [docs/architecture.md](../architecture.md); where they differ, the architecture wins.

No official WhatsApp API can post into a Community's Announcements group as of November 2026. The only way to automate this is to log the spare number in as an unofficial "linked device" (whatsmeow in Go, or Baileys in Node) and send to the Announcements group's own group ID. That ID is separate from every other sub-group, so the message reaches only Announcements. The best $0 setup splits the work in two. **A Cloudflare Worker is the "brain"**: on a cron it pulls contests from clist.by, decides when a reminder is due (start minus 75 minutes) and formats the exact message. **A GitHub Actions job is the "hands"**: it restores the encrypted WhatsApp session, posts one message, saves the session and exits. If those short-lived sessions prove fragile, the fallback keeps the same Worker but swaps the hands for an always-on process on an Oracle Always Free VM. Vercel and Render cannot host the sender itself: Vercel Hobby cron runs once a day with ±59-minute precision, and Render's free tier sleeps. Cloudflare is the one of your three suggestions that earns a place, as the scheduler. The catch is the Terms of Service. Any automation of a normal WhatsApp account through an unofficial client breaks WhatsApp's Terms, and the spare number can be temporarily or permanently banned. Posting one to four messages a day only into a group you run is the lowest-risk pattern there is, but it is not risk-free. A ban hits only the spare number, provided your main number stays the Community owner.

## Meta's official API stops at 8-person groups it created itself

The obvious "legitimate" route turns out to be a dead end, and it is worth knowing why before accepting the unofficial one. Meta's Cloud API now has a Groups API. It works only for groups that the API number creates, **caps each group at 8 participants**, lets people join only through an invite link, and requires an **Official Business Account (OBA)** ([Meta Groups API docs](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/)). OBA requires 30+ days on the platform, Business Verification of a business portfolio and an approved display name, and it is not granted to test accounts or WhatsApp Business app numbers ([Meta OBA docs](https://developers.facebook.com/documentation/business-messaging/whatsapp/official-business-accounts.md)). Neither the Groups overview nor its reference mentions Communities, announcement groups, or joining a group a user created ([Groups reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/reference.md)). Your Community was created by a person in the WhatsApp app, so the API cannot reach it.

The workarounds fail as well. "Coexistence" lets a WhatsApp Business app number also use the Cloud API, but **group chats are not synchronized** and channels are unsupported ([Meta: Onboarding Business app users](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users.md)). The only Meta developer API that touches Channels is the read-only research Content Library ([Meta Content Library guide](https://developers.facebook.com/docs/content-library-and-api/content-library-api/guides/wa-channel-update)). WhatsApp's new 2026 "third-party agents" feature reportedly **cannot be added to groups or communities** ([WABetaInfo](https://wabetainfo.com/whatsapp-is-rolling-out-chats-with-third-party-agents/)). Cost would not help even if the API did reach your group. Group messages are billed per delivered recipient at 1:1 rates, about ₹0.86 per marketing message or ₹0.115 per utility message before GST in India ([Meta Groups pricing](https://developers.facebook.com/docs/whatsapp/cloud-api/groups/pricing); [ChatMaxima](https://chatmaxima.com/whatsapp-api-pricing/india/)). Officially, then, the only sanctioned way to post into your Announcements group is to type it by hand. Everything below is therefore a deliberate, informed choice to step outside the Terms with a disposable number.

## The Announcements group is its own JID, so sub-groups never see the post

Your requirement to post in Announcements and nowhere else is easy to meet at the protocol level. A Community is a "parent" group that you never post into. Its built-in Announcements group is a **separate `@g.us` group, marked as the community's default sub-group and linked to the parent**. Baileys exposes it as `isCommunityAnnounce: true` with `linkedParent` equal to the community JID ([Baileys GroupMetadata.ts](https://github.com/WhiskeySockets/Baileys/blob/master/src/Types/GroupMetadata.ts); [Baileys groups.ts](https://github.com/WhiskeySockets/Baileys/blob/master/src/Socket/groups.ts)). whatsmeow exposes it as `IsDefaultSubGroup` with `LinkedParentJID`, through `GetJoinedGroups(ctx)` or `GetSubGroups(ctx, communityJID)` ([whatsmeow types/group.go](https://github.com/tulir/whatsmeow/blob/main/types/group.go); [whatsmeow group.go](https://github.com/tulir/whatsmeow/blob/main/group.go)). Whapi.Cloud documents the same facts from the gateway side: the Announcements group "is technically separate from the Community's main group", has the same name but a different ID, and "sending an announcement to a community is completely identical" to sending to any group ([Whapi: Send announcement](https://support.whapi.cloud/help-desk/communities/send-announcement)). A send addressed to that one JID cannot leak into other sub-groups. Find the JID once with a discovery script, store it as a secret, and the bot never has to list groups again.

```go
// one-off discovery: prints every group with its community flags
groups, _ := client.GetJoinedGroups(ctx)
for _, g := range groups {
    fmt.Println(g.JID, g.Name, "parent:", g.IsParent,
        "announce-subgroup:", g.IsDefaultSubGroup, "linkedParent:", g.LinkedParentJID)
}
// the target is the row with IsDefaultSubGroup == true AND LinkedParentJID == <your community>
```

Only community admins can post in Announcements. Vendor docs say so, and Baileys defines the `announce` flag as "only allows admins to write messages" ([Z-API communities](https://developer.z-api.io/en/communities/introduction); [GroupMetadata.ts](https://github.com/WhiskeySockets/Baileys/blob/master/src/Types/GroupMetadata.ts)). The spare number must therefore be **promoted to community admin**, while your main number stays owner. I could not find the exact error the server returns when a non-admin tries to post, so the test plan below checks that case directly.

### whatsmeow beats Baileys for a connect-send-exit job

All the main libraries were actively maintained in November 2026. Baileys was last pushed 2026-11-01 (latest `7.0.0-rc14`) and whatsmeow 2026-11-06. WAHA, a Docker REST wrapper, made its former paid "Plus" features free in 2026.6 ([GitHub API: Baileys](https://api.github.com/repos/WhiskeySockets/Baileys); [GitHub API: whatsmeow](https://api.github.com/repos/tulir/whatsmeow); [WAHA 2026.6](https://waha.devlike.pro/blog/waha-2026-6/)). For this design I recommend **whatsmeow**. Its `sqlstore` keeps the entire session in one SQLite or Postgres database with no adapter code ([whatsmeow sqlstore](https://github.com/tulir/whatsmeow/blob/main/store/sqlstore/container.go)), so "save the session" just means encrypting one file. Baileys works too, but it has three problems for this job:

- It needs a custom auth-state adapter for production, since its file helper is described as only a guide ([Baileys README](https://github.com/WhiskeySockets/Baileys/blob/master/README.md)).
- It has an open bug where the initial offline sync "never arrives" and the client hangs, which hurts a script that connects, sends and exits ([Baileys #2810](https://github.com/WhiskeySockets/Baileys/issues/2810)).
- Versions below 6.7.22 / 7.0.0-rc13 carry CVE-2026-48063 ([Vulners](https://vulners.com/euvd/EUVD-2026-52440)).

Both libraries share one hard rule: Signal keys change on every send, and **failing to save the updated keys stops messages from reaching recipients** ([Baileys README](https://github.com/WhiskeySockets/Baileys/blob/master/README.md)). Avoid browser-based engines (whatsapp-web.js, WAHA WEBJS). They need headless Chromium, which is too heavy for free hosting ([WAHA engines doc](https://waha.devlike.pro/docs/how-to/engines/)).

## clist.by supplies the schedule, and four direct APIs back it up

clist's v4 API takes one call: `GET https://clist.by/api/v4/contest/` with the header `Authorization: ApiKey <username>:<key>`. The defaults are **10 requests per minute**, UTC timestamps and `duration` in integer seconds ([clist API v4 doc](https://clist.by/api/v4/doc/); [clist settings.py](https://github.com/aropan/clist/blob/master/src/pyclist/settings.py)). The resource IDs are **Codeforces = 1, CodeChef = 2, AtCoder = 93, LeetCode = 102**, so `resource_id__in=1,2,93,102&start__gt=<now>&order_by=start` returns exactly your four platforms ([clist Codeforces resource](https://clist.by/resource/codeforces.com/); [AtCoder](https://clist.by/resource/atcoder.jp/); [LeetCode](https://clist.by/resource/leetcode.com/)). Two traps to avoid:

- `upcoming=true` means "not yet ended", so it also returns contests that are already running. Filter on `start__gt` instead ([clist v2.py](https://github.com/aropan/clist/blob/master/src/clist/api/v2.py)).
- Never set `format_time=true`, which turns the duration into human text. Also parse the datetime defensively, since it may arrive without a `Z`.

The ToS describes your use case: a free API "intended mainly for personal, educational and community projects". It asks you to cache results, **keep the key out of public repos**, and attribute CLIST in public projects ([clist ToS](https://clist.by/terms/)). A footer such as "Data: CLIST" in the Community description covers attribution without changing your message format.

The data needs some filtering. On 7 November 2026, Codeforces' own list included Div. 1 and Div. 2 rounds sharing a 14:35 UTC start, placeholder entries named just "Codeforces Round (Div. 2)", and a 7-day "Kotlin Heroes: Practice 15" ([Codeforces API contest.list](https://codeforces.com/api/contest.list?gym=false)). The formatter should do three things:

- Drop events lasting a day or more.
- Hold back unnamed placeholders.
- Optionally merge simultaneous Div. 1/Div. 2 rounds into one post.

Dedupe on clist's `id` together with `start`. A changed `start` then counts as a reschedule and creates a new reminder rather than a duplicate. clist disclaims any accuracy guarantee and liability for "missed contests" ([clist ToS](https://clist.by/terms/)), so build in a fallback. All four platforms were reachable without a key in live tests:

| Platform | Source | Times |
|---|---|---|
| Codeforces | `contest.list` | `startTimeSeconds` in UTC |
| LeetCode | `upcomingContests` GraphQL query | Unix UTC |
| CodeChef | `/api/list/contests/all` | ISO, already `+05:30` |
| AtCoder | HTML scrape of `#contest-table-upcoming` | JST |

Sources: [Codeforces API](https://codeforces.com/api/contest.list?gym=false), [LeetCode GraphQL](https://leetcode.com/graphql), [CodeChef API](https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all), [AtCoder](https://atcoder.jp/contests/). kontests.net is dead, so do not use it ([API Bouncer](https://www.apibouncer.com/apis/844/kontests)). The LeetCode and CodeChef endpoints are undocumented, and they were tested from a home IP, so they may challenge datacenter IPs.

The formatter reproduces your manual message exactly. 14:35 UTC plus 5:30 is 8:05 PM IST. 8,100 seconds becomes "2:15 hours". The reminder goes out at start minus 75 minutes, so 6:50 PM IST for that round:

```ts
const PLATFORM: Record<number,string> = {1:"Codeforces", 2:"CodeChef", 93:"AtCoder", 102:"LeetCode"};
function formatReminder(c: {resource_id:number; event:string; start:string; duration:number; href:string}) {
  const s = /[zZ]|[+-]\d\d:?\d\d$/.test(c.start) ? c.start : c.start + "Z";      // clist = UTC
  const ist = new Date(Date.parse(s) + 330 * 60_000);                            // UTC+5:30
  const H = ist.getUTCHours(), M = ist.getUTCMinutes();
  const time = `${H % 12 || 12}:${String(M).padStart(2,"0")} ${H >= 12 ? "PM" : "AM"}`;
  const mins = Math.round(c.duration / 60);
  const dur = `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2,"0")} hours`;
  let msg = `🚨 Contest Reminder 🚨\n\n📍 Platform: ${PLATFORM[c.resource_id]}\n🏆 Contest Name: ${c.event}` +
            `\n🕒 Timing: ${time}\n⏳ Duration: ${dur}\n🔗 Contest Link: ${c.href}`;
  if (H < 12) msg += `\n\n📌 Tip: morning contests build discipline`;           // optional tip rule
  return msg;
}
```

The morning-only tip rule is my guess at your intent; swap in whatever rule or rotating tip list you prefer. I could not capture a live authenticated clist response, so the exact format of `href` is unconfirmed (for example, whether Codeforces links come as `/contests/{id}`). Check it against a real response in phase 1 of the plan, and build the Codeforces link from the contest ID if needed.

## Vercel, Render and Cloudflare all fail as the sender, but Cloudflare makes a good scheduler

The sender has to hold a websocket, run Signal cryptography, and persist keys that change on every run. Your three suggestions each fail at that for a different reason:

- **Vercel Hobby** allows cron only "once per day" with "±59 min" precision ([Vercel cron pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)). Its 300-second Node functions could in theory run the sender if triggered from outside, but nobody has reported running Baileys or whatsmeow there.
- **Render Free** spins down after 15 minutes without inbound traffic, has no persistent disk, and offers no free cron jobs or background workers ([Render Free docs](https://render.com/docs/free)).
- **Cloudflare Workers Free** allows only **10 ms of CPU per cron invocation**, which is far too little for a WhatsApp handshake and encryption. Cloudflare Containers require the $5/month paid plan ([CF Workers limits](https://developers.cloudflare.com/workers/platform/limits/); [CF Containers pricing](https://developers.cloudflare.com/containers/pricing/)).

The same limits make a Worker an ideal scheduler. It gets 5 free Cron Triggers, 100,000 requests a day, and KV storage with 1,000 writes a day ([CF Workers limits](https://developers.cloudflare.com/workers/platform/limits/); [CF KV pricing](https://developers.cloudflare.com/kv/platform/pricing/)). Fetching JSON and doing date arithmetic is mostly waiting on the network, which does not count against CPU time.

The heavy lifting then goes to GitHub Actions. Its own `schedule` trigger is unreliable: GitHub says runs "can be delayed" and "may be dropped" at busy times ([GitHub docs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)), and users report delays of hours ([Community #209514](https://github.com/orgs/community/discussions/209514)). Triggered through the `workflow_dispatch` API, however, a job usually starts within seconds to minutes. A private repo gets **$12 of monthly compute, about 2,000 Linux minutes** ([GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)). Four one-minute sends a day use about 120 minutes, which leaves plenty of room.

Other always-on free hosts mostly fall short. Koyeb and Hugging Face free tiers sleep, and Fly.io has no free tier for new organisations ([Koyeb](https://www.koyeb.com/docs/reference/instances); [HF Spaces](https://huggingface.co/docs/hub/spaces-gpus); [Fly pricing](https://docs.fly.io/about/pricing)). The one genuinely always-on free host is **Oracle Always Free**: up to 2 ARM OCPUs and 12 GB. It comes with two caveats. Instances count as idle, and can be reclaimed, if 95th-percentile CPU, network and memory all stay under 20% for 7 days. Free shapes can also be "out of host capacity" in your home region ([OCI Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/resourceref.htm)). Oracle is the fallback, not the primary, because a tiny bot is exactly the idle workload that reclamation targets.

## Recommended architecture: Cloudflare as the brain, GitHub Actions as the hands, Oracle as the fallback

**Primary: Worker scheduler plus GitHub Actions sender, all $0 with no card.** Each part of the system lives on the host that suits it:

| Component | Where | What it does |
|---|---|---|
| Scheduler | Cloudflare Worker, cron `*/5 * * * *` | Fetches clist **once an hour** into KV, which meets the ToS caching rule. Falls back to the direct platform APIs on clist 401/429/5xx or an empty result. Every 5 minutes, finds contests whose send time (start minus 75 min) has arrived and whose start is still at least 45 minutes away. Builds the exact message text and writes a `dispatched:{id}:{start}` marker in KV. Calls GitHub `POST /repos/{owner}/{repo}/actions/workflows/send.yml/dispatches` with `{key, text}` using a fine-grained PAT that can only run Actions on this repo. |
| Redundant trigger | cron-job.org (free, 1-minute granularity) | Hits the Worker's `/tick` HTTP route every 5 minutes as well. The KV marker makes a double tick harmless ([cron-job.org FAQ](https://cron-job.org/en/faq/)). |
| Sender | GitHub Actions in a **private** repo | Runs under `concurrency: wa-session` (never two sockets on one session). Checks out a `state` branch, decrypts `session.db` with an `age` key from Secrets, and checks `sent.json` for `key`. Waits 0–90 seconds of random jitter, connects whatsmeow with a 60-second timeout, and sends `text` to the single `ANNOUNCE_JID` secret. Then appends to `sent.json`, disconnects cleanly, and re-encrypts and commits the state in an `if: always()` step. |
| Session state | Encrypted `session.db` on the `state` branch (or Upstash Redis Free, 250 MB) | The keys must be written back after every run. GitHub cache is unsuitable because it evicts entries after 7 days and cannot be overwritten ([GitHub caching](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching); [Upstash Redis](https://upstash.com/pricing/redis)). |
| Alerts | Job failure, plus a Telegram/email ping | A `LoggedOut` event or failed send makes the job fail. The alert includes the formatted message text, so you can paste it by hand that day. |

This pattern of restoring encrypted auth state from a branch on each run and committing it back afterwards already exists for Baileys ([Baileys Agent Kit](https://glama.ai/mcp/servers/I-No-oNe/baileys-agent-kit/tree)). The design has three parts that matter most. First, the Worker owns all the logic, so GitHub runs only when there is something to send. Second, `sent.json` is checked inside the concurrency lock, which makes the job idempotent even if a dispatch fires twice. Third, a single allowlisted JID means a bug cannot spray messages into other groups.

**Fallback: same Worker, always-on hands.** If testing shows the short-lived sessions are fragile (hangs on connect, logouts after reconnects, or "unauthorized tools" warnings), run the same whatsmeow binary as a daemon on an Oracle Always Free A1 VM. Give it one authenticated `/send` endpoint and point the Worker at it instead of GitHub. A persistent session from one stable IP avoids repeated offline-sync bursts and races when saving state. Converting the Oracle account to Pay-As-You-Go is reported to stop idle reclamation while staying $0 within free limits, though this is community advice, not Oracle policy ([oracommit 2026](https://oracommit.blogspot.com/2026/02/understanding-oci-always-free-compute.html)). It needs a card, and signup capacity in Mumbai or Hyderabad is not guaranteed. There is also a no-code emergency fallback: Whapi.Cloud's free Sandbox (150 messages a day, 5 conversations a month), which supports Community announcement sends. The Worker can call it over REST. The price is that **a third party holds the full session and can read every chat** on the spare number ([Whapi pricing](https://whapi.cloud/price)). The last resort is the alert itself: it carries the ready-to-paste text, so a missed send costs you thirty seconds of manual posting.

One unresolved trade-off remains. Anecdotal reports claim WhatsApp is harsher on companion devices connecting from datacenter IPs. One Evolution API user on a cloud VPS was logged out and then got a 24-hour "unofficial app" restriction ([evolution-api #2693](https://github.com/evolution-foundation/evolution-api/issues/2693); [arslanstack/whatsapp-baileys](https://awesome.ecosyste.ms/projects/github.com%2Farslanstack%2Fwhatsapp-baileys)). GitHub runners and Oracle are both datacenter IPs. A spare Android phone running the bot on home Wi-Fi would have a residential IP, but nobody has verified how reliable that is on a phone (Android kills background processes). It also only partly honours your "no laptop running" goal.

## The ban risk is real, unmeasured, and limited to the spare number

The Terms are clear-cut. WhatsApp's Terms prohibit "bulk messaging, auto-messaging" and "non-personal use … unless otherwise authorized" ([WhatsApp Terms](https://www.whatsapp.com/legal/terms-of-service)). The FAQ adds that linking an account to unofficial versions "violates our Terms of Service" and the account "might also be temporarily or permanently banned" ([WhatsApp FAQ: unofficial apps](https://faq.whatsapp.com/1217634902127718/?locale=en_US)). Bans come from machine-learning classifiers ([WhatsApp FAQ: automated messaging](https://faq.whatsapp.com/5957850900902049/?locale=en_US)). Your low volume does not make this compliant. It makes it less likely to be detected.

The evidence on actual risk is anecdotal. The big 2026 wave of restrictions, error 463 "Reach-out Timelock", hit **1:1 messages to people who had never been contacted**. One report found that a restricted account's group sends still worked ([Baileys #2441](https://github.com/WhiskeySockets/Baileys/issues/2441); [Baileys #2699](https://github.com/WhiskeySockets/Baileys/issues/2699)). Your bot never sends 1:1, so that whole class of problem does not apply. Still, whatsmeow users saw "Your account may be at risk … unauthorized tools" warnings "even for clients that are not performing bulk messaging", and some were banned ([whatsmeow #810](https://github.com/tulir/whatsmeow/issues/810)). Baileys has open reports of bans at low volume ([Baileys #2075](https://github.com/WhiskeySockets/Baileys/issues/2075)). Meta publishes no thresholds, and nobody has published ban rates for group-only bots.

You can still keep the risk as low as it gets:

- Use the spare number by hand for a week or two before automating it. Community advice blames "no warmup on new numbers" and fixed-interval sends for many bans ([Baileys #2075](https://github.com/WhiskeySockets/Baileys/issues/2075)).
- Add jitter to send times.
- Never DM, reply, upload Status or add participants from the bot number.
- Never run two sockets at once. Duplicate sockets on one session are called "the single most common cause … for a disconnect turning into an actual ban" ([Baileys #2707](https://github.com/WhiskeySockets/Baileys/issues/2707)).
- **Open WhatsApp on the spare phone at least every 14 days**, because linked devices log out after 14 days without the phone being used and after 30 days of device inactivity ([WhatsApp FAQ: linked devices](https://faq.whatsapp.com/378279804439436/?locale=en_US)).

Above all, **keep your main number as the Community owner**. A ban then costs you a SIM, not your community.

There are two smaller compliance points. GitHub's terms bar using hosted runners for activity "unrelated to the production, testing, deployment, or publication of the software project" or "as part of a serverless application" ([GitHub Additional Product Terms](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features)). A notifier bot sits in a grey area. At four short runs a day the practical risk is low, and the Oracle fallback avoids the question entirely. clist's terms require a secret key and attribution, which the design already handles.

## Build and test plan: prove it on a throwaway community first

Each phase has a pass condition, and you should not move on until it is met. The temporary community is created by the spare number. A second test community, owned by your main number with the spare number as admin, mirrors the production permission model exactly. That matters because "admin of someone else's community" is the case most likely to behave differently.

| # | Phase | Concrete steps | Pass condition |
|---|---|---|---|
| 0 | Prepare accounts (week 0) | Put the spare SIM's WhatsApp on a phone that stays on Wi-Fi. Use it by hand for 1–2 weeks: chat with a few contacts, join groups, and have it saved in contacts. Create a clist account and API key, a private GitHub repo, a Cloudflare account and a cron-job.org account. | Spare number has normal usage history, and all keys are stored only in secret stores |
| 1 | Data layer, offline | Write the clist client with `resource_id__in=1,2,93,102` and `start__gt=now`, plus direct-API fallbacks for CF, LC, CC and AtCoder. Capture real responses as fixtures. Unit-test UTC-to-IST conversion, the 12-hour clock, "H:MM hours", the ≥1-day and placeholder filters, the Div. 1/2 merge, and reschedule handling (new `start` gives a new key). | Formatter output for your example is **byte-identical** to the manual message, including emoji and `\n\n`. A real clist response confirms the `href` and datetime format. |
| 2 | Pair the session (laptop allowed for one-time setup) | Run the whatsmeow pairing program on your laptop and scan the QR code with the spare phone. Encrypt `session.db` with `age` and push it to the `state` branch. Put the `age` key in GitHub Secrets. | Phone shows exactly one linked device, and decrypting and reconnecting from a second run needs no QR |
| 3 | Test community A (spare number is owner) | From the spare phone, create the Community "CP Bot Test", which creates Announcements automatically. Add two sub-groups ("Test General", "Test Doubts") and add your main number as a member. Run the discovery script and record the parent JID, the Announcements JID (`IsDefaultSubGroup` true, `LinkedParentJID` equal to the parent) and the sub-group JIDs. Send one message by hand-triggered dispatch. | From your main phone, the message appears **only** in Announcements and not in either sub-group. The Announcements JID stays the same across two discovery runs. |
| 4 | Test community B (mirrors production) | Create "CP Bot Test 2" from your **main** number and add the spare number. First send while the spare number is a plain member (expect a rejection, and log the error). Then promote it to community admin and send again. | Non-admin send fails and the job reports it. Admin send lands in Announcements only. |
| 5 | Sender on GitHub Actions | Add `send.yml` (`workflow_dispatch` inputs `key`, `text`; `concurrency: wa-session`; 60-second connect timeout; `if: always()` state commit). Trigger it by hand 5 times in a row, then twice at once with the same `key`. | Five sends with no re-pair. The duplicate dispatch produces exactly one message. Each run takes about 1 billed minute. |
| 6 | Scheduler on Cloudflare | Deploy the Worker with `DRY_RUN=true`, then point it at test community B's JID. Inject a fake contest starting 80 minutes from now. Add cron-job.org as the second trigger. | Fake reminder posts once, about 75 minutes before its start (±5 min). A double tick does not duplicate. |
| 7 | Failure drills | Revoke the linked device from the phone, which should trigger a `LoggedOut` alert carrying the message text. Break the clist key to confirm the direct-API fallback. Disable the Worker for a while to confirm cron-job.org covers. | Every failure produces an alert or a correct fallback send. No failure is silent. |
| 8 | Soak (1 week on test community B) | Run with real clist data into test community B and compare against your manual schedule every day. Review the send path. | Zero missed, early or duplicate reminders over 7 days, and no WhatsApp warning banners |
| 9 | Production cutover | Add the spare number to your real Community and promote it to admin. Set `ANNOUNCE_JID` to the real Announcements JID, confirmed with the discovery script. For the first 2–3 days, keep watching and be ready to delete a bad post. Then delete both test communities. Open WhatsApp on the spare phone at least every 14 days from then on. | Reminders reach real Announcements only. Your main number remains owner. |

If phase 5 or the soak shows ephemeral-session trouble (hangs, unexplained logouts, warning banners), move to the Oracle fallback. Phases 3–4 and 6–9 stay the same, because only the sender's host changes.

## Conclusion

The real constraint is not hosting, data or formatting. Those are solved at $0 with well-documented free tiers. The constraint is that Meta offers no sanctioned path into a Community, so the project is a bet that a low-volume, group-only, well-behaved linked device stays under WhatsApp's classifiers. The architecture is built around that bet. It keeps the risky part as small and swappable as possible: one session, one allowlisted JID, a few seconds online a few times a day. The scheduling logic lives where failure is cheap, and every failure ends in a ready-to-paste message rather than silence.

The honest framing is that this is an unofficial tool on a number you can afford to lose.
