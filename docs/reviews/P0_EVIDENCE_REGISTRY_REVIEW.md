# Code review — P0 evidence registry

Reviewed with `code-review-skill` (`.claude/skills/code-review-skill`), four-phase
process, using the TypeScript, Security (IDOR), SQL-Injection, Error-Handling and
Universal-Quality guides.

## Summary

Adds the shared evidence-capture registry (P0): `evidence_artifacts` table +
migration, a pure classification module, the registry IO layer (ingest, inventory,
supersede, soft-delete), and the `/api/evidence` route. Capture-only — no artifact
content is routed into the Problem 1 median.

**PR size:** Medium (~700 lines across 8 files).

## Strengths

- 🌟 `[praise]` Clean split of pure rules (`evidence-classification.ts`) from IO
  (`evidence-registry.ts`) — the capture-boundary logic is unit-testable with no
  Cloudflare binding.
- 🌟 `[praise]` R2-write-then-DB-write with rollback on failure mirrors the existing
  `persistRun` convention; no orphaned objects.
- 🌟 `[praise]` The leakage guard is encoded in data: `PACKET_MANIFEST` marks
  photos / outcomes / prior-assessment `consumedByProblem1: false`.

## Architecture & performance

- Separation of concerns: pure vs IO vs route — clear.
- Consistent with existing patterns: `ensureSchema()`, `id()`/`now()`, prepared
  statements, audit-event shape all reused.
- Queries: all deal-scoped and indexed (`idx_evidence_artifacts_deal`,
  `idx_evidence_artifacts_kind`, unique dedupe index). No N+1 — inventory is a
  single `SELECT` grouped in memory.

## Findings and resolutions

🟡 `[important]` **TOCTOU on dedupe** — ingest checked `artifactByHash` then inserted;
two concurrent identical uploads both pass the check and the loser's insert violates
the unique index, surfacing as a 500.
> Resolved: wrapped the insert in `try/catch`; on `uniqueConflict` we drop the
> just-written object and return the existing artifact as a duplicate. Matches the
> Universal-Quality guide's rule: replace "if exists → operate" with
> "try operate → catch".

🟡 `[important]` **IDOR / access control** — SQL is deal-scoped so no cross-deal leak,
but the route trusted a client-supplied `dealId` with only an authentication check.
No deal-ownership model exists yet (Open Decision #2).
> Resolved: added a single `authorizeDealAccess(actor, dealId)` seam in `lib/auth.ts`
> that every evidence handler calls. It currently only confirms authentication and is
> documented as an accepted limitation (not per-user isolation); real RBAC wires in at
> one point later. Aligns with the Security guide's note that unpredictable IDs are not
> authorization.

🟢 `[nit]` **DB-row → typed casts** (`row.kind as ArtifactKind`) trust the column CHECK
constraints rather than re-validating at the read boundary.
> Accepted for the pilot: the CHECK constraints are the enforcement point and writes
> are the only way in. Flagged for a future typed row-decoder if reads widen.

## Mutation design (supersede / soft-delete)

- Soft-delete preserves row + R2 bytes (audit/retention); only status flips.
  Idempotent — re-deleting reports `changed: false`, no second audit event.
- Supersede validates same-deal, same-kind, neither-deleted, not-self; the
  `supersedes_id` link is recorded once and re-runs are no-ops.
- Both emit audit events (`artifact_deleted`, `artifact_superseded`) satisfying the
  P0 acceptance criterion for supersession/deletion audit.

## Verification

`npm run lint` ✓ · `npx tsc --noEmit` ✓ · `npm run test:engine` ✓ ·
`npm run test:registry` ✓ (kinds, mislabel fallback, unsupported preservation,
dedupe, and mutation guards).

## Decision

✅ **Approve.** Both `important` findings resolved in-branch. Remaining `nit` is
tracked, not blocking.
