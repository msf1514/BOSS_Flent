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
  // Preferred path: a real authenticated user injected by the hosting platform.
  // If proper auth is ever added, it takes precedence over the demo fallback.
  const id = request.headers.get('oai-authenticated-user-id')?.trim();
  const email = request.headers.get('oai-authenticated-user-email')?.trim();
  if (id) return { id, label: decodedFullName(request) ?? email ?? id };

  const hostname = new URL(request.url).hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return { id: 'local-development', label: 'Local pilot reviewer' };
  }

  // Take-home demo: this pilot is deployed without an auth provider, so there
  // are no real user accounts to sign in with. Rather than block every reviewer
  // behind a login wall they cannot pass, the deployed app treats each visitor
  // as a shared demo reviewer. This is a deliberate demo choice — production
  // would remove this fallback and require a real authenticated user (see
  // Open Decision #2 on tenancy/access control).
  return { id: 'demo-reviewer', label: 'Demo reviewer' };
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
