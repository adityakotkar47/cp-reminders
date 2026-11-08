# Sender

The sender (`sender/`, Go) is the only component that talks to WhatsApp. It claims queued reminders from the Worker's outbox, posts each one to the community's Announcements group, records what it delivered, and acks the results. It runs as a short GitHub Actions job, or as a fallback daemon (see `architecture.md`). It never decides what to send or when, and it never accepts a destination from the network.

It is an unofficial linked device built on [whatsmeow](https://pkg.go.dev/go.mau.fi/whatsmeow), pinned to `go.mau.fi/whatsmeow v0.0.0-20261106223246-93ce5f1e6023`.

## Commands

All commands are run from the repository root as `go -C sender run ./cmd/wa <command>`. A relative `--state` is resolved from `sender/`. You can also build once with `go -C sender build -o ../wa ./cmd/wa` and run `./wa <command>`. Every command accepts `-h`.

| Command | What it does | Touches WhatsApp |
|---|---|---|
| `wa keygen` | Prints a new age identity (`AGE-SECRET-KEY-1…`) and its public key. | No |
| `wa pair --state DIR [--phone 91XXXXXXXXXX] [--force]` | Links a fresh device. It shows a QR code, or with `--phone` prints an 8-character pairing code. It waits for the first login, stays connected for 10 s, disconnects, and writes `DIR/session.db.age`. It refuses to overwrite an existing session unless you pass `--force`. | Yes |
| `wa groups --state DIR` | Connects, lists joined groups (JID, name, community parent, default sub-group, linked parent, announce-only, our admin status), and prints an `ANNOUNCEMENTS CANDIDATE:` line for every default sub-group. Then it saves the session. | Yes |
| `wa drain --state DIR [--jitter 90s] [--dry-run]` | Runs one claim, deliver and ack cycle (see [Drain](#drain)). | Only if something is pending |

Common flags are `--log-level` (whatsmeow log level, default `WARN`) and `--connect-timeout` (60 s). `drain` and `groups` also take `--timeout` for the whole run (4 min and 90 s). `pair` always allows 5 min.

Exit codes are `0` for success (including an empty outbox), `1` for any failure, and `2` for a usage error.

## Environment

| Variable | Used by | Meaning |
|---|---|---|
| `AGE_IDENTITY` | pair, groups, drain | age X25519 identity that encrypts and decrypts `session.db.age`. Surrounding whitespace is ignored. It is never printed, and parse errors do not echo it. |
| `ANNOUNCE_JID` | drain | The only chat the sender may post to, e.g. `120363…@g.us`. It must be a group JID. Get it from `wa groups`. |
| `WORKER_URL` | drain | Outbox base URL. The sender calls `POST {WORKER_URL}/outbox/claim` and `/outbox/ack`. |
| `SENDER_TOKEN` | drain | Bearer token for `/outbox/*`. |
| `GITHUB_STEP_SUMMARY` | drain | Set by GitHub Actions. On failure the sender appends a Markdown section to this file listing every unsent reminder's text in a fenced block, ready to paste. |

## State directory

| File | Content |
|---|---|
| `session.db.age` | The whatsmeow SQLite store, age-encrypted to `AGE_IDENTITY`'s own recipient. It is replaced atomically on every save. |
| `sent.json` | A JSON array of the last 500 `{key, sentAt, messageId}` this sender delivered. It is written after every single send. |

The plaintext database exists only in a private temporary directory (`cp-reminders-wa-*` under the OS temp dir) while a command runs. It is deleted on exit, including after errors and Ctrl-C. The repository's `.gitignore` ignores `session.db*` and `/state/`.

Signal keys rotate on every connection. Once the session has been opened, every exit path that disconnected re-encrypts it, so a committed `session.db.age` is always the latest. The one exception is `pair`: when pairing itself fails, nothing is written.

## Drain

1. Validate the configuration (`ANNOUNCE_JID` shape, `AGE_IDENTITY`, `sent.json` readable) before any network call.
2. `POST /outbox/claim {claimId}` with a random `claimId`. The claim is never retried, because a retried claim would strand the rows returned by a lost first response until their lease expired.
3. If there are no items, print `outbox empty` and exit 0 without decrypting the session or connecting.
4. Validate items. A claim may hold at most 5 items, otherwise all of them are refused. A key must be non-empty and unique. Text must be non-empty and at most 1000 characters. Invalid items are acked `failed` and never sent.
5. Items whose key is already in `sent.json` are acked `sent` with the stored `messageId`, without resending. If nothing else is pending, WhatsApp is not contacted at all.
6. Sleep a random 0..`--jitter`, decrypt the session, connect, and wait for login (60 s).
7. Check the target with `GetGroupInfo(ANNOUNCE_JID)`. It must be a community default sub-group (`IsDefaultSubGroup`), and we must be admin or super-admin, matched by phone-number JID or LID.
8. Send each pending item as a plain text message (`waE2E.Message{Conversation: …}`), never with a link preview, and append it to `sent.json` immediately. On the first send error, or a `sent.json` write error, sending stops and the remaining items are reported as `failed` ("not attempted").
9. Disconnect and re-encrypt the session. This runs before the ack, so the rotated keys are saved even if the ack hangs.
10. `POST /outbox/ack {claimId, results}` with up to 3 attempts, 1 s then 2 s backoff, retrying only network errors, 5xx and 429. The ack has its own 60 s budget, so it still runs when the main timeout has already expired.

Any failure exits 1 and writes the step summary. This covers a connect failure, logged out, stream replaced, a temporary ban, a refused target, a send error, an ack failure, or a session save failure. When the claim succeeded, unsent items are still acked `failed`, so the Worker can retry them (`attempts < 3`) instead of waiting for the lease to expire.

`--dry-run` claims, connects, verifies the target and prints the texts. It does not send, does not write `sent.json`, and does not ack. The claimed rows return to the queue when their 10-minute lease expires, because the API has no "release" call.

Message text appears only in the `--dry-run` output and in the failure step summary. It is never in the normal log.

## GitHub Actions contract

`.github/workflows/send.yml` is documented in `workflow.md`. The sender expects the following from it:

- Concurrency group `wa-session`, so only one connection is ever live.
- Branch `state` checked out into `./state`, for example with `actions/checkout` using `ref: state` and `path: state`.
- Go set up from `sender/go.mod`, e.g. `actions/setup-go` with `go-version-file: sender/go.mod`. The module needs Go 1.26 or later.
- The run step must be:
  ```sh
  go -C sender run ./cmd/wa drain --state ../state --jitter 90s
  ```
  `go run ./sender/cmd/wa` from the root does not work, because the root has no `go.mod` ("cannot find main module"). With `-C sender`, `--state` is relative to `sender/`.
- Environment for that step from secrets: `WORKER_URL`, `SENDER_TOKEN`, `AGE_IDENTITY`, `ANNOUNCE_JID`. `GITHUB_STEP_SUMMARY` is provided by the runner.
- After the step, commit `./state` back to `state` with `if: always()`, because keys rotate even on failure.

## Pairing procedure

Use a spare number that is a **community admin**, so that it can post in Announcements. The phone must open WhatsApp at least every 14 days. A linked device that has not connected for 30 days is dropped ([WhatsApp FAQ](https://faq.whatsapp.com/378279804439436/)), so daily runs are well within that limit.

1. Generate the key once and store it. Save the `AGE-SECRET-KEY-1…` line as the GitHub secret `AGE_IDENTITY` and in your password manager. Never commit it.
   ```sh
   go -C sender run ./cmd/wa keygen
   ```
2. Load it into your shell without writing it to history:
   - bash: `read -rs AGE_IDENTITY && export AGE_IDENTITY`
   - PowerShell 7: `$env:AGE_IDENTITY = Read-Host -MaskInput AGE_IDENTITY`
3. Create an empty `state` worktree next to the repo, so the session never lands in `main`:
   ```sh
   git worktree add --orphan -b state ../cp-reminders-state
   ```
4. Pair, using one of these two methods:
   - **QR:**
     ```sh
     go -C sender run ./cmd/wa pair --state ../../cp-reminders-state
     ```
     Then on the phone, go to WhatsApp > Linked devices > Link a device and scan the code. Codes rotate, and the window closes after about 160 s.
   - **Pairing code**, when you can't scan (e.g. over SSH):
     ```sh
     go -C sender run ./cmd/wa pair --state ../../cp-reminders-state --phone 91XXXXXXXXXX
     ```
     The number is in international format without `+`. On the phone, go to Linked devices > Link a device > Link with phone number instead, and enter the printed code.

   The device appears on the phone as `cp-reminders`. Wait for `session saved to …`.
5. Find the Announcements JID:
   ```sh
   go -C sender run ./cmd/wa groups --state ../../cp-reminders-state
   ```
   Save it as the secret `ANNOUNCE_JID` ([see below](#finding-the-announcements-jid)).
6. Commit and push the state:
   ```sh
   git -C ../cp-reminders-state add session.db.age
   git -C ../cp-reminders-state commit -m "chore(state): initial session"
   git -C ../cp-reminders-state push -u origin state
   ```
   Then remove the worktree with `git worktree remove ../cp-reminders-state`. Do not keep a second copy of the session in use. Two clients with the same keys cause `StreamReplaced`, and stale keys break decryption.

To re-pair after a logout, repeat steps 3–6 with `--force`, starting from the current `state` branch, then push. Remove the old "cp-reminders" entry from the phone's linked devices first.

## Finding the Announcements JID

A community has a parent group (`PARENT=yes`) that nobody can post into, and a built-in Announcements group. The Announcements group is a separate `@g.us` group with `DEFAULT_SUB=yes`, its `LINKED_PARENT` set to the community, and usually `ANNOUNCE=yes` (admins only). Its name usually matches the community name. `wa groups` marks it like this:

```
ANNOUNCEMENTS CANDIDATE: 120363xxxxxxxxxxxx@g.us name="CP Community" community=120363yyyyyyyyyyyy@g.us admin=yes
```

Use that JID, and check that `admin=yes`. If the bot is in several communities you will see several candidates, so pick the one whose `community` matches. `wa drain` re-checks both properties before every send.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `no session in state directory; run wa pair first` | `state` branch empty or not checked out into `--state`. | Check the checkout path, or pair. |
| `AGE_IDENTITY: invalid age X25519 identity`, or `unseal …: no identity matched` | Wrong or truncated secret, or the session was encrypted with another key. | Fix the secret, or re-pair with the current key. |
| `whatsapp: logged out (reason: …)` | Removed from the phone's linked devices, the phone was unused for more than 14 days, or WhatsApp revoked the session. | Re-pair with `--force`. Claimed rows are acked failed and retried until their deadline. |
| `session is not paired` | The store exists but holds no device. whatsmeow deletes the device on `device_removed`. | Re-pair. |
| `whatsapp: stream replaced …` | Another process connected with the same session, e.g. a local `wa groups` during a run, or a second copy of the state. | Make sure only the workflow uses the session. Re-pair if it persists. |
| `whatsapp: temporarily banned: …` | Account restriction. | Stop sending, use the phone normally, and wait out the stated expiry. |
| `whatsapp: client outdated` | WhatsApp rejected this whatsmeow version. | `go -C sender get go.mau.fi/whatsmeow@latest && go -C sender mod tidy`, then test and redeploy. |
| `whatsapp: timed out waiting for connection` | Network issue, or a slow initial sync. | Re-run. If it happens often, raise `--connect-timeout`. |
| `target is not a community announcements group` | `ANNOUNCE_JID` points at a normal group or the community parent. | Use the `ANNOUNCEMENTS CANDIDATE` JID. |
| `sender is not an admin of the target group` | The spare number lost admin. | Make it a community admin again from the main number. |
| `passkey pairing is not supported` | The phone asked for passkey linking. | Use the other method (`--phone` or QR). |
| Step summary says "delivered but not acknowledged" | The message was posted, but `/outbox/ack` failed. | Nothing to post. The next claim of those rows is acked `sent` from `sent.json`. If the deadline passes first, the Worker marks the rows `expired` even though they were delivered. |
| `outbox claim: HTTP 401` | `SENDER_TOKEN` differs between the Worker and GitHub. | Set the same value in both places. |

## Code layout

| Package | Responsibility |
|---|---|
| `cmd/wa` | Flags, environment, wiring, groups table, pairing UI. |
| `internal/drain` | The claim, validate, deliver and ack orchestration, plus the step summary. It depends only on small `Outbox`, `Session` and `Ledger` interfaces, so it is unit-tested with fakes. |
| `internal/outbox` | Typed HTTP client for `/outbox/claim` and `/outbox/ack`, with per-request timeouts and ack retries. |
| `internal/state` | age vault, encrypted session store, and the `sent.json` ledger. |
| `internal/wa` | whatsmeow wrapper: fatal-event watcher, connect-and-wait, text send, QR and phone pairing, admin check. |

Run the checks from the repository root:

```sh
go -C sender vet ./...
go -C sender test ./...
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go -C sender build ./cmd/wa
```

## Sources behind the implementation choices

Everything below was checked against the module sources at the pinned versions.

- **whatsmeow store on pure-Go SQLite.** `sqlstore.NewWithDB(db, "sqlite3", log)` takes the dialect separately from the `database/sql` driver. The dialect parser accepts any name starting with `sqlite` (`go.mau.fi/util/dbutil.ParseDialect`). `Container.Upgrade` fails with "foreign keys are not enabled" unless `PRAGMA foreign_keys` is on, and the docs say "it's strongly recommended to enable foreign keys" ([store/sqlstore/container.go](https://pkg.go.dev/go.mau.fi/whatsmeow/store/sqlstore#New)). This lets the sender use [modernc.org/sqlite](https://pkg.go.dev/modernc.org/sqlite) v1.62.0, which registers driver `"sqlite"` and runs each `_pragma=` DSN value on every new connection (`driver.go`). The DSN is `…/session.db?_pragma=foreign_keys(1)&_pragma=busy_timeout(10000)&_pragma=journal_mode(DELETE)`. The result builds with `CGO_ENABLED=0`. `DELETE` journal mode leaves no `-wal`/`-shm` side files, so the single closed `.db` file is the whole state.
- **Group fields.** `types.GroupInfo` embeds `GroupName{Name}`, `GroupParent{IsParent}`, `GroupLinkedParent{LinkedParentJID}`, `GroupIsDefaultSub{IsDefaultSubGroup}` and `GroupAnnounce{IsAnnounce}`. `Participants []GroupParticipant` carries `JID`, `PhoneNumber`, `LID`, `IsAdmin` and `IsSuperAdmin` ([types/group.go](https://pkg.go.dev/go.mau.fi/whatsmeow/types#GroupInfo)). In LID-addressed groups the participant `JID` is a LID, so admin checks compare against both `Store.ID` and `Store.LID`. `GetJoinedGroups(ctx)` and `GetGroupInfo(ctx, jid)` take a context.
- **Pairing.** `GetQRChannel` must be called before `Connect`, and emits `code`, `success`, `timeout`, `error` and passkey items ([qrchan.go](https://pkg.go.dev/go.mau.fi/whatsmeow#Client.GetQRChannel)). `PairPhone(ctx, phone, showPushNotification, clientType, clientDisplayName)` must be called after connecting and after the first QR event. The display name "must be formatted as `Browser (OS)`", and the server validates it, so the sender uses `Chrome (Linux)`. Codes expire with the QR window, about 160 s ([pair-code.go](https://pkg.go.dev/go.mau.fi/whatsmeow#Client.PairPhone)). `PairSuccess` "is generally followed by a websocket reconnection, so you should wait for the Connected before trying to send anything" (types/events). Passkey pairing (`PairPasskeyRequest`) needs a WebAuthn response, which a CLI cannot give, so it is rejected.
- **Fatal events.** `LoggedOut` ("the client has been unpaired from the phone"), `StreamReplaced` ("another client connecting with the same keys"), `TemporaryBan`, `ConnectFailure`, `ClientOutdated`, `StreamError` and `PairError` all end the run with a distinct error ([types/events](https://pkg.go.dev/go.mau.fi/whatsmeow/types/events)). On `device_removed`, whatsmeow deletes the device from the store itself, which is why the next run reports "not paired". `Disconnect()` waits up to 5 s for the event-handler queue before returning, so store writes caused by the last events finish before the database is closed and encrypted.
- **Sending.** `SendMessage(ctx, to, *waE2E.Message, …)` returns a `SendResponse` whose `ID` is the message id stored in `sent.json` and the ack ([send.go](https://pkg.go.dev/go.mau.fi/whatsmeow#Client.SendMessage)).
- **Encryption.** [filippo.io/age](https://pkg.go.dev/filippo.io/age) v1.3.2: `GenerateX25519Identity`, `ParseX25519Identity`, and `Encrypt(dst, recipient)`, whose writer "must" be closed "for the last chunk to be encrypted and flushed". The file is encrypted to the identity's own recipient, so a single secret both reads and writes the state. Writes go to a temp file in the same directory and are then renamed, so a crash never leaves a truncated `session.db.age`.
