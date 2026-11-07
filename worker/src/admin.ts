import { badRequest, json, readJson, text } from "./http.ts";
import { renderPreview } from "./preview.ts";
import type { Route } from "./router.ts";

const MAX_HREF_LENGTH = 500;
const MAX_TIP_LENGTH = 500;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function parseHref(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_HREF_LENGTH) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : undefined;
  } catch {
    return undefined;
  }
}

export const adminRoutes: Route[] = [
  {
    method: "GET",
    path: "/preview",
    secret: "ADMIN_TOKEN",
    handle: async ({ env, now, fetcher }) => text(await renderPreview(env, now, fetcher)),
  },
  {
    method: "PUT",
    path: "/tips",
    secret: "ADMIN_TOKEN",
    async handle({ request, env, now }) {
      const body = await readJson(request);
      if (!isRecord(body)) return badRequest("body must be a JSON object");
      const href = parseHref(body.href);
      if (href === undefined) return badRequest("href must be an http(s) URL");
      const { tip } = body;
      if (typeof tip !== "string" || tip.length > MAX_TIP_LENGTH) {
        return badRequest(`tip must be a string up to ${MAX_TIP_LENGTH} characters`);
      }
      await env.DB
        .prepare(
          "INSERT INTO tip_overrides (href, tip, updated_at) VALUES (?1, ?2, ?3) " +
            "ON CONFLICT(href) DO UPDATE SET tip = excluded.tip, updated_at = excluded.updated_at",
        )
        .bind(href, tip, new Date(now).toISOString())
        .run();
      return json({ ok: true });
    },
  },
  {
    method: "DELETE",
    path: "/tips",
    secret: "ADMIN_TOKEN",
    async handle({ request, env }) {
      const body = await readJson(request);
      if (!isRecord(body)) return badRequest("body must be a JSON object");
      const href = parseHref(body.href);
      if (href === undefined) return badRequest("href must be an http(s) URL");
      const result = await env.DB.prepare("DELETE FROM tip_overrides WHERE href = ?1").bind(href).run();
      return json({ deleted: result.meta.changes });
    },
  },
];
