# Execution plan — Problem 1: a trust layer for market listings

Status: **1 September 2026.** Written to drop into Linear. Ordered on purpose:
each sub-issue states its outcome, scope boundary, dependencies, whether its data
is real or mocked, and how we'd prove it works. A flat feature list is avoided by
design.

---

## How the pieces fit (so the plan reads as one story)

The brief's first BOSS job is **Capture** — "turn a messy deal into structured
evidence; every fact keeps its source and age." Two layers deliver that and they
are one system, not two:

1. **The evidence registry (built, P0).** Preserves every case-packet artifact
   with an immutable hash, source, actor and timestamp; dedupes identical bytes;
   exposes an inventory; audits ingest / supersession / deletion. This is the
   capture substrate. For Problem 1 it is what lets a human inspect the market
   evidence "listing by listing" with provenance intact. For Problems 2 and 3 it
   is the spine of the plan (outcomes and prior assessments are just more
   artifact kinds).

2. **The market-trust engine (built + hardened).** Consumes only the one artifact
   it is allowed to calculate from — the listing CSV — and turns 86 noisy rows
   into a defensible median with an explicit confidence tier, an inspectable
   per-row reason, and an honest "insufficient evidence" state. Photos, comments,
   outcomes and the prior assessment are captured by the registry but never enter
   this median.

The riskiest assumption we proved end-to-end: **that honest cleaning changes the
answer's trustworthiness, not just its cosmetics.** On the real packet the naive
pipeline reports HIGH confidence at ₹58,250 while silently double-counting
cross-posts and leaving bait in the sample. After the trust layer, the same data
yields a defensible sample with every excluded row carrying a reason a human can
overrule.

---

## PARENT ISSUE — Market listings become trustable evidence

**User outcome.** A Supply/Market-Ops reviewer uploads a raw listing pull for a
deal and gets back a market-rate estimate with an explicit confidence level, a
row-by-row audit of what was kept, collapsed or excluded and why, and the ability
to disagree with any single decision. When the surviving evidence is too thin or
contradictory, the system says so instead of manufacturing a number.

**v1 includes.**
- CSV upload with a visible 13-column contract and runtime schema/row validation.
- Staged baselines (raw → same-config → trusted) so the reviewer sees what
  cleaning did to the number.
- Cross-post de-duplication, bait/aspirational price flags, mislabel flags — each
  as a named, inspectable reason.
- An explicit confidence tier including INSUFFICIENT.
- Row-level human override with a required reason, recorded against the prior
  engine state.
- Immutable, versioned runs with an audit trail; one frozen market-evidence
  version on completion.

**v1 explicitly excludes.**
- Live portal scraping (upstream adapter later; same artifact contract).
- Demand, economics, property and decision models (Problems 2 and 3).
- Any use of photos, comments, outcomes or the prior assessment inside the median.

**Must be true before release.**
- Deterministic: identical inputs produce an identical run.
- No invented values: missing stays missing; every flag traces to a rule.
- A reviewer can override any row, and the override is auditable.
- On a deliberately thin/contradictory input, confidence returns INSUFFICIENT.

**First metric to watch.** Share of runs where the reviewer accepts the engine's
kept/excluded set without override (a proxy for trust), tracked alongside the
median shift caused by overrides.

---

## SUB-ISSUES (in order)

### 1. Raw ingest + schema/row validation `[real data]`
- **Outcome.** A raw CSV is preserved and validated; bad structure returns
  actionable issues, not a crash.
- **Boundary.** Validation and preservation only — no scoring.
- **Depends on.** Registry (done).
- **Proof.** The 86-row packet validates; a malformed header set is rejected with
  a named issue; an impossible date is caught.

### 2. Staged baselines B0 → B1 → B2 `[real data]`
- **Outcome.** Reviewer sees raw median, same-configuration median, and trusted
  median side by side, with counts, so "30 comps became 4" is visible.
- **Boundary.** Deterministic filtering by config (bhk, area band, furnishing,
  society family, staleness). No price judgement yet.
- **Depends on.** #1.
- **Proof.** On the packet, B0=84 → B1=9 → B2=8 with the drop attributable to
  named reasons on each excluded row.

### 3. Fuzzy cross-post de-duplication `[real data — built]`
- **Outcome.** The same flat re-posted on several portals counts once.
- **Boundary.** Same configuration + built-up area within tolerance + identical
  deposit → one representative (owner/freshest wins). Rent may differ.
- **Depends on.** #2.
- **Proof.** CP-0071/CP-0075 collapse with `cross_post_duplicate`; distinct-unit
  rows never merge (unit test in `test-signals.mjs`).

### 4. Price-plausibility + mislabel flags `[real data — built]`
- **Outcome.** Bait, aspirational and mislabelled rows are flagged for a human,
  not silently included or silently dropped.
- **Boundary.** Flags attach reasons and route B1 rows to review; they never move
  the median by themselves.
- **Depends on.** #2.
- **Proof.** CP-0082 bait, CP-0083 aspirational, CP-0081 mislabel, CP-0085
  implausible-area each carry the right reason (engine contract asserts it).

### 5. Explicit confidence tier incl. INSUFFICIENT `[real + synthetic]`
- **Outcome.** Every estimate ships with HIGH/MEDIUM/LOW/INSUFFICIENT derived
  from sample size, portal diversity and leave-one-out stability.
- **Boundary.** Tier thresholds are chosen, documented and testable; not a
  production hurdle.
- **Depends on.** #3, #4.
- **Proof.** The packet yields a defensible tier; a synthetic 3-row thin input
  returns INSUFFICIENT — this is the required failure case.

### 6. Row-level human override `[real data — built]`
- **Outcome.** A reviewer includes/excludes/defers any row with a required reason;
  the prior engine state is recorded.
- **Boundary.** Overrides re-run the median deterministically; completed runs stay
  immutable (a new version is created).
- **Depends on.** #2–#5.
- **Proof.** Re-including an auto-excluded row changes B2 and is visible in the
  audit trail with `priorEngineState`.

### 7. Re-cluster duplicates across the human-included set `[real data — gap]`
- **Outcome.** After overrides, cross-post twins that were both excluded and then
  re-included cannot double-count.
- **Boundary.** Re-run clustering over the post-override include set only.
- **Depends on.** #3, #6.
- **Proof.** Constructed case: two excluded twins, both re-included, collapse to
  one in the recomputed median. (This is the `important` finding from the
  engine review, promoted to a tracked task.)

### 8. Frozen market-evidence handoff `[real data — built]`
- **Outcome.** Completing Problem 1 freezes one reviewed market-evidence version
  with its confidence, caveats and open evidence tasks, ready for the wider deal.
- **Boundary.** Freezes market evidence only; does not authorise acquisition.
- **Depends on.** #1–#7.
- **Proof.** A completed run is immutable and reproducible from preserved source;
  re-analysis creates a versioned child, never overwrites the parent.

---

## What we deliberately did NOT build (and why)

- **All of BOSS.** The brief says pick one problem. Problem 1 is the end-to-end
  proof; Problems 2 and 3 are approach + plan, not code.
- **Comment/photo/outcome ingestion into any number.** Captured by the registry,
  never calculated from. Letting a demand comment or a photo move the market
  median is the exact "opinions quietly become numbers" failure the brief warns
  against.
- **A blended property score.** The brief and the prior assessment both reject a
  single number that hides which fact decided the deal.

## Approach notes for Problems 2 and 3 (not built)

- **Problem 2 (feedback loop).** `outcomes.csv` is another registry artifact.
  Join acquisition-time predictions to day-90 actuals, but honour censoring:
  `outcome_status` and `observation_date` gate comparability; blank is not zero;
  still-filling and cancelled records are excluded from error stats, not treated
  as misses. Report where estimates run high vs low per micromarket, and where
  the comparison has no clean ground truth.
- **Problem 3 (decision page).** Assemble drivers, confirmed vs assumed inputs,
  disagreements (from the comment thread, routed by domain), missing evidence and
  flip conditions into one inspectable view. The prior `boss-assessment.md` is a
  reference to explain, never an engine input — feeding it back would be circular.
