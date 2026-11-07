import type { Env } from "./env.ts";

export default {
  async fetch() {
    return new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
