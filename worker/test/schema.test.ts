import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("D1 schema", () => {
  it("creates the four tables from the migration", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations' ORDER BY name",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual(["contest_snapshot", "meta", "reminders", "tip_overrides"]);
  });

  it("restricts reminder status to the lifecycle states", async () => {
    const insert = (status: string) =>
      env.DB.prepare(
        "INSERT INTO reminders (key, resource_id, href, start_utc, deadline_utc, text, status, created_at, updated_at) VALUES (?1, 1, 'h', 's', 'd', 't', ?2, 'c', 'u')",
      )
        .bind(`k-${status}`, status)
        .run();
    await expect(insert("queued")).resolves.toBeDefined();
    await expect(insert("bogus")).rejects.toThrow(/CHECK constraint/);
  });

  it("allows only one contest_snapshot row", async () => {
    const insert = (id: number) =>
      env.DB.prepare("INSERT INTO contest_snapshot (id, source, fetched_at, payload) VALUES (?1, 'clist', 'f', '[]')")
        .bind(id)
        .run();
    await expect(insert(2)).rejects.toThrow(/CHECK constraint/);
  });
});
