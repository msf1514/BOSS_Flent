export type RequestActor = {
  id: string;
  label: string;
};

function decodedFullName(request: Request) {
  const encoding = request.headers.get(
    'oai-authenticated-user-full-name-encoding',
  );
  const encoded = request.headers.get('oai-authenticated-user-full-name');
  if (!encoded || encoding !== 'percent-encoded-utf-8') return null;
  try {
    return decodeURIComponent(encoded).trim() || null;
  } catch {
    return null;
  }
}

export function actorFromRequest(request: Request): RequestActor | null {
  const id = request.headers.get('oai-authenticated-user-id')?.trim();
  const email = request.headers.get('oai-authenticated-user-email')?.trim();
  if (id) return { id, label: decodedFullName(request) ?? email ?? id };

  const hostname = new URL(request.url).hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return { id: 'local-development', label: 'Local pilot reviewer' };
  }
  return null;
}

// Single authorization checkpoint for deal-scoped evidence access.
//
// Today this only confirms an authenticated actor: there is no deal-ownership
// or team-membership model in the pilot (Open Decision #2 in
// docs/CASE_PACKET_COVERAGE_AND_NEXT_WORK.md), so any signed-in user can read
// any deal they can name. That is an accepted, documented limitation — NOT
// per-user isolation. When a tenancy model lands, enforce it here alone and
// every evidence route inherits it. Returns true when access is permitted.
export function authorizeDealAccess(
  actor: RequestActor | null,
  _dealId: string,
): actor is RequestActor {
  return actor !== null;
}
