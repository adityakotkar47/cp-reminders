const NO_STORE = { "Cache-Control": "no-store" };

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...NO_STORE },
  });

export const text = (body: string, status = 200): Response =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", ...NO_STORE } });

export const badRequest = (message: string): Response => json({ error: message }, 400);

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
