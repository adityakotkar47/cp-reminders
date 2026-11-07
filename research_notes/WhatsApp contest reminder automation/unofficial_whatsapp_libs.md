# Unofficial WhatsApp Web / Multi-Device Libraries and Gateways for Posting to a Community Announcements Group (as of Nov 2026)

Research date: 2026-11-07. Maintenance data (commit dates, npm/PyPI versions) was pulled live from the GitHub API, npm registry and PyPI on that date.

## Q1. Library and gateway landscape: maintenance in 2026, footprint, Chromium requirement

### Takeaway
All the main options are actively maintained as of Nov 2026. Baileys (Node) and whatsmeow (Go) talk to WhatsApp directly over a websocket and need no browser, so they are the lightweight choices for a 1-4 msg/day bot. whatsapp-web.js and WAHA's WEBJS/WPP engines run a headless Chromium. WAHA is a Docker REST wrapper whose NOWEB engine is a Baileys fork and whose GOWS engine is Go (whatsmeow-style), and since WAHA 2026.6 all former "Plus" features are free. Evolution API is a Baileys-based REST gateway (still on Baileys 7.0.0-rc.9).

### Cited Findings
**Baileys (WhiskeySockets/Baileys, Node/TS, websocket, no browser)**
- Last push to the repo was 2026-11-01. It has about 11.5k stars and 335 open issues, and is not archived. — [GitHub API: WhiskeySockets/Baileys](https://api.github.com/repos/WhiskeySockets/Baileys)
- On npm, the `latest` dist-tag is `7.0.0-rc14` (published 2026-07-29) and `legacy` is `6.7.24` (2026-07-29). No stable 7.0.0 had been released by Nov 2026. — [npm registry @whiskeysockets/baileys](https://registry.npmjs.org/@whiskeysockets/baileys)
- In the rc10 notes the maintainer said the project had gone more than 5 months without a release, called rc10 the "final release candidate", and planned weekly patches after v7. rc11 to rc14 shipped after that anyway. — [newreleases.io v7.0.0-rc10](https://newreleases.io/project/github/WhiskeySockets/Baileys/release/v7.0.0-rc10)
- Baileys versions below 6.7.22 are affected by a 2026 CVE (CVE-2026-48063 / EUVD-2026-52440): message upsert and history-sync spoofing and app-state corruption via a crafted protocolMessage. Use 6.7.22 or later, or 7.0.0-rc13 or later. — [Vulners EUVD-2026-52440](https://vulners.com/euvd/EUVD-2026-52440)
- The README describes Baileys as authenticating "as a second WhatsApp client by scanning a QR code or Pairing Code". It also says: "Do not spam people with this. We discourage any stalkerware, bulk or automated messaging usage." — [Baileys README](https://github.com/WhiskeySockets/Baileys/blob/master/README.md)

**whatsmeow (tulir/whatsmeow, Go, websocket, no browser)**
- Last push was 2026-11-06 and it has about 7.8k stars. It is the library behind the mautrix-whatsapp bridge. — [GitHub API: tulir/whatsmeow](https://api.github.com/repos/tulir/whatsmeow)
- The README lists "Sending messages to private chats and groups (both text and media)", "Managing groups", and "Reading and writing app state". Broadcast lists and calls are not implemented. — [whatsmeow README](https://github.com/tulir/whatsmeow)
- Docs are at [pkg.go.dev/go.mau.fi/whatsmeow](https://pkg.go.dev/go.mau.fi/whatsmeow). The Matrix room is #whatsmeow:maunium.net.

**whatsapp-web.js (Puppeteer + Chromium)**
- The repo moved from `pedroslopez/whatsapp-web.js` to `wwebjs/whatsapp-web.js` (GitHub returns a 301). Last push was 2026-11-01 and it has about 22.9k stars. — [GitHub: wwebjs/whatsapp-web.js](https://github.com/wwebjs/whatsapp-web.js)
- npm `latest` is 1.34.7 (2026-04-24), with `next` at 1.34.5-alpha.3. — [npm registry whatsapp-web.js](https://registry.npmjs.org/whatsapp-web.js)
- It needs a Chromium/Chrome browser because it drives real WhatsApp Web through Puppeteer. — [WAHA engines doc](https://waha.devlike.pro/docs/how-to/engines/)

**WAHA (devlikeapro, Docker REST API)**
- The latest release is 2026.10.1 (2026-10-28). Releases come roughly monthly (2026.9.1, 2026.9.2, 2026.10.1). — [GitHub API: devlikeapro/waha releases](https://api.github.com/repos/devlikeapro/waha/releases)
- Engines:
  - WEBJS (the default) and WPP both use Puppeteer and need Chromium/Chrome.
  - NOWEB is Node/TS over websocket with no browser, and "saves you CPU and Memory" so you can "run more instances on a single server".
  - GOWS is a Go websocket engine and is called a "future replacement for NOWEB".

  — [WAHA engines doc](https://waha.devlike.pro/docs/how-to/engines/)
- WAHA's `package.json` pins `"@adiwajshing/baileys": "github:devlikeapro/Baileys#fork-master-2026-04-28"` (the NOWEB engine is a Baileys fork) and `"whatsapp-web.js": "github:devlikeapro/whatsapp-web.js#fork-main-2026-06-26"`. — [WAHA package.json](https://raw.githubusercontent.com/devlikeapro/waha/core/package.json)
- "Looking for WAHA Plus? It's now part of the main devlikeapro/waha image - all Plus features are included" (WAHA 2026.6, "Plus is now Core"). Older blog posts and tutorials that describe a 1-session free tier or paid Plus are outdated. — [WAHA README](https://github.com/devlikeapro/waha), [WAHA 2026.6 blog](https://waha.devlike.pro/blog/waha-2026-6/)
- Session storage options: local files, PostgreSQL, and MongoDB. MongoDB is "deprecated" and not supported by NOWEB. S3 is for media only. — [WAHA engines doc](https://waha.devlike.pro/docs/how-to/engines/)

**Evolution API**
- The repo moved to `evolution-foundation/evolution-api`. Last push was 2026-11-06 and it has about 10k stars. The latest tagged releases are 2.4.0-rc1 and rc2 (May 2026), and `main` is `version 2.3.7` with `"baileys": "7.0.0-rc.9"`. — [GitHub API repo 651487266](https://api.github.com/repositories/651487266), [evolution-api package.json](https://raw.githubusercontent.com/EvolutionAPI/evolution-api/main/package.json)
- A July 2026 comment on Baileys issue #2441 documents an Evolution API 2.3.7 / Baileys rc.9 case in which outbound 1:1 messages were accepted (`PENDING`) but never delivered. — [Baileys #2441](https://github.com/WhiskeySockets/Baileys/issues/2441)

**neonize (Python wrapper around whatsmeow)**
- On PyPI, `neonize` 0.10.0 was uploaded 2026-11-03, so it is active. — [PyPI neonize](https://pypi.org/pypi/neonize/json)

**Other ports seen in search (not evaluated in depth)**
- whatsapp-rust 0.5/0.6 on docs.rs has community fields. — [docs.rs whatsapp-rust groups.rs](https://docs.rs/crate/whatsapp-rust/latest/source/src/features/groups.rs)
- baileys_ex is an Elixir alpha port of Baileys' `communities.ts`. — [hexdocs baileys_ex](https://hexdocs.pm/baileys_ex/BaileysEx.Feature.Community.html)
- zaileys is a JS wrapper. — [zaileys community docs](https://zeative.github.io/zaileys/community/)

### Inferences
- For a free, always-off-laptop setup with 1-4 msgs/day, the realistic shortlist is Baileys (Node), whatsmeow (Go, or neonize in Python), or WAHA with the NOWEB/GOWS engine as a REST layer. A browser-based engine (whatsapp-web.js, WAHA WEBJS) is heavy for free hosting, which typically has 256-512 MB RAM.
- WAHA wraps Baileys and whatsmeow-style engines, so its ban and protocol behaviour largely matches those libraries. Its main value is the REST API, a dashboard for QR login, and DB-backed session storage.

### Gaps
- I found no authoritative, current RAM/CPU benchmarks for any of these. WAHA's docs say only that NOWEB "saves CPU and memory" and give no numbers. Typical community claims (websocket libs at tens of MB, Chromium at hundreds of MB) are unverified here.
- I did not confirm which WhatsApp library GOWS is built on. It is presumably whatsmeow, but WAHA's docs say only "Golang".

## Q2. Communities at the protocol level: parent JID vs Announcements sub-group JID, finding it, sending to it, admin requirement

### Takeaway
A Community is a "parent" group (`@g.us`) that you cannot post into. Its built-in Announcements group is a separate `@g.us` group that carries a `default_sub_group` marker and a `linked_parent` pointing at the community JID. Baileys exposes this as `isCommunityAnnounce` + `linkedParent` in `groupFetchAllParticipating()`. whatsmeow exposes it as `IsDefaultSubGroup` + `LinkedParentJID` in `GetJoinedGroups()` / `GetSubGroups()`. Sending to that JID works exactly like sending to any group, so other sub-groups never receive it. The Announcements group is admin-only for posting, so the bot number must be a community admin.

### Cited Findings
- **Baileys `GroupMetadata` type** has these fields:
  - `linkedParent?: string`, documented as "if this group is part of a community, it returns the jid of the community to which it belongs"
  - `announce?: boolean`, documented as "only allows admins to write messages"
  - `isCommunity?: boolean`
  - `isCommunityAnnounce?: boolean`, documented as "is this the announce of a community"

  — [Baileys src/Types/GroupMetadata.ts](https://github.com/WhiskeySockets/Baileys/blob/master/src/Types/GroupMetadata.ts)
- **Baileys parser (`groups.ts`)** maps the binary nodes like this:

  ```ts
  linkedParent: getBinaryNodeChild(group, 'linked_parent')?.attrs.jid || undefined,
  announce: !!getBinaryNodeChild(group, 'announcement'),
  isCommunity: !!getBinaryNodeChild(group, 'parent'),
  isCommunityAnnounce: !!getBinaryNodeChild(group, 'default_sub_group'),
  ```

  `groupFetchAllParticipating` is exported from the same file. — [Baileys src/Socket/groups.ts](https://github.com/WhiskeySockets/Baileys/blob/master/src/Socket/groups.ts)
- **Baileys `communities.ts`** has `communityMetadata(jid)`, `communityFetchLinkedGroups(jid)`, `communityCreate`, `communityLinkGroup` and others. Its own parser sets `isCommunityAnnounce: !!getBinaryNodeChild(community, 'default_sub_community')`, which is a different node name from groups.ts's `default_sub_group`. When locating the Announcements group, prefer the `groupFetchAllParticipating()` result (groups.ts parser). — [Baileys src/Socket/communities.ts](https://github.com/WhiskeySockets/Baileys/blob/master/src/Socket/communities.ts)
- Baileys issue #2536 reports that Baileys sees a newly linked group only after an admin approves it. — [Baileys #2536](https://github.com/WhiskeySockets/Baileys/issues/2536)
- **whatsmeow types (`types/group.go`)**:
  - `GroupInfo` embeds `GroupParent { IsParent bool; DefaultMembershipApprovalMode string }`, `GroupLinkedParent { LinkedParentJID JID }`, `GroupIsDefaultSub { IsDefaultSubGroup bool }`, and `GroupAnnounce { IsAnnounce bool ... }`.
  - `GroupLinkTarget { JID; GroupName; GroupIsDefaultSub }` is what `GetSubGroups` returns.

  — [whatsmeow types/group.go](https://github.com/tulir/whatsmeow/blob/main/types/group.go)
- **whatsmeow methods (`group.go`)**:
  - `func (cli *Client) GetJoinedGroups(ctx context.Context) ([]*types.GroupInfo, error)`
  - `func (cli *Client) GetSubGroups(ctx context.Context, community types.JID) ([]*types.GroupLinkTarget, error)`
  - `GetLinkedGroupsParticipants(ctx, community)`
  - `GetGroupInfo(ctx, jid)`

  These signatures take `ctx` as the first argument. That is a 2025 API change, so older tutorials without `ctx` are outdated. — [whatsmeow group.go](https://github.com/tulir/whatsmeow/blob/main/group.go)
- **whatsmeow SQL store**: `sqlstore.New(ctx, dialect, address, log)`, e.g. `sqlstore.New(ctx, "sqlite3", "file:examplestore.db?_foreign_keys=on", dbLog)`. It also offers `NewWithDB(db *sql.DB, dialect, log)`. The flow is then `container.GetFirstDevice(ctx)`, `whatsmeow.NewClient(deviceStore, clientLog)`, and `client.GetQRChannel(...)` if `client.Store.ID == nil`, followed by `client.Connect()` and `client.Disconnect()`. — [whatsmeow store/sqlstore/container.go](https://github.com/tulir/whatsmeow/blob/main/store/sqlstore/container.go), [whatsmeow client_test.go example](https://github.com/tulir/whatsmeow/blob/main/client_test.go)
- **Whapi.Cloud** (a gateway that documents the same protocol facts) gives these rules:
  - Use the ID of the "dedicated Announcements group", which is "technically separate from the Community's main group".
  - Find it via `GET /communities/{CommunityID}/subgroups`: the right group has `isCommunityAnnounce` true and `linkedParent` equal to the Community ID, with the same name as the community but a different ID.
  - Alternatively, post manually from the phone and read `chat_id` from the webhook.
  - "Sending an announcement to a community is completely identical and follows the rules for sending a message to a group" (`POST /messages/text` with `"to": "1203...@g.us"`).

  — [Whapi support: Send announcement](https://support.whapi.cloud/help-desk/communities/send-announcement)
- **Admin-only posting**:
  - Z-API's community docs say community administrators send to members via the announcement group, up to 5,000 people at once, and that a community holds up to 50 groups. — [Z-API communities intro](https://developer.z-api.io/en/communities/introduction) (via search snippet)
  - The Baileys `announce` flag is defined as "only allows admins to write messages". — [GroupMetadata.ts](https://github.com/WhiskeySockets/Baileys/blob/master/src/Types/GroupMetadata.ts)
- **WAHA REST**:
  - Groups are listed with `GET /api/{session}/groups` (params `limit`, `offset`, `sortBy=id|subject`, `sortOrder`, `exclude=participants`). The response format depends on the engine.
  - For NOWEB, enable the NOWEB Store if you get `rate-overlimit` when listing groups.

  — [WAHA groups doc](https://waha.devlike.pro/docs/how-to/groups/)
- WAHA sends text with `POST /api/sendText` and the body `{"session":"default","chatId":"<id>@g.us","text":"..."}`. — [WAHA groups automation page](https://waha.devlike.pro/whatsapp-groups/) (via search snippet)

**Code: Baileys, find the Announcements JID and send** (assembled from the documented APIs above):

```ts
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'

const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')
const sock = makeWASocket({ auth: state })
sock.ev.on('creds.update', saveCreds)          // MUST persist key updates

sock.ev.on('connection.update', async ({ connection }) => {
  if (connection !== 'open') return
  const groups = await sock.groupFetchAllParticipating()   // { [jid]: GroupMetadata }
  const COMMUNITY = '1203630000000000@g.us'                 // parent (isCommunity === true)
  const ann = Object.values(groups).find(g => g.isCommunityAnnounce && g.linkedParent === COMMUNITY)
  // cache ann.id once; it does not change
  await sock.sendMessage(ann!.id, { text: 'CodeChef Starters 210 starts in 1 hour' })
})
```

**Code: whatsmeow, find and send** (method and field names verified in the source above; `SendMessage(ctx, to, *waE2E.Message)` is the documented send call on [pkg.go.dev](https://pkg.go.dev/go.mau.fi/whatsmeow)):

```go
groups, _ := client.GetJoinedGroups(ctx)
var ann types.JID
for _, g := range groups {
    if g.IsDefaultSubGroup && g.LinkedParentJID == communityJID { ann = g.JID }
}
// or: subs, _ := client.GetSubGroups(ctx, communityJID); pick s.IsDefaultSubGroup
_, err := client.SendMessage(ctx, ann, &waE2E.Message{Conversation: proto.String("Codeforces Round starts in 1h")})
```

**WAHA REST:**

```
GET  /api/default/groups?exclude=participants   -> find entry with community-announce flag / same subject as community
POST /api/sendText  {"session":"default","chatId":"1203...@g.us","text":"..."}
```

### Inferences
- The announcement JID is stable. Discover it once, for example with a one-off script that prints all groups and flags, then hardcode or store it. After that the bot never needs to enumerate groups, which avoids `rate-overlimit` and initial-sync dependencies.
- Sending to the community parent JID (the `isCommunity` group) is not how announcements are posted. Always target the `isCommunityAnnounce` / `IsDefaultSubGroup` child. Because it is a single group JID, no other sub-group receives the message.
- The bot number must be added to the community and promoted to community admin, since only admins can post in Announcements. A non-admin send would be rejected by the server. This rejection is inferred from the admin-only semantics, not tested.

### Gaps
- I did not fetch WAHA's exact JSON field names for community-announce flags per engine (NOWEB vs GOWS vs WEBJS). WAHA docs say the group format "depends on the engine". Inspect the raw output once.
- I found no primary WhatsApp FAQ text in this session that explicitly confirms "only community admins can send in announcements". It is supported by vendor docs (Z-API) and the `announce` flag definition.
- I did not find the exact server error code returned when a non-admin posts to an announce group.

## Q3. Auth and session persistence; linked-device validity; short-lived connect-send-disconnect

### Takeaway
Pair once by QR or pairing code. After that, credentials and Signal keys must be persisted, and the keys change on every send. Baileys ships only a file-based helper and recommends a custom DB-backed store for production. whatsmeow's `sqlstore` natively supports SQLite and Postgres. WAHA can store sessions in Postgres. Per WhatsApp's own FAQ, the session survives as long as the primary phone is used at least every 14 days and the linked device connects at least every 30 days. A daily or hourly connect-send-disconnect is within those limits, but each reconnect triggers offline sync, and losing a single key update corrupts the session.

### Cited Findings
- WhatsApp FAQ says three things:
  - "Linked devices work without your phone online, but will log out if your phone is unused for over 14 days."
  - "We'll also automatically disconnect linked devices after 30 days of inactivity."
  - "You can stay connected by linking up to four devices at a time to your primary phone."

  — [WhatsApp FAQ: linked devices](https://faq.whatsapp.com/378279804439436/?locale=en_US)
- Baileys README on `useMultiFileAuthState` says it "is a utility function to help save the auth state in a single folder, this function serves as a good guide to help write auth & key states for SQL/no-SQL databases, which I would recommend in any production grade system." — [Baileys README](https://github.com/WhiskeySockets/Baileys/blob/master/README.md)
- Baileys README also says: "When a message is received/sent, due to signal sessions needing updating, the auth keys (`authState.keys`) will update. Whenever that happens, you must save the updated keys (`authState.keys.set()` is called). Not doing so will prevent your messages from reaching the recipient & cause other unexpected consequences." — [Baileys README](https://github.com/WhiskeySockets/Baileys/blob/master/README.md)
- Baileys supports a pairing code via `sock.requestPairingCode(number)`. "Pairing Code isn't Mobile API, it's a method to connect Whatsapp Web without QR-CODE." — [Baileys README](https://github.com/WhiskeySockets/Baileys/blob/master/README.md)
- Baileys issue #2512 (2026-04-29, open) reports that `requestPairingCode()` causes stream error 515 and the pairing fails with "Couldn't link device". QR is the fallback. — [Baileys #2512](https://github.com/WhiskeySockets/Baileys/issues/2512)
- Baileys issue #2810 (2026-09-08, open): "Initial event buffer can be held forever: `<ib><offline>` never arrives". This is relevant to scripts that connect, wait for sync, send, and exit, because they can hang. — [Baileys #2810](https://github.com/WhiskeySockets/Baileys/issues/2810)
- Baileys PR #2456 (merged around 2026-03) adds "App state sync resilience — skip undecryptable records instead of aborting". App-state sync failures were a known logout trigger. — [Baileys PR #2456](https://github.com/WhiskeySockets/Baileys/pull/2456)
- whatsmeow issue #387 is titled "LoggedOut event after failed app state sync" (2023, closed). This historical precedent shows app-state sync failures can cause logouts. — [whatsmeow #387](https://github.com/tulir/whatsmeow/issues/387)
- Baileys issue #2110 (2025-11, open): a reconnect establishes the socket but WhatsApp mobile rejects the session and forces a logout. — [Baileys #2110](https://github.com/WhiskeySockets/Baileys/issues/2110)
- In Baileys #2707, a commenter reports that a reconnect handler calling `connect()` again without tearing down the dying socket left two live sockets on one session. They call this "the single most common cause we've seen ... for a disconnect turning into an actual ban". — [Baileys #2707](https://github.com/WhiskeySockets/Baileys/issues/2707)
- whatsmeow `sqlstore.New(ctx, dialect, address, log)` takes a dialect argument. Examples use `sqlite3`, and the library is used with Postgres in mautrix bridges. — [whatsmeow sqlstore/container.go](https://github.com/tulir/whatsmeow/blob/main/store/sqlstore/container.go)
- WAHA supports PostgreSQL session storage. MongoDB is deprecated and not supported for NOWEB. — [WAHA engines doc](https://waha.devlike.pro/docs/how-to/engines/)
- **GitHub Actions pattern**: "Baileys Agent Kit" keeps auth state "AES-256-GCM ciphertext" on a separate "state branch". Each workflow run restores state first and commits the updated auth state afterward. You pair locally first. — [Baileys Agent Kit (glama.ai)](https://glama.ai/mcp/servers/I-No-oNe/baileys-agent-kit/tree)
- A dev.to post notes that GitHub Actions has "no screen to scan a QR code every time a workflow runs", so creds must be persisted between runs. — [dev.to feed (WhatsGo for GitHub Actions)](https://dev.to/feed/mark816p)
- A Hashnode tutorial uses node-cron + `useMultiFileAuthState` and sends a daily group message only after `connection === 'open'`. It assumes a long-running process. — [Hashnode: sendDailyQuotes cron with Baileys](https://hashnode-hub.vercel.app/posts/67c34b36ba7b50d01859e857)

### Inferences
- **Connect frequency**: a send every day or more often keeps the linked device well inside the 30-day inactivity window. The bigger risk is the 14-day primary-phone rule, so the spare phone must open WhatsApp at least every two weeks. Keeping it powered on Wi-Fi with WhatsApp installed is the simplest approach.
- **Connect-send-disconnect works if**:
  - all `creds.update` and key writes are flushed to durable storage before exit, which for GitHub Actions means committing or caching the encrypted state at the end of every run, even on failure
  - only one process ever uses the session at a time (concurrency group in GitHub Actions)
  - the script waits for `connection: open` and uses a timeout so it does not hang on initial sync (#2810)
  - the announcement JID is hardcoded, so there is no need to wait for group sync
- An always-on tiny process (Baileys or whatsmeow on a free VM, e.g. Oracle Cloud free tier or a home Raspberry Pi) avoids repeated offline-sync bursts and state-commit races. It is likely more robust than ephemeral runners, at the cost of needing a host.
- Storing Signal keys in a remote KV, such as Redis, Postgres, Turso/SQLite or Supabase, is supported by design. Baileys needs a custom `AuthenticationState` implementation, while whatsmeow's `sqlstore` works with Postgres out of the box.

### Gaps
- I found no authoritative documentation of how WhatsApp treats a companion that connects only briefly. For example, whether frequent new logins look suspicious, or how big the offline message backlog becomes for a busy community between daily connects.
- I found no GitHub issue specifically documenting Baileys or whatsmeow failures in GitHub Actions or serverless. A search for "serverless lambda" in Baileys issues returned nothing relevant.

## Q4. Ban risk and best practices (2025-2026 evidence)

### Takeaway
2025-2026 brought a wave of restrictions on Baileys and whatsmeow users. Most are tied to 1:1 messaging to unknown contacts: error 463 "Reach-out Timelock", missing `tctoken`/`cstoken`, bulk sends, and status uploads. There were also some "your account may be at risk / unauthorized tools" warnings even at low volume. Posting 1-4 messages a day only into a group the bot administers is the lowest-risk profile available, but it is not zero-risk, and a ban of the spare number is possible.

### Cited Findings
- **The 463 "Reach-out Time-lock" investigation (Baileys #2441, opened 2026-03-25)** found that:
  - WhatsApp time-locks sending to *unknown* people.
  - Baileys and whatsmeow omit `<tctoken>`/`<cstoken>`, and those omissions count against this limit.
  - Mostly banned or unbanned accounts are affected.

  Reports still came in on rc14 in Aug 2026. One commenter saw a `NotificationUserReachoutTimelockUpdate` MEX notification followed by a 401 `device_removed` logout. — [Baileys #2441](https://github.com/WhiskeySockets/Baileys/issues/2441)
- Baileys #2707 (2026-07-14, open) says 463 occurs "when trying to send messages to users who haven't been contacted before". The TC token has a lifespan of about 28 days. — [Baileys #2707](https://github.com/WhiskeySockets/Baileys/issues/2707)
- Baileys #2699 (2026-07, closed): "Private 1:1 messages not delivered for restored previously banned WhatsApp account, while groups work". Group sends were unaffected by the 1:1 restriction. — [Baileys #2699](https://github.com/WhiskeySockets/Baileys/issues/2699)
- Baileys #2441 comment (2026-08): sending to a number not registered on WhatsApp can trigger a reach-out restriction. — [Baileys #2441](https://github.com/WhiskeySockets/Baileys/issues/2441)
- whatsmeow #810 (2025-05): clients saw "Your account may be at risk ... using unauthorized tools ... Using third-party tools to send bulk messages is a violation of our Terms of Service". Reports came "even for clients that are not performing bulk messaging", and some accounts were banned. Other commenters reported the same on whatsapp-web.js and Baileys. One said enabling Meta Verified stopped the warnings. A later comment says the likely triggers are "sending a lot of messages to people who dont have you in their address book" and "sending the same message a lot of times". — [whatsmeow #810](https://github.com/tulir/whatsmeow/issues/810)
- Other open Baileys ban reports:
  - #2075 (2025-11), "Repeated Number Bans", including bans "even though Baileys doesn't send many messages"
  - #1983 (2025-10)
  - #2131, banned "if sent more messages"
  - #2309 (2026-01), permanently banned when uploading Status from a production server
  - #2805 (2026-09), instant restriction on QR scan for a verified Official Business Account
  - #2850 (2026-10), bulk messages lead to a ban

  — [#2075](https://github.com/WhiskeySockets/Baileys/issues/2075), [#1983](https://github.com/WhiskeySockets/Baileys/issues/1983), [#2131](https://github.com/WhiskeySockets/Baileys/issues/2131), [#2309](https://github.com/WhiskeySockets/Baileys/issues/2309), [#2805](https://github.com/WhiskeySockets/Baileys/issues/2805), [#2850](https://github.com/WhiskeySockets/Baileys/issues/2850)
- Community advice in #2075 (2026-04, from the author of the `baileys-antiban` wrapper, so self-promotional) lists three main causes: "No warmup on new numbers", "No jitter — fixed-interval sends are bot signatures", and no session health monitoring. — [Baileys #2075](https://github.com/WhiskeySockets/Baileys/issues/2075)
- Whapi.Cloud notes that "WhatsApp anti-spam systems can still restrict accounts if you send too much too fast or behave like spam", even on paid plans. — [Whapi pricing](https://whapi.cloud/price)

### Inferences
- **Best practices for this use case**:
  - Send only to the community Announcements group. Never DM or reply 1:1, which avoids the 463 / tctoken problem entirely.
  - Use an established number. Don't create it fresh and automate on day one. Use it manually for a while, and be in contacts with a few people.
  - Add a random 0-5 minute jitter to the send time instead of exactly :00.
  - Vary the message text, which happens naturally because contest names and times differ.
  - Keep one session per number and never run two sockets at once.
  - Keep the primary phone active.
  - Use the latest library version.
  - Don't upload Status, don't mass-add participants, and don't send to unregistered numbers.
- A ban hits only the spare number. The community survives if the student's main number remains a community owner or admin, so keep the main number as owner.

### Gaps
- I found no hard data on ban rates for low-volume group-only bots. The evidence is anecdotal GitHub issue reports, and WhatsApp publishes no thresholds.
- I did not verify the effectiveness of the third-party `baileys-antiban` wrapper.

## Q5. Hosted third-party unofficial gateways with free tiers

### Takeaway
Hosted unofficial gateways do support community announcements, because these are just `@g.us` group sends. The free tiers are tiny, though, and they mean handing a third party full access to the WhatsApp session (all chats). Whapi.Cloud's free Sandbox (150 msgs/day, 5 conversations/month, 1,000 API requests/month) is enough for 1-4 msgs/day to one group. Green API's free Developer plan is capped at 3 chats. UltraMsg and Wassenger have no permanent free tiers that I could confirm.

### Cited Findings
- **Whapi.Cloud**:
  - The Developer Sandbox is "free forever", with 5 active conversations/month, 150 messages/day, 30 number checks/day, and 1,000 API requests/month.
  - The paid Developer plan is about $29/month.
  - Groups, Communities, Statuses and Channels are supported.

  — [Whapi pricing](https://whapi.cloud/price), [Whapi Community API](https://whapi.cloud/whatsapp-community-api)
- Whapi documents announcement sending via the Announcements group ID, found through `GET /communities/{id}/subgroups` with `isCommunityAnnounce`. — [Whapi: Send announcement](https://support.whapi.cloud/help-desk/communities/send-announcement), [dev.to Whapi communities article](https://dev.to/whapicloud/whatsapp-communities-api-sending-announcements-and-managing-members-422o)
- **Green API**:
  - Developer plan: you "can only interact with 3 chats (contacts or groups)".
  - One Developer instance per console.
  - Group methods are limited to 1,000 requests/month.
  - Limits reset on the 1st of each month.

  — [Green API tariffs](https://green-api.com/en/docs/about-tariffs). A 2023 news post says "Developer plan has no limit now", which is conflicting and likely superseded. — [Green API news 2023-12-11](https://green-api.com/en/docs/news/2023/12/11/)
- **UltraMsg** is used by at least one GitHub-Actions-cron WhatsApp bot. It is described as a paid third-party service. — (via search results summary on GitHub Actions bots; no pricing page fetched)

### Inferences
- The privacy trade-off: a hosted gateway holds the linked-device session, so it can read every chat on the spare number. With a dedicated spare number used only for this bot, the exposure is limited to the community's chats.
- For the student, Whapi Sandbox plus a free cron (GitHub Actions calling `curl`) is the zero-maintenance path. A self-hosted Baileys/whatsmeow/WAHA setup is the zero-trust path.

### Gaps
- I did not fetch the current Wassenger or UltraMsg pricing pages, so I can't confirm whether either has a free tier in Nov 2026. Historically both offered only time-limited trials.
- I didn't confirm whether Whapi's "5 active conversations/month" counts a single group as one conversation. That is the likely reading.

## Q6. n8n WhatsApp nodes for posting to groups

### Takeaway
n8n's built-in "WhatsApp Business Cloud" node uses Meta's official API, which cannot post into community groups. Group posting from n8n goes through community nodes for WAHA or Evolution API, or through a plain HTTP Request node to their REST endpoints.

### Cited Findings
- The WAHA n8n community node `@devlikeapro/n8n-nodes-waha` has latest version 2025.2.9, last published 2025-02-24. That makes it older than current WAHA (2026.10.1), so it may lag new endpoints. — [npm @devlikeapro/n8n-nodes-waha](https://registry.npmjs.org/@devlikeapro/n8n-nodes-waha)
- The Evolution API n8n community node `n8n-nodes-evolution-api` is at version 1.0.4, last published 2025-03-20. — [npm n8n-nodes-evolution-api](https://registry.npmjs.org/n8n-nodes-evolution-api)
- Other community nodes exist for gateway APIs, e.g. `n8n-nodes-avisaapi`, which has a "Send Text to Group" operation. — [avisaapi n8n node page](https://frontend-f26.pages.dev/package/n8n-nodes-avisaapi/avisaapi/Group:Send%20Text%20to%20Group)

### Inferences
- n8n adds no protocol capability. It is just a scheduler and UI in front of WAHA/Evolution/Whapi, and it needs its own always-on host. For this use case it adds hosting burden compared with a simple cron script calling the REST endpoint.

### Gaps
- I did not verify in this session that n8n's official WhatsApp node cannot target groups. That conclusion rests on the known limitation that the Meta Cloud API has no group or community send. A separate research track on official APIs should confirm it.
