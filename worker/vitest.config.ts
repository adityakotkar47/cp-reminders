import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const TEST_SECRETS = {
  CLIST_USERNAME: "user",
  CLIST_API_KEY: "key",
  GH_TOKEN: "ghp_test",
  TICK_TOKEN: "tick-secret",
  ADMIN_TOKEN: "admin-secret",
  SENDER_TOKEN: "sender-secret",
} satisfies Partial<Record<keyof Cloudflare.Env, string>>;

Object.assign(process.env, TEST_SECRETS);

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: { bindings: { TEST_MIGRATIONS: migrations, ...TEST_SECRETS } },
      }),
    ],
    test: {
      setupFiles: ["./test/setup.ts"],
      include: ["test/**/*.test.ts"],
    },
  };
});
