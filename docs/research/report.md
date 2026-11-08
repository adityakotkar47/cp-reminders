# Research findings

The findings behind the design in [architecture.md](../architecture.md). Detailed notes with every source are in this folder:

| Topic | Notes |
|---|---|
| Meta's official WhatsApp APIs | [official-whatsapp-apis.md](official-whatsapp-apis.md) |
| Unofficial WhatsApp libraries, communities, sessions, ban risk | [unofficial-whatsapp-libs.md](unofficial-whatsapp-libs.md) |
| Free hosting and scheduling | [free-hosting.md](free-hosting.md) |
| Contest data sources | [clist-contest-data.md](clist-contest-data.md) |

## No official API reaches a Community's Announcements group

Meta's Cloud API has a Groups API, but it works only on groups that the API number itself creates, caps each group at 8 participants, admits members only through an invite link, and requires an Official Business Account ([Meta Groups API](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/)). An Official Business Account requires 30 or more days on the platform, Business Verification and an approved display name, and is not granted to WhatsApp Business app numbers ([Meta OBA](https://developers.facebook.com/documentation/business-messaging/whatsapp/official-business-accounts.md)). The Groups documentation never mentions Communities, announcement groups or joining a group a user created ([Groups reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/reference.md)).

The adjacent options do not help either:

- **Coexistence** lets a WhatsApp Business app number also use the Cloud API, but group chats are not synchronised ([Meta: onboarding Business app users](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users.md)).
- **Channels** have no posting API; Meta's only Channel API is the read-only research Content Library ([Content Library](https://developers.facebook.com/docs/content-library-and-api/content-library-api/guides/wa-channel-update)).
- **Third-party agents** cannot be added to groups or communities ([WABetaInfo](https://wabetainfo.com/whatsapp-is-rolling-out-chats-with-third-party-agents/)).
- **Cost:** group messages are billed per delivered recipient at one-to-one rates, about ₹0.86 per marketing message and ₹0.115 per utility message before GST in India ([Meta group pricing](https://developers.facebook.com/docs/whatsapp/cloud-api/groups/pricing)).

The only sanctioned way to post into a community created in the WhatsApp app is by hand. Automating it means an unofficial linked device.

## The Announcements group has its own group ID

A Community is a parent group that nobody posts into. Its Announcements group is a separate `@g.us` group, marked as the community's default subgroup and linked to the parent. whatsmeow exposes this as `IsDefaultSubGroup` and `LinkedParentJID` on the results of `GetJoinedGroups` and `GetSubGroups` ([whatsmeow types/group.go](https://github.com/tulir/whatsmeow/blob/main/types/group.go), [group.go](https://github.com/tulir/whatsmeow/blob/main/group.go)); Baileys exposes it as `isCommunityAnnounce` and `linkedParent` ([Baileys GroupMetadata.ts](https://github.com/WhiskeySockets/Baileys/blob/master/src/Types/GroupMetadata.ts)). A message addressed to that one ID cannot reach any other subgroup, which is what keeps reminders out of the community's other groups. Gateway vendors describe the same model: sending an announcement "is completely identical" to sending to any group ([Whapi](https://support.whapi.cloud/help-desk/communities/send-announcement)).

Only community admins can post in Announcements ([Z-API communities](https://developer.z-api.io/en/communities/introduction)), so the sending number must be a community admin.

## whatsmeow suits a connect, send, disconnect job

- whatsmeow's `sqlstore` keeps the whole session in one SQLite or Postgres database with no adapter code ([sqlstore](https://github.com/tulir/whatsmeow/blob/main/store/sqlstore/container.go)), so saving the session means encrypting one file.
- Baileys needs a custom auth-state adapter for production; its file-based helper is documented as a guide only ([Baileys README](https://github.com/WhiskeySockets/Baileys/blob/master/README.md)). It also has an open issue in which the initial offline sync never arrives and the client hangs ([Baileys #2810](https://github.com/WhiskeySockets/Baileys/issues/2810)), which hurts a short-lived job.
- Both libraries rotate Signal keys on every connection, and failing to save the updated keys stops messages from being delivered ([Baileys README](https://github.com/WhiskeySockets/Baileys/blob/master/README.md)).
- Browser-based clients (whatsapp-web.js, WAHA's WEBJS engine) need headless Chromium, which is too heavy for free hosting ([WAHA engines](https://waha.devlike.pro/docs/how-to/engines/)).

## clist.by supplies the schedule

`GET https://clist.by/api/v4/contest/` with `Authorization: ApiKey <username>:<key>` returns contests with UTC start and end times and `duration` in seconds, limited to 10 requests a minute ([clist API v4](https://clist.by/api/v4/doc/)). The resource IDs are Codeforces 1, CodeChef 2, AtCoder 93 and LeetCode 102, so `resource_id__in=1,2,93,102&start__gt=<now>&order_by=start` covers the four platforms.

- `upcoming=true` means "not yet ended" and includes running contests; `start__gt` excludes them ([clist v2.py](https://github.com/aropan/clist/blob/master/src/clist/api/v2.py)).
- Start times can arrive without a `Z` and are UTC.
- The data includes simultaneous Codeforces Div. 1 and Div. 2 rounds, placeholder names such as "Codeforces Round (Div. 2)", and week-long events such as "Kotlin Heroes: Practice", so selection rules are needed.
- clist's terms allow free use for personal, educational and community projects, ask for caching, for the key to stay out of public repositories and for attribution in public projects, and disclaim liability for missed contests ([clist terms](https://clist.by/terms/)).

The platforms' own endpoints answer without a key and serve as fallbacks: Codeforces `contest.list` (Unix UTC), LeetCode's `upcomingContests` GraphQL query (Unix UTC), CodeChef `/api/list/contests/all` (`+05:30` times) and AtCoder's contests page (HTML, JST). The LeetCode and CodeChef endpoints are undocumented. kontests.net does not respond ([API Bouncer](https://www.apibouncer.com/apis/844/kontests)).

## Hosting: Cloudflare schedules, GitHub Actions sends

The sender has to hold a websocket, run Signal cryptography and persist keys that change on every run.

| Host | Fit |
|---|---|
| Vercel Hobby | Cron runs at most once a day with ±59-minute precision ([Vercel cron](https://vercel.com/docs/cron-jobs/usage-and-pricing)). Unsuitable. |
| Render Free | Sleeps after 15 minutes without inbound traffic; no persistent disk, cron jobs or background workers ([Render free](https://render.com/docs/free)). Unsuitable. |
| Cloudflare Workers Free | 10 ms of CPU per invocation is too little for a WhatsApp handshake; Containers need the paid plan ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Containers pricing](https://developers.cloudflare.com/containers/pricing/)). Fetching JSON and date arithmetic are mostly I/O, so a Worker suits the scheduler. |
| GitHub Actions | The `schedule` trigger can be delayed or dropped ([GitHub events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)), but a `workflow_dispatch` started through the API begins within seconds to minutes. A private repository gets about 2,000 Linux minutes a month ([Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)). Suits the sender. |
| Oracle Always Free | The one always-on free VM (up to 2 ARM OCPUs, 12 GB). Instances whose CPU, network and memory stay under 20% for 7 days can be reclaimed, and free shapes are often out of capacity ([OCI Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/resourceref.htm)). An alternative host for the sender. |
| Koyeb, Hugging Face, Fly.io | Free tiers sleep or do not exist for new accounts ([Koyeb](https://www.koyeb.com/docs/reference/instances), [HF Spaces](https://huggingface.co/docs/hub/spaces-gpus), [Fly pricing](https://docs.fly.io/about/pricing)). Unsuitable. |

GitHub's cache evicts entries after 7 days and cannot be overwritten ([dependency caching](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching)), so it cannot hold the rotating session. Restoring an encrypted session from a branch and committing it back after each run is an established pattern ([Baileys Agent Kit](https://glama.ai/mcp/servers/I-No-oNe/baileys-agent-kit/tree)).

GitHub-hosted runners and Oracle VMs connect from datacenter IP addresses. Reports suggest WhatsApp is stricter with companion devices on datacenter IPs ([evolution-api #2693](https://github.com/evolution-foundation/evolution-api/issues/2693)), but there is no published evidence either way.

## Ban risk

WhatsApp's Terms prohibit "bulk messaging, auto-messaging" and "non-personal use … unless otherwise authorized" ([Terms](https://www.whatsapp.com/legal/terms-of-service)). Linking an account to an unofficial client "violates our Terms of Service" and can lead to a temporary or permanent ban ([FAQ: unofficial apps](https://faq.whatsapp.com/1217634902127718/?locale=en_US)). Enforcement uses machine-learning classifiers ([FAQ: automated messaging](https://faq.whatsapp.com/5957850900902049/?locale=en_US)). Low volume lowers the chance of detection; it does not make the automation compliant.

The evidence on real risk is anecdotal. The widespread restrictions reported in 2026 (error 463, "reach-out timelock") hit one-to-one messages to people the account had never contacted, while group sends kept working ([Baileys #2441](https://github.com/WhiskeySockets/Baileys/issues/2441), [#2699](https://github.com/WhiskeySockets/Baileys/issues/2699)). Some whatsmeow users received "unauthorized tools" warnings without bulk messaging ([whatsmeow #810](https://github.com/tulir/whatsmeow/issues/810)), and Baileys has reports of bans at low volume ([Baileys #2075](https://github.com/WhiskeySockets/Baileys/issues/2075)). Meta publishes no thresholds.

Practices that keep the risk as low as it goes:

- Use an established number with normal human usage rather than a fresh one.
- Randomise send times.
- Never send direct messages, replies or Status updates, and never add participants, from the bot number.
- Never run two connections on one session; duplicate sockets are the most common way a disconnect turns into a ban ([Baileys #2707](https://github.com/WhiskeySockets/Baileys/issues/2707)).
- Open WhatsApp on the bot's phone at least every 14 days: linked devices are logged out after 14 days without the phone being used, and after 30 days of device inactivity ([FAQ: linked devices](https://faq.whatsapp.com/378279804439436/?locale=en_US)).
- Keep the owner's main number as the Community owner, so a ban costs a SIM, not the community.

## Other terms

GitHub's terms exclude using hosted runners for activity "unrelated to the production, testing, deployment, or publication of the software project" or "as part of a serverless application" ([GitHub additional product terms](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features)). A notifier running a few short jobs a day sits in a grey area; an always-on VM avoids the question. clist's terms are met by keeping the key in secrets and caching for an hour.
