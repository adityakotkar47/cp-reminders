# Unofficial WhatsApp libraries

These libraries link to an account as a WhatsApp Web companion device. Using any of them breaks WhatsApp's Terms ([official-whatsapp-apis.md](official-whatsapp-apis.md#terms-for-personal-and-business-app-accounts)).

## Libraries and gateways

| Project | Language and transport | Browser | Notes |
|---|---|---|---|
| [whatsmeow](https://github.com/tulir/whatsmeow) | Go, websocket | No | Sends text and media to chats and groups, manages groups, reads and writes app state ([README](https://github.com/tulir/whatsmeow)). Powers the mautrix-whatsapp bridge. Python wrapper: [neonize](https://pypi.org/pypi/neonize/json). |
| [Baileys](https://github.com/WhiskeySockets/Baileys) | Node, websocket | No | Authenticates "as a second WhatsApp client by scanning a QR code or Pairing Code" and asks users not to use it for "bulk or automated messaging" ([README](https://github.com/WhiskeySockets/Baileys/blob/master/README.md)). npm `latest` is a 7.0.0 release candidate. Versions before 6.7.22 and 7.0.0-rc13 are affected by CVE-2026-48063 ([EUVD-2026-52440](https://vulners.com/euvd/EUVD-2026-52440)). |
| [whatsapp-web.js](https://github.com/wwebjs/whatsapp-web.js) | Node, Puppeteer | Chromium | Drives the real WhatsApp Web page. |
| [WAHA](https://github.com/devlikeapro/waha) | Docker REST API | Engine-dependent | Engines: WEBJS and WPP (Chromium), NOWEB (a Baileys fork, no browser) and GOWS (Go, no browser); sessions in files or PostgreSQL ([engines](https://waha.devlike.pro/docs/how-to/engines/)). All features are in the free image. |
| [Evolution API](https://github.com/evolution-foundation/evolution-api) | REST gateway | No | Built on Baileys ([package.json](https://raw.githubusercontent.com/EvolutionAPI/evolution-api/main/package.json)). |

Browser-based clients need hundreds of megabytes of memory, more than most free hosts provide. No project publishes memory or CPU benchmarks.

## Communities at the protocol level

- A Community is a parent `@g.us` group that nobody posts into. Its Announcements group is a separate `@g.us` group carrying a `default_sub_group` marker and a `linked_parent` element that points to the community ([Baileys groups.ts](https://github.com/WhiskeySockets/Baileys/blob/master/src/Socket/groups.ts)).
- whatsmeow exposes these as `GroupInfo.IsDefaultSubGroup` and `GroupInfo.LinkedParentJID`, alongside `IsParent` and `IsAnnounce` ([types/group.go](https://github.com/tulir/whatsmeow/blob/main/types/group.go)). `GetJoinedGroups(ctx)` lists every joined group, `GetSubGroups(ctx, community)` lists a community's subgroups and `GetGroupInfo(ctx, jid)` reads one group ([group.go](https://github.com/tulir/whatsmeow/blob/main/group.go)).
- Baileys exposes them as `isCommunityAnnounce` and `linkedParent` in the results of `groupFetchAllParticipating()`, and defines `announce` as "only allows admins to write messages" ([GroupMetadata.ts](https://github.com/WhiskeySockets/Baileys/blob/master/src/Types/GroupMetadata.ts)). Its `communities.ts` parser reads a differently named node (`default_sub_community`) ([communities.ts](https://github.com/WhiskeySockets/Baileys/blob/master/src/Socket/communities.ts)).
- Sending to the Announcements group is an ordinary group send to its ID; gateways document it as "completely identical" to messaging any group, with the same name as the community but a different ID ([Whapi](https://support.whapi.cloud/help-desk/communities/send-announcement)).
- Only community admins post in Announcements ([Z-API](https://developer.z-api.io/en/communities/introduction)). The server's error for a non-admin send is not documented.
- The Announcements group's ID does not change, so it is looked up once and configured.

## Sessions

- "Linked devices work without your phone online, but will log out if your phone is unused for over 14 days." "We'll also automatically disconnect linked devices after 30 days of inactivity." Up to four devices can be linked ([WhatsApp FAQ](https://faq.whatsapp.com/378279804439436/?locale=en_US)).
- Signal keys update whenever messages are sent or received, and "not doing so will prevent your messages from reaching the recipient" ([Baileys README](https://github.com/WhiskeySockets/Baileys/blob/master/README.md)). Every run must therefore save the session back.
- Baileys' `useMultiFileAuthState` is "a good guide" for writing a database-backed store, which it recommends "in any production grade system" ([README](https://github.com/WhiskeySockets/Baileys/blob/master/README.md)). whatsmeow's `sqlstore` stores the session in SQLite or Postgres: `sqlstore.New(ctx, dialect, address, log)` or `NewWithDB(db, dialect, log)` ([container.go](https://github.com/tulir/whatsmeow/blob/main/store/sqlstore/container.go)).
- Pairing happens once, by QR code or by a code entered on the phone. Baileys has an open report of pairing codes failing with stream error 515 ([#2512](https://github.com/WhiskeySockets/Baileys/issues/2512)).
- Baileys can wait forever for the initial offline sync ([#2810](https://github.com/WhiskeySockets/Baileys/issues/2810)), which affects short-lived jobs. App-state sync failures have caused logouts in both libraries ([Baileys #2456](https://github.com/WhiskeySockets/Baileys/pull/2456), [whatsmeow #387](https://github.com/tulir/whatsmeow/issues/387)).
- Two live sockets on one session are described as "the single most common cause we've seen ... for a disconnect turning into an actual ban" ([Baileys #2707](https://github.com/WhiskeySockets/Baileys/issues/2707)).
- Keeping the encrypted session on a separate branch, restored before and committed after each GitHub Actions run, is an established pattern ([Baileys Agent Kit](https://glama.ai/mcp/servers/I-No-oNe/baileys-agent-kit/tree)).

WhatsApp documents nothing about companions that connect only briefly.

## Ban evidence

- Error 463, "reach-out timelock", restricts messages to people the account has not contacted before; Baileys and whatsmeow omit the `tctoken` that would count against it ([Baileys #2441](https://github.com/WhiskeySockets/Baileys/issues/2441), [#2707](https://github.com/WhiskeySockets/Baileys/issues/2707)). A restricted account could still send to groups while its one-to-one messages were blocked ([#2699](https://github.com/WhiskeySockets/Baileys/issues/2699)).
- Clients of whatsmeow, whatsapp-web.js and Baileys received "Your account may be at risk … using unauthorized tools" warnings "even for clients that are not performing bulk messaging", and some accounts were banned; commenters name messaging people who do not have the number saved and sending identical messages repeatedly as triggers ([whatsmeow #810](https://github.com/tulir/whatsmeow/issues/810)).
- Other reports describe bans at low volume, after Status uploads from a server, on QR linking of a verified business account, and after bulk sends ([Baileys #2075](https://github.com/WhiskeySockets/Baileys/issues/2075), [#2309](https://github.com/WhiskeySockets/Baileys/issues/2309), [#2805](https://github.com/WhiskeySockets/Baileys/issues/2805), [#2850](https://github.com/WhiskeySockets/Baileys/issues/2850)).
- Community advice blames new numbers without warm-up, fixed-interval sends and missing session monitoring ([#2075](https://github.com/WhiskeySockets/Baileys/issues/2075)).

All of this is anecdotal; WhatsApp publishes no thresholds. Posting a few messages a day into one group the number administers, with no direct messages, avoids every reported trigger except the use of an unofficial client itself.

## Hosted gateways

A hosted gateway holds the linked session and can read every chat on the number.

| Gateway | Free tier |
|---|---|
| [Whapi.Cloud](https://whapi.cloud/price) | Sandbox: 150 messages a day, 5 active conversations a month, 1,000 API requests a month. Supports community announcements through the Announcements group's ID ([announcements](https://support.whapi.cloud/help-desk/communities/send-announcement)). |
| [Green API](https://green-api.com/en/docs/about-tariffs) | Developer plan limited to 3 chats and 1,000 group-method requests a month. |

## n8n

n8n's WhatsApp Business Cloud node uses Meta's official API, which cannot post into community groups. Group posting from n8n goes through community nodes for WAHA ([npm](https://registry.npmjs.org/@devlikeapro/n8n-nodes-waha)) or Evolution API ([npm](https://registry.npmjs.org/n8n-nodes-evolution-api)), or an HTTP request to their REST APIs, and n8n itself needs an always-on host.
