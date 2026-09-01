# Problem 1 UX — open-issues audit

An experienced pass over the actual UI against the question a user really asks:
**"why should I trust this number?"** Grouped by theme; status marked.

## Trust visibility

1. **Row-level reason hidden** — the table showed a state badge + Yes/No but not
   *why* (bait / duplicate / stale). The brief's core ask is "preserve the reason
   behind every decision"; the product preserved it but hid it behind a click.
   **DONE** — inline `ReasonChips` (colour + icon + label) now render in every
   table row and, with full meanings, in the detail panel.
2. **Confidence derivation not shown** — the HIGH/MEDIUM/LOW tier drove everything
   but never showed *why*. **DONE** — `ConfidenceDerivation` shows the three
   checks (sample size, source diversity, stability) that produce the tier.
3. **"Analysis completed" reads done even when confidence is INSUFFICIENT** —
   completion ≠ trustworthy. **OPEN** — the stepper should reflect evidence
   strength, not just that the engine ran.

## Redundancy & naming

4. **"Comparable review" name collision** (stepper step + sub-tab + card title).
   **DONE** — renamed to distinct plain terms: stepper "Flagged rows resolved",
   tab "Needs your call · N", card "Listings that need your call".
5. **Jargon** — "comparable review", "policy-matched", "material rows". Partly
   **DONE** (review→needs-your-call); "policy-matched"/"broad reference set" in
   the funnel stages **OPEN**.
6. **Two levels of navigation** (5-step stepper + 5 sub-tabs) with overlapping
   vocabulary. **OPEN** — candidate to flatten.
7. **Overview vs Market-tab duplication** — the new overview hero (answer +
   funnel) overlaps the Market→Summary tab's median + "how evidence was
   narrowed". **OPEN** — reconcile so each surface has one job.

## Two-source clarity (CSV = comparables vs form = deal terms)

8. **No visual cue that the two inputs have different origins.** **DONE** — a
   `TwoSourceExplainer` on the intake plus provenance badges on each step
   ("Market comparables · sets the rate" vs "This home's facts · from the deal
   record") make the two-lane model explicit.
9. **Intake "N required fields remain"** doesn't separate subject facts from
   commercial context. Partly **DONE** — commercial context is a labelled group
   ("Captured, not used to calculate the median"); a per-group required count is
   still **OPEN**.

## Orientation

10. **No sticky header** — user loses "where am I / where next". **DONE** — the
    deal header is now sticky with a blurred backdrop.
11. **Funnel visual** regressed from the earlier version. **OPEN.**

## Redundancy & naming (update)

7. **Overview vs Market-tab duplication.** Partly **DONE** — removed the
   duplicated median tile from the Overview (it now shows once, in the hero).
   The Market→Summary staged card is kept because it adds the *estimate at each
   stage*, which the Overview funnel does not. Cross-tab overlap of the tiles
   remains **OPEN** but is low-severity (not same-screen).

## Priority for the next tranches

Ranked with the user: (1) trust story — largely landed; (2) two-source cues
(#8, #9); (3) naming/redundancy + sticky header (#6, #7, #10); (4) funnel polish
(#11). Item #3 (misleading completion) folds into the trust work.
