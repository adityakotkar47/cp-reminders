# GitHub Actions workflows

`.github/workflows/` holds two workflows. Every action is pinned to a full commit SHA, with its release in a trailing comment.

## send.yml: drain the outbox

The Worker starts `send.yml` through `workflow_dispatch` with no inputs ([architecture.md](architecture.md#workflow-dispatch)); it has no other trigger. Because every run drains the whole outbox, an extra or a missing wake-up does no harm.

| Aspect | Setting | Reason |
|---|---|---|
| Concurrency | `group: wa-session`, `cancel-in-progress: false` | WhatsApp allows one live connection per session and the keys rotate on every connection, so runs are serialised. A running job is never cancelled, and at most one run waits as pending; a newer pending run replaces it ([concurrency](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs)). |
| Permissions | `contents: write` | Pushing branch `state` with the built-in token. |
| Timeout | 6 minutes | The sender's own limit is 4 minutes, including up to 90 s of jitter. |
| Checkout | `main` with `persist-credentials: false` | No token remains in `.git/config` while the sender runs. |
| Secrets | Passed to the step through `env:` | Expressions appear only in `env:` and `with:`, never inside a script. The secrets are listed in [architecture.md](architecture.md#secrets). |

Steps:

1. **Fetch state branch.** Initialises `./state` as a repository on branch `state` and fetches branch `state` with an `http.extraheader` built from `github.token` for that command only. When the branch does not exist yet, `./state` stays an empty orphan branch. The fetched commit is kept as `STATE_SHA`.
2. **Set up Go** from `sender/go.mod`, with the module cache keyed on `sender/go.sum`.
3. **Drain the outbox.** `go run ./cmd/wa drain --state "$GITHUB_WORKSPACE/state"` in `sender/`, which is its own module (`github.com/adityakotkar47/cp-reminders/sender`). On failure the sender writes the unsent texts to the job summary, and GitHub emails the owner about the failed run.
4. **Persist state** (`if: always()`, because the keys rotate even when the drain fails). If `session.db.age` or `sent.json` changed, the step commits exactly those files, and only those that exist, as a single orphan commit by `github-actions[bot]`, then runs `git push --force-with-lease="state:$STATE_SHA" origin next:refs/heads/state`. The allowlist keeps a plaintext `session.db` out of the repository, the single commit keeps the repository from growing, and the lease rejects the push if the branch moved since step 1; an empty `STATE_SHA` requires that the branch does not exist.

## ci.yml: checks

Runs on every push and pull request, with `contents: read` and a concurrency group that cancels older runs for the same ref. It uses no secrets.

| Job | Steps |
|---|---|
| `worker` | [`pnpm/setup`](https://github.com/pnpm/setup) installs Node 24, the pnpm version in the root `packageManager` field, and the workspace; then `pnpm --filter cp-reminders-worker typecheck` and `test`. The tests include the golden tests in `worker/test/core/`. |
| `sender` | `go vet ./...` and `go test ./...` in `sender/`. |

The root `package.json` contains only `name`, `private` and `packageManager`: `pnpm/setup` takes the pnpm version from it and runs `pnpm install` when a `package.json` is present.
