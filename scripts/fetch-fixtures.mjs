process.loadEnvFile(".env");
const { CLIST_USERNAME: u, CLIST_API_KEY: k } = process.env;
const base = "https://clist.by/api/v4/contest/";
async function get(params) {
  const url = base + "?" + new URLSearchParams({ resource_id__in: "1,2,93,102", order_by: "start", limit: "200", ...params });
  const r = await fetch(url, { headers: { Authorization: `ApiKey ${u}:${k}` } });
  console.log(r.status, url.replace(/api_key=[^&]+/, ""));
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
import { writeFileSync } from "node:fs";
const past = await get({ start__gte: "2026-09-01T00:00:00", start__lt: "2026-11-07T00:00:00" });
writeFileSync("fixtures/clist-past.json", JSON.stringify(past, null, 2));
const up = await get({ start__gt: new Date().toISOString().slice(0, 19) });
writeFileSync("fixtures/clist-upcoming.json", JSON.stringify(up, null, 2));
console.log("past:", past.objects.length, "upcoming:", up.objects.length);
console.log(JSON.stringify(up.objects[0], null, 1));
for (const c of up.objects.slice(0, 25)) console.log(c.resource_id, c.start, c.duration, c.event, "|", c.href);
