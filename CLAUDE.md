# CLAUDE.md — project memory for Claude Code

Read this first, every session. It captures not just *what* this project is but
*why* it's built the way it is — the boundaries and judgment calls that aren't
obvious from the code alone. Honour them; they were reached deliberately.

---

## 1. What this is

A take-home for **Flent** (an FDE role). The product is **BOSS**, a real-estate
acquisition tool. The brief asks you to pick ONE of three problems and prove the
riskiest part end-to-end — not build all of BOSS.

**We chose Problem 1: a trust layer for market listings.**

The one-line thesis: *scraped rental listings lie (duplicates, bait, stale,
aspirational, mislabelled), and on a dashboard a bad market rate looks exactly as
precise as a good one.* Problem 1 turns a noisy CSV of comparable listings into a
**trustworthy market-rent benchmark with an explicit confidence level**, where
every listing's keep/drop decision is visible with its reason.

The riskiest assumption we proved: **honest cleaning changes the answer's
trustworthiness, not just its cosmetics.** On the real packet the naive pipeline
reports HIGH confidence while silently double-counting cross-posts and leaving
bait in the sample; the trust layer fixes that.

---

## 2. Boundaries — do NOT cross these (they define the product)

These are the calls that keep the submission honest. Violating them is the fast
way to make a reviewer stop reading.

- **Problem 1 outputs a market rate + confidence. It does NOT decide.** No
  ACQUIRE/NEGOTIATE/HOLD/PASS verdict, no deal quality score, no radar chart.
  That is Problem 3 (the `/decision` preview shows it, clearly labelled, built
  from real packet data, *reading* the benchmark — never recomputing it).
- **Asking rent ≠ achieved rent.** Listings show *asking* prices. Achieved rent /
  signed leases are transaction outcomes = **Problem 2** (the `/calibration`
  preview). Never build features that claim to know achieved rent. The engine
  hard-codes `achievableBaseRentConfidence: 'LOW'` on purpose.
- **Capture ≠ calculate.** The evidence registry captures everything; only the
  listing CSV feeds the market median. Commercial context (landlord ask,
  maintenance, deposit, capex) is retained in the data model but is NOT collected
  in the Problem 1 intake and never enters the median — comparing the ask to the
  market is a Problem 3 concern.
- **Never invent evidence.** Missing stays missing (shown as blank, never scored
  as zero). No synthetic data that poses as real; no fabricated numbers. This is
  the brief's #1 rule.
- **Two data lanes, one contract.** Market comparables (public, scraped → the
  13-col CSV) and deal terms (private, negotiated → the deal record) are separate
  origins with separate failure modes. They meet only at the human decision
  layer, never in a shared number. See `docs/INGESTION_ARCHITECTURE.md`.
- **No live scraping in the graded path.** The brief says "start with the CSV" and
  requires reproducibility. Scraping is designed (Lane 1 mock adapter proves the
  seam) but a real crawler is a drop-in `fetch()` for later — it must not feed the
  reproducible run or fabricate data to match the planted cases.

## 3. UX / product principles (reached with the stakeholder, hold them)

- **A card is clickable only if it has real detail behind a summary.** Then the
  whole card opens a modal showing the exact listings. Do NOT add modals to cards
  that are already complete info (e.g. "What this estimate can't tell you",
  "Evidence history") or already actionable (Version control, Next steps) — an
  empty modal is fake substance.
- **Resolving distrust never has a naked "trust it anyway" button.** A flagged
  listing is resolved only by: a documented human override (with reason), raising
  an evidence task to verify at source, or re-uploading a corrected source. See
  `RemediationGuide` in `trust-vocabulary.tsx`.
- **Colour psychology:** green = trustworthy/HIGH, amber = caution/MEDIUM, orange
  = LOW, red = INSUFFICIENT/bait. Required-but-empty fields cue amber; filled cue
  teal.
- **Every asserted number is traceable** — confidence factors, "what we caught",
  the funnel, the rate all reveal the specific listings behind them.
- **No decorative filler.** If a card/section isn't adding value for a *market
  review*, cut it or make it real (we removed "Decision evidence coverage" and the
  static cross-functional RACI for this reason).
- **Collaboration is concrete:** evidence tasks with owners that block completion,
  all attributed in history — not a generic "people collaborate" blurb.
- Copy is **user-first**, plain, no developer meta ("audit layer", "raw bytes"),
  no jargon where a plain word works. Keep the technical figures (median, IQR,
  leave-one-out) — a reviewer needs them.

---

## 4. Architecture map

**Engine (deterministic, pure).**
- `lib/evidence-engine.ts` — the core. Parses CSV, validates, runs staged
  baselines **B0 (all valid) → B1 (matches the home) → B2 (trusted)**, computes
  the median + confidence tier. `askingEvidenceConfidence`: HIGH (≥8 comps, ≥3
  portals, leave-one-out ≤2.5%), MEDIUM (≥5, ≥2, ≤5%), LOW (≥3, ≤10%), else
  INSUFFICIENT.
- `lib/listing-signals.ts` — pure detectors: fuzzy cross-post duplicate clustering
  (union-find on same config + area + identical deposit), bait/aspirational price
  signals, mislabel (area-per-bhk + subject-disguise). Documented thresholds.
- `lib/market-review.ts`, `lib/run-config.ts`, `lib/source-annotations.ts`,
  `lib/source-inspection.ts`, `lib/workflow.ts` — review assessment, config
  validation (commercial fields are `optionalInteger`, never block a run),
  annotations, inspection, workflow state.

**Capture layer (P0).**
- `lib/evidence-registry.ts` + `lib/evidence-classification.ts` — the
  `evidence_artifacts` registry: hash-deduped, provenance-stamped ingest of any
  case-packet artifact, inventory, supersede/soft-delete, audit. Captures only —
  never calculates.

**Ingestion (two lanes).**
- `lib/ingestion/contract.ts` — the 13-col listings gate (single schema all
  producers pass through). `source-adapter.ts` — Lane 1 interface + normaliser +
  source-diversity floor (single-source scrapes self-report low confidence).
  `mock-portal-adapter.ts` — deterministic working mock proving the seam.
  `deal-terms-adapter.ts` — Lane 2, designed + stubbed (TermsRecord with per-field
  evidence status).

**Storage / API.**
- `lib/storage.ts` — D1 + R2. `ensureSchema()` creates tables **statement by
  statement** (not one batch) so a fresh D1 self-heals. `persistRun` writes R2
  then D1 with rollback. Evidence tasks are **derived from what a run found**
  (verify N suspicious prices, widen the set on LOW/INSUFFICIENT, standing
  maintenance caveat) — NOT hardcoded, and NO achieved-rent task.
- `lib/auth.ts` — `actorFromRequest` + `authorizeDealAccess` (the single auth
  seam; currently auth-only, real RBAC is deferred — Open Decision #2). The
  deployed demo falls back to a shared "Demo reviewer" so reviewers can use the
  live URL without a login wall.
- `app/api/runs|actions|intake|evidence/route.ts` — endpoints.

**UI.**
- `app/page.tsx` — three views: DealsList (home) → open run / new intake → run.
  "Add new evidence" from a run **prefills that deal's config**.
- `app/_components/deals-list.tsx` — lists ALL runs (complete + in-progress),
  clickable to reopen.
- `app/_components/run-intake.tsx` — upload + config. Two groups: required "home"
  facts (society/BHK/area/furnishing) with amber/teal cues, and pre-filled
  "matching rules & label". `AnalysisPreloader` narrates the real trust stages
  (min ~3s so they're visible). Accepts optional `initialConfig` for prefill.
- `app/_components/market-workbench.tsx` — the deal view. Overview (orientation
  accordion, MarketAnswer, ConfidenceDerivation, EvidenceFunnel, TrustSignals,
  metric tiles, posture, NextSteps, PendingByOwner), plus Market/Occupancy/
  Economics/Quality/Closing tabs. The non-market tabs are honest ScopeNotes, not
  fake dimensions.
- `app/_components/problem-one-overview.tsx` — the overview cards (hero rate,
  confidence, tapering funnel, trust signals, next steps, scope notes).
- `app/_components/trust-vocabulary.tsx` — reason→label/meaning/colour/icon map,
  ReasonChips, ConfidenceDerivation, RemediationGuide, EvidenceModal.
- `/calibration` (Problem 2 preview) and `/decision` (Problem 3 preview) — static,
  built from real packet data (`outcomes.csv`, `boss-assessment.md`), clearly
  labelled illustrative. The prior assessment is shown to explain, never fed back
  as an input (circularity guard).

---

## 5. Conventions — keep these green, always

Run before every commit; all must pass:

```
npm run lint            # oxlint — 0 warnings, 0 errors
npx tsc --noEmit        # typecheck
npm run test:engine     # engine contract on the real packet
npm run test:signals    # pure detectors
npm run test:registry   # evidence registry
npm run test:ingestion  # ingestion seam
```

- **Node type-stripping quirk:** test scripts run under `node
  --experimental-strip-types`. Avoid constructor parameter properties
  (`constructor(readonly x)`) and use relative `.ts` imports inside modules the
  tests import directly (not the `@/` alias) — those break strip-only mode.
- **Determinism:** engine + signals must be deterministic (same inputs → same
  output). Tests assert this. Don't introduce randomness or wall-clock into the
  engine.
- **Reviews:** significant changes get a short review note in `docs/reviews/`
  using the vendored code-review skill's severity labels (praise / nit /
  suggestion / important). Findings that aren't fixed get promoted to an open
  item, not silently dropped.
- Design tokens live in `app/globals.css` (Plus Jakarta Sans, ink/teal/mint, warm
  canvas). Don't change brand tokens; only copy/layout for user-friendliness.

---

## 6. Deploy (Cloudflare Workers, not Pages)

Build = `vinext build` (Vite). Deploy = `npx wrangler deploy`. Needs **D1**
(`bossengine_d1`, id in `vite.config.ts`) and **R2** (`bossengine`) bound as
`DB` and `EVIDENCE`. `ensureSchema()` self-creates tables on first hit. A past
deploy failure ("malformed response / 401 on asset upload") was a transient
Cloudflare-side / token issue — retry or reconnect the Git integration; it was
not a code problem.

---

## 7. Status: built vs. deferred

**Built:** P0 registry · P1 trust engine (fuzzy dedup, bait/aspirational/mislabel,
confidence tiers incl. INSUFFICIENT, full row override + guided remediation) · the
whole Problem 1 UX (orientation, traceable numbers, clickable cards, tapering
funnel, deals list + persistence, prefill, preloader) · ingestion architecture
(Lane 1 mock + Lane 2 stub) · static P2/P3 previews · sample datasets landing at
HIGH/MEDIUM/LOW honestly.

**Deliberately deferred (correct scope cuts, in the plan not the build):**
comment→claim routing engine, photo/quality ingestion, full deal-terms workflow,
real Slack/portal connectors, Problem 2 calibration model, Problem 3 decision
engine.

**Biggest remaining graded deliverables:** the **4-page approach note** and the
**proof-of-work walkthrough** — these are what the reviewer scores, and they do
NOT exist yet. Prioritise them.

**Open decisions / smaller open items:** tenancy/RBAC (auth-only today), the
evidence-task assignment confirmation loop, plus items tracked in
`docs/reviews/PROBLEM1_UX_OPEN_ISSUES.md` and `docs/EXECUTION_PLAN.md`.

---

## 8. Where to read more

- `docs/EXECUTION_PLAN.md` — parent issue + ordered sub-issues + P2/P3 approach.
- `docs/INGESTION_ARCHITECTURE.md` — the two-lane design.
- `docs/reviews/*` — per-change review records and the UX open-issues audit.
- `docs/CASE_PACKET_COVERAGE_AND_NEXT_WORK.md` — the original capture/calculate
  analysis.

When in doubt, prefer the honest, narrower answer over the impressive-looking one.
That instinct is the whole point of this submission.
