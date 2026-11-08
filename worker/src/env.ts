export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
