import type { Env } from "./env.ts";
import { json, text } from "./http.ts";
import { outboxRoutes } from "./outbox.ts";
import { type Route, route } from "./router.ts";
import { runTick } from "./tick.ts";

const fetcher = (input: string, init?: RequestInit) => fetch(input, init);

const routes: Route[] = [
  {
    method: "POST",
    path: "/tick",
    secret: "TICK_TOKEN",
    handle: async ({ env, now }) => json(await runTick(env, now, fetcher)),
  },
  ...outboxRoutes,
];

export default {
  async fetch(request, env) {
    try {
      return await route(routes, { request, env, now: Date.now(), fetcher });
    } catch (e) {
      console.error(e);
      return text("internal error", 500);
    }
  },
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runTick(env, Date.now(), fetcher));
  },
} satisfies ExportedHandler<Env>;
