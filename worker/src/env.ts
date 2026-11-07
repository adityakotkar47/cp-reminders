export interface Env {
  DB: D1Database;
  CLIST_USERNAME: string;
  CLIST_API_KEY: string;
  GH_TOKEN: string;
  GH_REPO: string;
  TICK_TOKEN: string;
  ADMIN_TOKEN: string;
  SENDER_TOKEN: string;
}

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
