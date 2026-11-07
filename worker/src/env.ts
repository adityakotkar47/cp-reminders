export type Env = Cloudflare.Env;
export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
