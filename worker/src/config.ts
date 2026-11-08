import type { Tip, TipOverrides } from "./core/format.ts";
import type { Rules } from "./core/select.ts";
import rulesJson from "../config/rules.json" with { type: "json" };
import tipsJson from "../config/tips.json" with { type: "json" };

export const rules: Rules = rulesJson;
export const tipRules: Tip[] = tipsJson.rules;
export const baseOverrides: TipOverrides = tipsJson.overrides;
