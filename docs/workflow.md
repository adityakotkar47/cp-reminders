# GitHub Actions workflows

Two workflows live in `.github/workflows/`. Actions are pinned to full commit SHAs with the release in a trailing comment; update them deliberately.

## send.yml: wake and drain

Triggered only by `workflow_dispatch` from the Worker (`POST /repos/{owner}/{repo}/actions/workflows/send.yml/dispatches`, body `{"ref":"main"}`, no inputs). There is no `schedule` trigger. The Worker's debounce and the outbox make extra or lost wake-ups harmless.

| Aspect | Choice | Why |
|---|---|---|
| Concurrency | `group: wa-session`, `cancel-in-progress: false` | WhatsApp allows one live connection and the session keys rotate on every connect, so runs must be serialised. Per [GitHub's concurrency docs](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs), a running job is never cancelled with `false`, and at most one run waits as `pending`; a newer pending run replaces an older one. That is safe here because every run drains the whole outbox. |
| Permissions | `contents: write` only | Needed to push the `state` branch with the built-in token. Nothing else is granted. |
| Timeout | 6 minutes | Covers the 90 s jitter, connect, send and ack with margin. |
| Checkout | `main`, `persist-credentials: false` | The token is not left in `.git/config` while the sender runs. |
| State branch | Fetched into `./state` with an `http.extraheader` built from `github.token` for that command only | No credential persists. If branch `state` does not exist, the step starts an empty orphan repository and the first run creates the branch. |
| Secrets | Passed through `env:` on the step, never interpolated into the script | `${{ }}` appears only in `env:` and `with:` values, so no secret or input is ever expanded into shell text. |
| Persist step | `if: always()` | The session keys rotate on every connection, so state must be saved even when the drain fails. |

### Persist step

1. Skip if `./state` is not a repository or `session.db.age` and `sent.json` are unchanged.
2. Create an orphan branch, add exactly `session.db.age` and `sent.json` (an allowlist, so a stray plaintext `session.db` can never be committed), commit once as `github-actions[bot]`.
3. `git push --force-with-lease="state:<sha fetched at start>" origin next:refs/heads/state`. An empty expected sha means the ref must not exist yet. If something else moved the branch meanwhile, the push is rejected instead of overwriting it.

The branch therefore always holds one commit and the repository does not grow. The sender writes its own markdown failure report to `$GITHUB_STEP_SUMMARY`; the workflow does not duplicate it, and GitHub emails on failure.

### Secrets (repository, Settings, Secrets and variables, Actions)

| Name | Used for |
|---|---|
| `WORKER_URL` | Base URL of the Worker, for `/outbox/*`. |
| `SENDER_TOKEN` | Bearer token for `/outbox/*`. Same value as the Worker secret. |
| `AGE_IDENTITY` | age identity that decrypts and re-encrypts `session.db.age`. |
| `ANNOUNCE_JID` | The only chat the sender may post to. |

The Worker's `GH_TOKEN` (fine-grained PAT, Actions: read and write) is a Worker secret, not a GitHub one.

### Does `workflow_dispatch` get disabled for inactivity?

No. GitHub documents the 60-day rule only for scheduled workflows: "In a public repository, scheduled workflows are automatically disabled when no repository activity has occurred in 60 days" ([disabling and enabling a workflow](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/disabling-and-enabling-a-workflow)). `send.yml` has no `schedule`, so no keepalive workflow is needed.

### Dispatch response

The REST reference for [creating a workflow dispatch event](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event) requires `ref`, treats `inputs` as optional, and currently documents a 200 response with the run id (it used to be 204). The Worker accepts any 2xx.

### Go module location

`sender/` is its own Go module (`cp-reminders/sender`), so the workflow runs `go run ./cmd/wa drain --state "$GITHUB_WORKSPACE/state"` with `working-directory: sender`, not `go run ./sender/cmd/wa` from the repository root. `setup-go` reads `sender/go.mod` and caches on `sender/go.sum`.

## ci.yml: checks

Runs on push and pull request with `permissions: contents: read` and a concurrency group that cancels superseded runs of the same ref. Three independent jobs:

| Job | Steps |
|---|---|
| `core` | `npm ci`, `npm test`, `npm run typecheck` at the repository root. |
| `worker` | In `worker/`: `npm ci`, `npm run typecheck`, `npm test` (the Workers runtime with a local D1). |
| `sender` | In `sender/`: `go vet ./...`, `go test ./...`. |

Neither workflow needs a secret to run CI.
