export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export function internalError(error: unknown, publicMessage: string) {
  const errorId = crypto.randomUUID();
  console.error(`[${errorId}]`, error);
  return json({ error: publicMessage, errorId }, 500);
}
