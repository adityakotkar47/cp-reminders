const encoder = new TextEncoder();
const BEARER = /^Bearer (.+)$/;

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < da.length; i++) diff |= da[i] ^ db[i];
  return diff === 0;
}

export async function isAuthorized(request: Request, expected: string | undefined): Promise<boolean> {
  if (!expected) return false;
  const provided = BEARER.exec(request.headers.get("Authorization") ?? "")?.[1];
  if (provided === undefined) return false;
  return safeEqual(provided, expected);
}
