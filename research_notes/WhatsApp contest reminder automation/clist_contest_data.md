# clist.by API v4 and alternative sources for upcoming contests (CodeChef, LeetCode, AtCoder, Codeforces) as of 7 Nov 2026

Method note: besides reading the docs, I probed the live endpoints on 2026-11-07 (from a Windows machine) and read the clist server source (github.com/aropan/clist, `src/clist/api/*.py`, last touched 2026-09-27). Items marked "(live-tested)" were observed directly. Items marked "(source)" come from the clist source code. The clist v4 contest endpoint returns 401 without a key, and I had no key, so the example clist JSON below is constructed from the source code and is NOT a captured response.

## 1. clist.by API v4: authentication, key, rate limit, endpoint, filters, fields, timezone

### Takeaway
Send `GET https://clist.by/api/v4/contest/?...` with header `Authorization: ApiKey <username>:<key>`; the key comes from your logged-in clist account. The default limit is 10 requests/minute per user. Timestamps are UTC (naive ISO strings) and `duration` is an integer number of seconds. Note that `upcoming=true` means "not yet ended", so it also returns contests already running.

### Cited Findings
- Auth: "Accessing the API requires an API key, available to authenticated users" (log in, then get username and key from the API page). "Non-key access is also available through website sessions." OAuth is also supported, and spreads request limits across multiple users. — [clist API v4 doc](https://clist.by/api/v4/doc/)
- Header format is `Authorization: ApiKey <username>:<key>`, confirmed in a real v4 request shape: `GET https://clist.by/api/v4/contest/?upcoming=true&start__gt=<now>&order_by=start&limit=100` with `Authorization: ApiKey <username>:<key>`. — [luvchakra/wonder-jobs PR #642](https://github.com/luvchakra/wonder-jobs/pull/642); the same format is mentioned in [boenshao/leetcode-difficulty-rating-extension PR #9](https://github.com/boenshao/leetcode-difficulty-rating-extension/pull/9) (via search snippet; not fetched).
- The server uses Django Tastypie `ApiKeyAuthentication`, which also accepts `?username=...&api_key=...` as query parameters (the older v2 gist uses that form). Sessions and OAuth2 are alternates. — [clist/api/common.py](https://github.com/aropan/clist/blob/master/src/clist/api/common.py); [gist using v2 query-param auth](https://gist.github.com/ryo-n/1b4149269c34ccb73afb330b97beae9c). Prefer the header so the key does not end up in URLs and logs.
- Rate limit: "Standard request limit is 10 per minute. Should you require a higher limit, please let us know." — [API doc, Throttle section](https://clist.by/api/v4/doc/). The source agrees: `DEFAULT_API_THROTTLE_AT_ = 10`, `CustomCacheThrottle(timeframe=60)`; the limit is per authenticated identifier and can be overridden per user (`api_throttle_at` in coder settings). — [settings.py](https://github.com/aropan/clist/blob/master/src/pyclist/settings.py), [throttle.py](https://github.com/aropan/clist/blob/master/src/clist/api/throttle.py)
- Formats: json, jsonp, yaml, xml, plist via `?format=json` or `/api/v4/json/...`. Atom/RSS only on `/api/v4/contest/` (`?format=atom|rss`, defaults `upcoming=true&format_time=true&start_time__during=1 day`). — [API doc](https://clist.by/api/v4/doc/)
- Contest list endpoint: `GET /api/v4/contest/` and single contest `GET /api/v4/contest/{id}/`. Default page size `limit = 100`. Response envelope: `meta` (`limit`, `next`, `offset`, `previous`, `total_count`) and `objects`. — Swagger schema at [clist.by/api/v4/doc/schema/contest/](https://clist.by/api/v4/doc/schema/contest/) (live-tested), [common.py](https://github.com/aropan/clist/blob/master/src/clist/api/common.py)
- Filters (from the live Swagger schema and `ContestResource.Meta.filtering`):
  - Time: `start`, `start__gt`, `start__lt`, `start__gte`, `start__lte`, `start__week_day`, and the same for `end`; `parsed_at__*`; `duration` and `duration__gt/lt/gte/lte` (time delta like `7200` or `"2 hours"`).
  - Resource: `resource_id`, `resource_id__in` (comma list), `resource` (host string exact), `resource__in`, `resource__regex`, `resource__iregex`.
  - Other: `host`, `event` (`event__regex`, `event__iregex`), `id`, `id__in`, `n_statistics*`, `n_problems*`.
  - Helpers: `upcoming` (boolean), `start_time__during` / `end_time__during` (time delta, e.g. `"1 day"`), `with_problems`, `total_count`, `format_time`, `filtered`, `category`, `limit`, `offset`, `order_by` (ascending by default, prefix `-` for descending).
  - Sortable fields: `id, event, start, end, resource_id, duration, parsed_at`. — [live schema](https://clist.by/api/v4/doc/schema/contest/), [v2.py ContestResource](https://github.com/aropan/clist/blob/master/src/clist/api/v2.py)
- Semantics of `upcoming`: in source, `upcoming=true` filters `end_time__gt = now` (contest not yet ended, so running contests are included); `upcoming=false` gives `end_time__lte = now`. — [v2.py `apply_filters`](https://github.com/aropan/clist/blob/master/src/clist/api/v2.py)
- Response fields for each contest object: `id`, `resource` (host string, e.g. `codeforces.com`), `resource_id`, `host`, `event` (contest title), `start`, `end`, `duration`, `href`, `n_statistics`, `n_problems`, `parsed_at`, `problems` (null unless `with_problems=true`). — [live schema model `contest`](https://clist.by/api/v4/doc/schema/contest/), [v2.py](https://github.com/aropan/clist/blob/master/src/clist/api/v2.py)
- Timezone/units: Django settings are `TIME_ZONE = "UTC"`, `USE_TZ = True`; `duration` is mapped from `duration_in_secs`, so it is integer seconds. `start`/`end` are returned as ISO datetimes in UTC unless `format_time=true` (then converted to the account's timezone/format, and `duration` becomes a human string like "2 hours"; do not set it in a bot). — [settings.py](https://github.com/aropan/clist/blob/master/src/pyclist/settings.py), [v2.py](https://github.com/aropan/clist/blob/master/src/clist/api/v2.py). A community client likewise builds its `end__gt` filter from `datetime.now(timezone.utc)` truncated to 19 chars, i.e. `YYYY-MM-DDTHH:MM:SS` — [gist](https://gist.github.com/ryo-n/1b4149269c34ccb73afb330b97beae9c) (that gist is v2).
- Resource-list endpoint: `GET /api/v4/resource/` returns `id, name, icon, short, n_accounts, n_contests` (live schema), and the gist notes resource ids can be fetched from it. — [resource schema](https://clist.by/api/v4/doc/schema/resource/)

#### Example request (cURL)
```
curl -s -H "Authorization: ApiKey YOUR_USERNAME:YOUR_KEY" \
 "https://clist.by/api/v4/contest/?resource_id__in=1,2,93,102&upcoming=true&start__gt=2026-11-07T00:00:00&start__lt=2026-11-14T00:00:00&order_by=start&limit=100&format=json"
```
Python: `requests.get(url, headers={"Authorization": f"ApiKey {user}:{key}"}, params={...})`. Pass the datetimes as UTC.

#### Example JSON (constructed from source field definitions, not captured live)
```json
{
 "meta": {"limit": 100, "next": null, "offset": 0, "previous": null, "total_count": 1},
 "objects": [
  {
   "id": 61234567,
   "resource": "codeforces.com",
   "resource_id": 1,
   "host": "codeforces.com",
   "event": "Codeforces Round 1133 (Div. 2)",
   "start": "2026-11-07T14:35:00",
   "end": "2026-11-07T17:05:00",
   "duration": 9000,
   "href": "https://codeforces.com/contests/2280",
   "n_statistics": null,
   "n_problems": null,
   "parsed_at": null,
   "problems": null
  }
 ]
}
```
The contest values are taken from the real Codeforces API data below. `id` and the datetime string format are illustrative.

### Inferences
- UTC to IST is +5:30. 14:35 UTC is 20:05 IST, matching the user's "8:05 PM" style. Reminder time = start - 75 min, computed in UTC, formatted in `Asia/Kolkata`.
- Since the limit is 10/min and the bot needs one call per refresh, polling every 15-60 minutes is far within budget. Cache the result.
- Because `upcoming=true` includes in-progress contests, filter client-side on `start > now` (or `start__gt=<now>`) so already-started contests are not announced.
- The datetime string has no `Z` or offset, so parse as naive and attach UTC explicitly (a Tastypie default; I did not capture a live response to confirm the exact string, including the possibility of a `+00:00` suffix). Parse defensively.

### Gaps
- I could not capture a real v4 contest response (no API key; endpoint returns 401 unauthenticated), so the exact datetime string format and whether `href` is always the canonical contest URL are unverified.
- How to obtain the key: the doc page only says "available to authenticated users here" (link to account/API key page after login at https://clist.by/login/); the exact page path was not verified. Numeric key format/expiry not documented.
- Whether the documented 10/min limit is enforced per key or per IP; the source shows it is keyed on the authenticated identifier.

## 2. Resource ids and host names on clist

### Takeaway
Codeforces = 1, CodeChef = 2, AtCoder = 93, LeetCode = 102. Hosts: `codeforces.com`, `codechef.com`, `atcoder.jp`, `leetcode.com`. Filter with `resource_id__in=1,2,93,102` (or by `resource=<host>`).

### Cited Findings
- Resource pages on clist link to account lists with the resource id: `https://clist.by/resource/codeforces.com/` contains `resource=1` links; `codechef.com` contains `resource=2`; `atcoder.jp` contains `resource=93` (e.g. `/accounts/?resource=93&sort_column=rating...`); `leetcode.com` contains `resource=102`. (live-tested; the page HTML was fetched from the four resource URLs) — [codeforces](https://clist.by/resource/codeforces.com/), [codechef](https://clist.by/resource/codechef.com/), [atcoder](https://clist.by/resource/atcoder.jp/), [leetcode](https://clist.by/resource/leetcode.com/)
- A community script's id list `1,93,109,103,102` includes 1 (Codeforces), 93 (AtCoder), 102 (LeetCode), consistent with the above — [gist](https://gist.github.com/ryo-n/1b4149269c34ccb73afb330b97beae9c)
- `resource` on the contest object is the resource's host (`resource__host`), so `resource=codeforces.com` works as an exact filter. — [v2.py](https://github.com/aropan/clist/blob/master/src/clist/api/v2.py)
- Codeforces Gym is a separate clist resource (`codeforces.com/gym`-style host in the codebase, see `codeforces_gym.py`); filtering by `resource_id=1` avoids gym contests. — [clist ranking modules](https://github.com/aropan/clist/tree/master/src/ranking/management/modules)

### Inferences
- Best practice: call `/api/v4/resource/?host__in=...` once (or hard-code the ids and verify at startup) so ids are not trusted blindly.

### Gaps
- I did not call `/api/v4/resource/` authenticated, so the ids come from page links, not from the API body itself.

## 3. Known quirks: duplicates, unrated/practice contests, time changes, dedupe

### Takeaway
Expect (a) non-rated and practice entries (Kotlin Heroes: Practice, Codeforces placeholder-named rounds), (b) several simultaneous contests per platform (Div. 1 and Div. 2 share a start time; CodeChef runs multiple series per week; AtCoder lists ABC/ARC/AGC separately), and (c) start times that can move. Dedupe on the source's own stable id, and re-poll.

### Cited Findings
- Codeforces' real upcoming list on 2026-11-07 (live-tested via official API) includes: Round 1133 Div. 1 (id 2279) and Div. 2 (id 2280), both starting 14:35 UTC for 9000 s; Round 1134 (Div. 4) (id 2290, 12 Nov 13:35 UTC, 8100 s, type ICPC); placeholder-named entries "Codeforces Round (Div. 2)" (ids 2285/2288) and "Codeforces Round (Div. 1)" (id 2287) with no round number yet; "Kotlin Heroes: Practice 15" (id 2286, 1 Dec, duration 604800 s = 7 days) and "Kotlin Heroes: Episode 15" (id 2282). — [Codeforces API contest.list](https://codeforces.com/api/contest.list?gym=false)
- CodeChef's live list (live-tested) mixes "Starters 264" (2 h, Wed 20:00 IST) with weekly "Monday Munch - DSA Challenge 028 (Rated)" (3 h, Mon 19:00:05 IST), and past entries carry rating suffixes like "(Rated for 5 Star)". — [CodeChef contests API](https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all)
- AtCoder's upcoming page (live-tested) lists AGC 079 (8 Nov 21:00 JST, 03:30), ABC 484/485/486, ARC 234 etc., each with a "Rated Range" column (ABC `- 1999`, ARC `1600 - 2999`, AGC `2000 -`) — [AtCoder contests](https://atcoder.jp/contests/). Unrated contests (e.g. "AtCoder Daily Training", "AtCoder Weekday Contest") exist in AtCoder's contest set but are not on the upcoming formal list (seen in the kenkoooo dump below).
- Timing changes: clist is an aggregator that re-parses sources; its terms say it gives no guarantee of "accuracy, completeness or freshness of contest data" and disclaims liability for "missed contests". — [clist ToS](https://clist.by/terms/). `parsed_at` is the field for when a record was last parsed.
- Dedupe: clist `id` is the unique numeric key for a contest entry; `href` and (`resource_id`, `event`, `start`) are also stable. Codeforces's own contest id is in the href (`/contests/2280`). — [clist schema](https://clist.by/api/v4/doc/schema/contest/), [Codeforces API](https://codeforces.com/api/contest.list?gym=false)

### Inferences
- Recommended dedupe key: `(resource_id, href)`, falling back to `(resource_id, event, start)`. When a poll returns the same key with a different `start`, treat it as a reschedule and recompute the reminder time (cancel the old pending one if not yet sent).
- Filter noise: drop Codeforces "Practice" events (duration >= 1 day), optionally drop `event__regex` placeholders without a round number until named, and decide whether to include unrated/Div. 3/4/Educational rounds. Div. 1 and Div. 2 at the same start could be merged into one message.
- Before sending, re-verify the next 24h of contests directly with the platform API (see section 4) as a cross-check on clist freshness.

### Gaps
- I found no documented clist policy for how it handles postponements/cancellations (e.g. whether a contest is hard-deleted or updated in place); the tradeoffs above are inferences.
- I did not verify clist's own filters for "unrated" (clist has per-user `filtered`/`category` filters, but the generic `kind` of a contest is not in the v4 contest schema).

## 4. Fallbacks: official sources

### Takeaway
Codeforces and CodeChef have working unauthenticated JSON endpoints; LeetCode has a working unauthenticated GraphQL query; AtCoder has no JSON API, so scrape its upcoming contest page (kenkoooo's JSON dump contains only already-started contests). All four were tested live and are sufficient to build a clist-independent fallback.

### Cited Findings
- **Codeforces**: `GET https://codeforces.com/api/contest.list?gym=false` (live-tested, no key) returns `{"status":"OK","result":[{id, name, type (CF/ICPC/IOI), phase (BEFORE/CODING/FINISHED...), frozen, durationSeconds, startTimeSeconds (Unix UTC), relativeTimeSeconds}]}`. Upcoming = `phase == "BEFORE"`. Link pattern `https://codeforces.com/contests/{id}`. Official limit: at most 1 request per 2 seconds; exceeding returns FAILED / "Call limit exceeded"; all methods can be called anonymously. — [Codeforces API help](https://codeforces.com/apiHelp) (the page itself returned a bot-challenge to my fetch; the rate-limit statement is from search results quoting it); live response sample: `{"id":2282,"name":"Kotlin Heroes: Episode 15","type":"ICPC","phase":"BEFORE","frozen":false,"durationSeconds":9000,"startTimeSeconds":1796740500,"relativeTimeSeconds":-2681739}`.
- **LeetCode**: `POST https://leetcode.com/graphql` with body `{"query":"{ upcomingContests { title titleSlug startTime duration } }"}` (live-tested, no auth, `Content-Type: application/json`, browser-like User-Agent) returned `{"data":{"upcomingContests":[{"title":"Biweekly Contest 195","titleSlug":"biweekly-contest-195","startTime":1794061800,"duration":5400},{"title":"Weekly Contest 527","titleSlug":"weekly-contest-527","startTime":1794105000,"duration":5400}]}}`. `startTime` is Unix seconds (UTC), `duration` is seconds. Link: `https://leetcode.com/contest/{titleSlug}`. A second query, `allContests`, also worked (live-tested). This is an unofficial/undocumented API, so it can change without notice. — [leetcode.com/graphql](https://leetcode.com/graphql)
- **CodeChef**: `GET https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all` (live-tested, no auth) returns `future_contests`, `present_contests`, `practice_contests`, `past_contests`, each with `contest_code`, `contest_name`, `contest_start_date_iso` (already with `+05:30`, e.g. `2026-11-11T20:00:00+05:30`), `contest_end_date_iso`, `contest_duration` (minutes, as a string). Link: `https://www.codechef.com/{contest_code}` (e.g. START264). Undocumented endpoint used by the website. — [CodeChef API](https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all)
- **AtCoder**: no official API found. The HTML page `https://atcoder.jp/contests/` has an "Upcoming Contests" table (`#contest-table-upcoming`) with rows like `2026-11-14 21:00:00+0900`, name, duration (`01:40`), rated range, and links `/contests/abc484`. Times are JST (+0900) by default. Link: `https://atcoder.jp/contests/{slug}`. — [AtCoder contests](https://atcoder.jp/contests/) (live-tested/scraped)
- **kenkoooo AtCoder Problems**: `https://kenkoooo.com/atcoder/resources/contests.json` is a static S3/CloudFront file (1 MB, `Last-Modified: Fri, 06 Nov 2026`) with `{id, start_epoch_second, duration_second, title, rate_change}`; but my check found 0 entries with a start time later than now (latest entry was an already-started 6 Nov contest), so it is a historical dataset and not suitable for upcoming reminders. — [kenkoooo contests.json](https://kenkoooo.com/atcoder/resources/contests.json) (live-tested)
- **kontests.net**: unreachable from my test (connection failed for `https://kontests.net/api/v1/all`, the site root and the `www.` host: no HTTP response). API Bouncer marks the KONTESTS API as dead (last checked 1 Apr 2026). I found no official shutdown announcement. — [API Bouncer](https://www.apibouncer.com/apis/844/kontests); treat as defunct and do not depend on it.

### Inferences
- Because three of four platforms expose timestamped JSON (and CodeChef's already has an IST offset), a four-source direct pipeline (CF + LC + CC JSON, AtCoder HTML scrape) is a viable no-key fallback; clist is a convenience that gives one normalized call.
- Suggested architecture: primary = clist; sanity check or fallback = direct APIs when clist returns 401/429/5xx or an empty list.

### Gaps
- Official CodeChef and LeetCode APIs are not documented; their stability is unknown. I did not check whether they are rate-limited or Cloudflare-protected for server IPs (they responded from my home IP; datacenter IPs may be challenged).
- Other aggregators (e.g. contest-calendar projects, RSSHub's Codeforces route) exist but I did not evaluate them; I only know RSSHub has a Codeforces contests route.
- The Codeforces `apiHelp` page was not directly readable (bot challenge), so the exact wording of its rate limit and the `contest.list` parameter documentation is second-hand.

## 5. clist ToS and usage terms for a non-commercial bot

### Takeaway
A personal/community bot is the intended use. Obligations: respect rate limits, cache, keep the key secret (not in public repos), and attribute CLIST when used in public projects. Redistributing the raw data as a competing API is prohibited.

### Cited Findings
- "CLIST may provide a free API intended mainly for personal, educational and community projects." You agree to: respect documented or communicated rate limits; "implement reasonable caching to avoid repeated requests for the same data within a short time"; "keep your API credentials secret and not publish them in public repositories"; "clearly attribute CLIST as the source of contest data when used in public projects." — [clist ToS](https://clist.by/terms/) (last updated 8 Dec 2025)
- Prohibited: "resell, repackage or redistribute CLIST's raw data as a competing contest API or commercial data feed without a separate agreement"; harmful automated request patterns; misrepresenting your project as an official CLIST product. — [clist ToS](https://clist.by/terms/)
- Suggested attribution wording: "Contest data provided by CLIST" or "Powered by CLIST" (appreciated, not strictly mandated for private use). — [clist ToS](https://clist.by/terms/)
- clist may change rate limits, endpoints or access policies at any time, may revoke API access on abuse, and provides data "as is" with no guarantee of accuracy, completeness or freshness; it explicitly disclaims liability for "missed contests". — [clist ToS](https://clist.by/terms/)

### Inferences
- A private WhatsApp group reminder bot fits "personal, educational and community". Adding a small footer such as "Data: CLIST" to the message (or the group description) satisfies attribution cheaply. Store the key in an environment variable or secret store, not in the repo.
- Because there is no uptime or accuracy guarantee, a fallback to official sources (section 4) is advisable.

### Gaps
- The ToS says nothing explicit about WhatsApp or messaging-bot use; whether a large public channel counts as a "public project" requiring attribution is a judgment call.
- Codeforces, CodeChef, LeetCode and AtCoder terms for their own scraped/undocumented endpoints were not reviewed.
