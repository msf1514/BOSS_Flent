# Code review — two-lane ingestion architecture

Reviewed with `code-review-skill` against the TypeScript, architecture-review and
Universal-Quality guides, plus the brief's reproducibility and no-invention rules.

## Summary

Adds the ingestion layer: a shared 13-column contract, a Lane 1 source-adapter
interface + normaliser + bias-resistant assembler, a working deterministic mock
portal adapter, and a Lane 2 deal-terms stub. No engine changes.

## Strengths

- 🌟 `[praise]` The seam is proven, not asserted: `test-ingestion.mjs` runs mock
  adapter output through the engine's own parser and `runEvidenceEngine`, and the
  engine catches the adapter-produced bait row — demonstrating a scrape is
  indistinguishable from an upload.
- 🌟 `[praise]` Bias resistance is structural: the diversity floor + the engine's
  existing confidence penalty mean a single-source pull self-reports as
  low-confidence. No new anti-bias heuristic to maintain.
- 🌟 `[praise]` The capture/calculate wall is preserved across lanes — maintenance
  and terms are absent from the Lane 1 contract by construction, so a scraper
  cannot invent them onto a listing.

## Findings and resolutions

🟡 `[important]` **Determinism is a brief requirement.** A scraper that returns
different rows each run breaks reproducibility.
> Resolved: the mock uses a seeded PRNG keyed on the query; the test asserts
> byte-identical output for a fixed query. A real adapter would need a captured,
> hashed snapshot to preserve this — noted in the architecture doc.

🟡 `[important]` **No-invention rule.** The mock must not fabricate data that
poses as the graded sample.
> Resolved: the mock is clearly synthetic, uses `Mock*` source names, and does
> NOT reproduce the packet's planted rows. It proves the pipeline shape only.

🟢 `[nit]` **Node strip-only mode** rejects constructor parameter properties and
`@/` path aliases in files the test imports directly.
> Resolved: explicit field declaration; relative `.ts` imports within the
> ingestion module so the same files run under both tsc and node.

## Architecture review

- Separation of concerns: adapters (per-source) / normaliser (one gate) /
  assembler (diversity) / engine (unchanged) — clean, single-responsibility.
- Extensibility: adding a portal is adding a `SourceAdapter`; the real-scraper
  path is a drop-in `fetch` implementation with zero downstream change.
- The two lanes never share a number; they meet only at the human decision layer.

## Verification

`lint` ✓ · `tsc --noEmit` ✓ · `test:engine` ✓ · `test:signals` ✓ ·
`test:registry` ✓ · `test:ingestion` ✓ (contract match, determinism,
engine-indistinguishability, junk caught, diversity floor, Lane 2 stub).

## Decision

✅ **Approve.** Both `important` findings resolved in-branch; design is complete
and honest with build depth focused on Lane 1.
