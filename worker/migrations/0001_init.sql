CREATE TABLE contest_snapshot (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  source      TEXT    NOT NULL CHECK (source IN ('clist', 'codeforces')),
  fetched_at  TEXT    NOT NULL,
  payload     TEXT    NOT NULL
);

CREATE TABLE reminders (
  key           TEXT    PRIMARY KEY,
  resource_id   INTEGER NOT NULL,
  href          TEXT    NOT NULL,
  start_utc     TEXT    NOT NULL,
  deadline_utc  TEXT    NOT NULL,
  text          TEXT    NOT NULL,
  status        TEXT    NOT NULL CHECK (status IN ('queued', 'claimed', 'sent', 'failed', 'expired')),
  attempts      INTEGER NOT NULL DEFAULT 0,
  claim_id      TEXT,
  claimed_at    TEXT,
  message_id    TEXT,
  last_error    TEXT,
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL,
  sent_at       TEXT
);

CREATE INDEX reminders_by_status ON reminders (status, deadline_utc);

CREATE TABLE tip_overrides (
  href        TEXT PRIMARY KEY,
  tip         TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE meta (
  k  TEXT PRIMARY KEY,
  v  TEXT NOT NULL
);
