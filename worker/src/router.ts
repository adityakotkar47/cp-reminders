import { isAuthorized } from "./auth.ts";
import type { Env, Fetcher } from "./env.ts";
import { text } from "./http.ts";

export type SecretName = "TICK_TOKEN" | "ADMIN_TOKEN" | "SENDER_TOKEN";

export interface RouteContext {
  request: Request;
  env: Env;
  now: number;
  fetcher: Fetcher;
}

export interface Route {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  secret?: SecretName;
  handle(ctx: RouteContext): Promise<Response>;
}

export async function route(routes: Route[], ctx: RouteContext): Promise<Response> {
  const { pathname } = new URL(ctx.request.url);
  const matching = routes.filter((r) => r.path === pathname);
  if (matching.length === 0) return text("not found", 404);
  const found = matching.find((r) => r.method === ctx.request.method);
  if (!found) return text("method not allowed", 405);
  if (found.secret && !(await isAuthorized(ctx.request, ctx.env[found.secret]))) return text("unauthorized", 401);
  return found.handle(ctx);
}
