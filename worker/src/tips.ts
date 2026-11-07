import type { TipOverrides } from "../../src/format.ts";
import { baseOverrides } from "./config.ts";
import type { Env } from "./env.ts";

export async function loadOverrides(env: Env): Promise<TipOverrides> {
  const { results } = await env.DB.prepare("SELECT href, tip FROM tip_overrides").all<{ href: string; tip: string }>();
  const stored: TipOverrides = {};
  for (const row of results) stored[row.href] = row.tip;
  return { ...baseOverrides, ...stored };
}
