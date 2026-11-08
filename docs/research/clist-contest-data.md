# Contest data sources

## clist.by API v4

| Aspect | Behaviour | Source |
|---|---|---|
| Authentication | `Authorization: ApiKey <username>:<key>`; the key is shown to logged-in users on the API page. Query parameters `username` and `api_key`, website sessions and OAuth also work; the header keeps the key out of URLs and logs. | [API v4 docs](https://clist.by/api/v4/doc/), [common.py](https://github.com/aropan/clist/blob/master/src/clist/api/common.py) |
| Rate limit | "Standard request limit is 10 per minute", per authenticated user and adjustable on request. | [API v4 docs](https://clist.by/api/v4/doc/), [settings.py](https://github.com/aropan/clist/blob/master/src/pyclist/settings.py), [throttle.py](https://github.com/aropan/clist/blob/master/src/clist/api/throttle.py) |
| Endpoint | `GET /api/v4/contest/` (and `/api/v4/contest/{id}/`), 100 results per page by default. The response is `{meta: {limit, next, offset, previous, total_count}, objects: [...]}`. | [contest schema](https://clist.by/api/v4/doc/schema/contest/) |
| Contest fields | `id`, `resource` (host), `resource_id`, `host`, `event` (name), `start`, `end`, `duration`, `href`, `n_statistics`, `n_problems`, `parsed_at`, `problems`. | [contest schema](https://clist.by/api/v4/doc/schema/contest/) |
| Times | `start` and `end` are UTC, as ISO strings without a zone (`2026-11-07T14:35:00`). `duration` is whole seconds. `format_time=true` converts times to the account's zone and turns `duration` into text, so a bot leaves it unset. | [settings.py](https://github.com/aropan/clist/blob/master/src/pyclist/settings.py), [v2.py](https://github.com/aropan/clist/blob/master/src/clist/api/v2.py), live responses |
| Filters | Time: `start`, `end` with `__gt`, `__lt`, `__gte`, `__lte`; `duration` and its comparisons. Resource: `resource_id`, `resource_id__in`, `resource`, `resource__regex`. Name: `event`, `event__regex`. Paging and order: `limit`, `offset`, `order_by` (prefix `-` for descending). | [contest schema](https://clist.by/api/v4/doc/schema/contest/), [v2.py](https://github.com/aropan/clist/blob/master/src/clist/api/v2.py) |
| `upcoming` | `upcoming=true` means "not yet ended" (`end > now`), so it includes contests already running; `start__gt=<now>` excludes them. | [v2.py](https://github.com/aropan/clist/blob/master/src/clist/api/v2.py) |
| Formats | JSON, JSONP, YAML, XML and plist; Atom and RSS for contests. | [API v4 docs](https://clist.by/api/v4/doc/) |

Example:

```sh
curl -H "Authorization: ApiKey $CLIST_USERNAME:$CLIST_API_KEY" \
  "https://clist.by/api/v4/contest/?resource_id__in=1,2,93,102&start__gt=2026-11-07T13:20:00&order_by=start&limit=100"
```

```json
{
  "duration": 9000,
  "end": "2026-11-07T17:05:00",
  "event": "Codeforces Round 1133 (Div. 2)",
  "host": "codeforces.com",
  "href": "https://codeforces.com/contests/2280",
  "id": 71453079,
  "resource": "codeforces.com",
  "resource_id": 1,
  "start": "2026-11-07T14:35:00"
}
```

### Resources

| Platform | `resource_id` | Host |
|---|---|---|
| Codeforces | 1 | `codeforces.com` |
| CodeChef | 2 | `codechef.com` |
| AtCoder | 93 | `atcoder.jp` |
| LeetCode | 102 | `leetcode.com` |

The IDs appear in the account links on each resource page ([Codeforces](https://clist.by/resource/codeforces.com/), [CodeChef](https://clist.by/resource/codechef.com/), [AtCoder](https://clist.by/resource/atcoder.jp/), [LeetCode](https://clist.by/resource/leetcode.com/)) and in the API's contest objects; `GET /api/v4/resource/` lists all resources ([resource schema](https://clist.by/api/v4/doc/schema/resource/)). Codeforces Gym is a separate resource, so `resource_id=1` excludes gym contests.

### Data characteristics

- Codeforces lists Div. 1 and Div. 2 rounds that start together as two contests, announces rounds under placeholder names such as "Codeforces Round (Div. 2)" before they are numbered, and includes week-long events such as "Kotlin Heroes: Practice" ([Codeforces API](https://codeforces.com/api/contest.list?gym=false)).
- CodeChef runs Starters alongside Monday Munch and Placement Prep weekends, and appends rating notes to names, such as "(Rated for 5 Star)" ([CodeChef API](https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all)).
- AtCoder lists ABC, ARC, AGC and heuristic contests separately, each with a rated range; sponsored contests carry the sponsor's name with the contest name in parentheses ([AtCoder contests](https://atcoder.jp/contests/)).
- clist re-parses its sources (`parsed_at` records when); its terms give no guarantee of accuracy or freshness and disclaim liability for missed contests ([terms](https://clist.by/terms/)). How it records a postponed or cancelled contest is not documented.
- `href` and `(resource_id, event, start)` identify a contest independently of clist's numeric `id`, and the platform's own contest number is part of the Codeforces link.

### Terms

"CLIST may provide a free API intended mainly for personal, educational and community projects." Users agree to respect rate limits, "implement reasonable caching", "keep your API credentials secret and not publish them in public repositories" and "clearly attribute CLIST as the source of contest data when used in public projects". Reselling or redistributing the raw data as a competing feed is prohibited, and clist may change limits or revoke access ([terms](https://clist.by/terms/)).

## Platform sources

All four answer without a key.

| Platform | Request | Response |
|---|---|---|
| Codeforces | `GET https://codeforces.com/api/contest.list?gym=false` | `{status: "OK", result: [{id, name, type, phase, durationSeconds, startTimeSeconds}]}`; upcoming contests have `phase` `BEFORE`; times are Unix UTC; the link is `https://codeforces.com/contests/{id}`. At most one request every two seconds ([API help](https://codeforces.com/apiHelp)). |
| LeetCode | `POST https://leetcode.com/graphql` with `{"query":"{ upcomingContests { title titleSlug startTime duration } }"}` | `startTime` in Unix seconds, `duration` in seconds; the link is `https://leetcode.com/contest/{titleSlug}`. Undocumented. |
| CodeChef | `GET https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all` | `future_contests` and other lists with `contest_code`, `contest_name`, `contest_start_date_iso` (with `+05:30`) and `contest_duration` in minutes; the link is `https://www.codechef.com/{contest_code}`. Undocumented. |
| AtCoder | `GET https://atcoder.jp/contests/` (HTML) | The `#contest-table-upcoming` table: start time in JST (`+0900`), name, duration, rated range and `/contests/{slug}` link. No JSON API. |

The undocumented LeetCode and CodeChef endpoints may change without notice and may challenge datacenter IP addresses. kenkoooo's `contests.json` for AtCoder ([AtCoder Problems](https://kenkoooo.com/atcoder/resources/contests.json)) contains only contests that have started, and kontests.net does not respond ([API Bouncer](https://www.apibouncer.com/apis/844/kontests)), so neither is a source of upcoming contests.
