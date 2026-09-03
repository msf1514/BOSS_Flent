# Execution plan · a trust layer for market listings (Problem 1)

Prepared by Sufiyan for Flent.

This is the plan I would run if Flent approved the approach. It is written the way
I would put it into Linear: one parent outcome, then a small number of pieces of
work in the order I would ship them. Each piece names what it delivers, what it
deliberately leaves out, what it depends on, whether it runs on real or mocked
data, and how I would prove it works. The order is the point. A flat list of
features would say very little about what to ship first and what that first
release teaches.

---

## Why this matters to Flent

Flent carries the vacancy risk on every home it signs. The market rate Flent anchors
to is a median of nearby listings, and that median is quietly built on evidence
that is often untrue: duplicates, stale inventory, bait prices and optimistic
asks. Once the junk is removed, an area that looked like thirty comparables can
hold four, and at that sample size one bad listing moves the estimate by thousands
of rupees. The dangerous part is that a bad market rate looks exactly as precise on
a dashboard as a good one.

The outcome I am delivering is not a prettier number. It is a market rate a reviewer
can **defend line by line**, with an explicit confidence level, and an honest
"not enough evidence" when that is the truth.

---

## Parent · Market listings become trustable evidence

**User outcome.** A Supply or Market-Ops reviewer uploads a raw listing pull for a
home and gets back a market-rate estimate with an explicit confidence level, a
row-by-row account of what was kept, collapsed or excluded and why, and the ability
to disagree with any single decision. When the surviving evidence is too thin or
contradictory, the system says so instead of manufacturing a number.

**What v1 includes.**
- CSV upload with a visible 13-column contract and runtime schema and row validation.
- Staged baselines, from every valid listing (B0), to the ones that match this home
  (B1), to the ones trusted for the rate (B2), so the reviewer can see what
  cleaning did to the number.
- Cross-post de-duplication, bait and aspirational price flags, and mislabel flags,
  each as a named, inspectable reason.
- An explicit confidence tier that includes INSUFFICIENT.
- Row-level human override with a required reason, recorded against the prior
  engine state.
- Immutable, versioned runs with an audit trail, and one frozen market-evidence
  version on completion.

**What v1 explicitly excludes.**
- The acquisition verdict and any blended deal score. That is Problem 3.
- Achieved or signed rent. Listings are asking prices. That is Problem 2.
- Any use of photos, comments, outcomes or the prior assessment inside the median.
- Live portal scraping in the graded path. The seam is designed so a real crawler
  is a drop-in later, but the reviewed run stays reproducible.

**What must be true before release.**
- Deterministic. The same inputs produce an identical run.
- No invented values. Missing stays missing, and every flag traces to a rule.
- A reviewer can override any row, and the override is auditable.
- On a deliberately thin or contradictory pull, the confidence tier returns
  INSUFFICIENT rather than a confident guess.

**The first metric I would watch.** The **share of runs where the reviewer accepts the
engine's kept and excluded set without an override**, as a proxy for trust, tracked
next to the **median shift caused by overrides**. If reviewers constantly overturn
the engine, the rules are wrong, not the reviewers. This is deliberately a product-
trust metric. The separate question of whether the trust layer produces a more
accurate estimate than a simpler baseline is an estimation-quality benchmark, and
I keep the two apart on purpose.

A note on judgement. A more complex method should not win because it improves a
number by a negligible amount. The trust layer earns its place only if the gain in
defensibility is worth the added moving parts, and there are real cases where a
simpler baseline is enough. The plan is built to expose that, not to hide it.

---

## The work, in the order I would ship it

### 1. Raw ingest and validation
- **Outcome.** A raw CSV is preserved and validated. Bad structure returns
  actionable issues, not a crash.
- **In scope, not in scope.** Preservation and validation only. No scoring yet.
- **Depends on.** The evidence registry, which is already built.
- **Data.** Real. The supplied case packet.
- **How I prove it.** The 86-row packet validates. A malformed header set is
  rejected with a named issue. An impossible date is caught.

### 2. Staged baselines, from all valid to trusted
- **Outcome.** The reviewer sees the raw median, the same-home median and the
  trusted median side by side, with counts, so "thirty comparables became four" is
  visible rather than hidden.
- **In scope, not in scope.** Deterministic filtering by config: BHK, area band,
  furnishing, society family and staleness. No price judgement yet.
- **Depends on.** Piece 1.
- **Data.** Real.
- **How I prove it.** On the packet the set narrows from 84 valid, to 9 that match
  the home, to 8 trusted, and every drop is attributable to a named reason on the
  excluded row.

### 3. Cross-post de-duplication
- **Outcome.** The same flat re-posted on several portals counts once, so reposts
  cannot inflate the sample.
- **In scope, not in scope.** Same configuration, built-up area within tolerance and
  identical deposit collapse to one representative, with the owner or freshest
  listing kept. The asking rent may differ between the copies.
- **Depends on.** Piece 2.
- **Data.** Real, and built.
- **How I prove it.** The two known cross-posts collapse with a duplicate reason,
  and genuinely distinct units never merge, asserted in the signals tests.

### 4. Price-plausibility and mislabel flags
- **Outcome.** Bait, aspirational and mislabelled rows are flagged for a human,
  neither silently included nor silently dropped.
- **In scope, not in scope.** Flags attach a reason and route the row to review.
  They never move the median by themselves.
- **Depends on.** Piece 2.
- **Data.** Real, and built.
- **How I prove it.** The packet's bait, aspirational, mislabelled-configuration
  and impossible-area rows each carry the correct reason, asserted in the engine
  contract.

### 5. An explicit confidence tier, including INSUFFICIENT
- **Outcome.** Every estimate ships with HIGH, MEDIUM, LOW or INSUFFICIENT, derived
  from sample size, source diversity and leave-one-out stability.
- **In scope, not in scope.** The tier thresholds are chosen, documented and
  testable. They are sensible operating numbers, not Flent's real internal cutoffs.
- **Depends on.** Pieces 3 and 4.
- **Data.** Real for the packet, plus a small synthetic thin case.
- **How I prove it.** The packet yields a defensible tier, and a deliberately thin
  three-row input returns INSUFFICIENT. That failure case is required, not optional.

### 6. Row-level human override
- **Outcome.** A reviewer includes, excludes or defers any row with a required
  reason, and the prior engine state is recorded, so a disagreement is a traceable
  judgement rather than a silent edit.
- **In scope, not in scope.** Overrides re-run the median deterministically.
  Completed runs stay immutable, and applying judgements creates a new version.
- **Depends on.** Pieces 2 through 5.
- **Data.** Real, and built.
- **How I prove it.** Re-including an auto-excluded row changes the trusted set and
  is visible in the audit trail with the prior state attached.

### 7. Re-cluster duplicates across the human-included set
- **Outcome.** After overrides, two cross-post copies that were both excluded and
  then both re-included cannot double-count.
- **In scope, not in scope.** Re-run duplicate clustering over the post-override
  include set only.
- **Depends on.** Pieces 3 and 6.
- **Data.** Real, with a constructed case. This is the one honest gap in the current
  build, carried here as a tracked piece of work rather than quietly dropped.
- **How I prove it.** Two excluded twins, both re-included, collapse to one in the
  recomputed median.

### 8. Frozen market-evidence handoff
- **Outcome.** Completing Problem 1 freezes one reviewed market-evidence version,
  with its confidence, caveats and open evidence tasks, ready for the wider deal.
- **In scope, not in scope.** Freezes market evidence only. It does not authorise an
  acquisition.
- **Depends on.** Pieces 1 through 7.
- **Data.** Real, and built.
- **How I prove it.** A completed run is immutable and reproducible from the
  preserved source, and re-analysis creates a versioned child rather than
  overwriting the parent.

---

## The next increment · live ingestion replaces the CSV upload

v1 starts from a hand-uploaded CSV on purpose, because the brief asks me to start
with the provided listings and the reviewed run has to be reproducible. The natural
next increment removes the manual upload: real listing data is pulled live and
enters through the exact same gate. The whole point of the two-lane ingestion
design is that this is a drop-in, not a rebuild.

- **Outcome.** The reviewer no longer hunts for a CSV. A real portal adapter pulls
  comparable listings on demand from the sources (MagicBricks, NoBroker, Housing
  and similar) and produces the same 13-column contract, so everything downstream
  is unchanged.
- **In scope, not in scope.** One real source adapter that fetches from a live
  source (for example a headless fetch or a hosted crawl step) and a captured,
  hashed snapshot per run so the result stays reproducible. Not in scope for this
  increment: a general multi-portal crawler farm, and letting a live pull feed a
  run that must be reproducible without its snapshot.
- **Depends on.** Pieces 1 through 8, and the ingestion seam that is already
  designed. A mock adapter already proves it: the engine cannot tell a scrape from
  an upload, because both arrive as the same contract.
- **Data.** Real and live, with a captured snapshot stored alongside the run.
- **How I prove it.** A live pull for a real area produces a valid 13-column set,
  runs through the same engine, and tiers honestly. Re-running the captured snapshot
  reproduces the run. Because the confidence tier already penalises thin source
  diversity, a single-portal pull self-reports as lower confidence rather than a
  falsely clean number, so bias resistance is structural, not bolted on.

---

## Where this goes next

Problem 1 is the first link in a chain, not the whole system. The frozen packet is
the object the rest of BOSS consumes.

- **Problem 3, the decision page.** Reads the frozen benchmark and the deal terms,
  routes each team comment to the domain that owns it, separates confirmed from
  assumed, and shows what would flip the call. A named human signs. It never
  re-derives the rate.
- **Problem 2, the feedback loop.** Once the real day-90 outcome is known, it
  compares the prediction to the actual, honours censoring for cases that have no
  clean ground truth, and reports where estimates run high or low. That lesson feeds
  a better Problem 1 next time.

The full approach for Problems 2 and 3 is in the approach note. The prior
assessment and past outcomes are shown there to explain the model, never fed back
as an engine input, or the system would reproduce its own answer.
