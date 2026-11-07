import { readFileSync, writeFileSync } from "node:fs";
const txt = readFileSync(process.argv[2], "utf8").replace(/\r/g, "");
const re = /^\[(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+) ([AP]M)\] You: (🚨 Contest Reminder 🚨[\s\S]*?)(?=^\[|\n*$(?![\s\S]))/gm;
const out = [];
for (const m of txt.matchAll(re)) {
  let [, mo, d, y, h, mi, s, ap, body] = m;
  h = (+h % 12) + (ap === "PM" ? 12 : 0);
  const postedIST = `20${y}-${mo.padStart(2,"0")}-${d.padStart(2,"0")}T${String(h).padStart(2,"0")}:${mi}:${s}+05:30`;
  out.push({ postedIST, text: body.replace(/\n+$/, "") });
}
writeFileSync("fixtures/history.json", JSON.stringify(out, null, 2));
console.log(out.length, "reminders");
