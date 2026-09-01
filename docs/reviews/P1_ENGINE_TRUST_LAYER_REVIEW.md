# Code review — Problem 1 listing-trust hardening

Reviewed with `code-review-skill`, four-phase, against the TypeScript and
Universal-Quality guides **and** the take-home brief's own product guardrails.

## Summary

Closes the three real gaps in the market engine against the actual 86-row
packet: fuzzy cross-post de-duplication, directional bait/aspirational price
flags, configuration-mislabel flags, and full row-level human override. New pure
module `lib/listing-signals.ts`; engine wired to it; override guard widened.

## Baseline that motivated the change (measured, not assumed)

Running the *previous* engine on the real `listings.csv`:

- Duplicate groups found: **0**. Rows collapsed: **0**.
- Result: **HIGH** confidence, ₹58,250 — on data the packet and comment thread
  both say is full of cross-posts, bait and stale rows.

That is exactly the brief's failure mode: "a bad market rate looks just as
precise on a dashboard as a good one." This baseline is the submission's failure
case.

## After

- Cross-posts collapsed (CP-0071, CP-0075) with reason `cross_post_duplicate`;
  B1 11→9, B2 10→8. Estimate unchanged because the collapsed rows sat near the
  median — the win is a **defensible sample**, not a moved number.
- CP-0082 (₹12k) → `suspected_bait_price`, pulled out of the median.
- CP-0083 (₹185k) → `suspected_aspirational_ask` (previously vanished silently
  as a furnishing mismatch).
- CP-0081 (3BHK that is really this 2BHK) → `suspected_mislabel_configuration`.
- CP-0085 (1BHK @ 2100 sqft) → `implausible_area_for_bhk`.

Each of the brief's five named junk types now yields a specific, inspectable
reason.

## Against the brief's guardrails

- 🌟 Deterministic arithmetic/rules (guardrail 5): union-find + pure predicates,
  fully sorted outputs, tie-broken by listing id.
- 🌟 Facts/estimates/judgment stay separate (guardrail 2): detectors only attach
  reasons; they never delete a row or move a number by themselves.
- 🌟 Show disagreement, don't average it (guardrail 7): a reviewer can now
  re-include or exclude **any** row with a required reason, and the prior engine
  state is recorded on every override.
- 🌟 Thresholds chosen and explained (brief §06): every constant is named with a
  documented rationale in `listing-signals.ts`.

## Findings

🟡 `[important]` **Dedup runs on the B1-eligible set only.** Two cross-post twins
that are both excluded for another reason (e.g. both area-out-of-band) are not
clustered. Harmless for the median (excluded rows do not count), but if a human
later re-includes both via override, they could double-count.
> Not fixed here to keep the change bounded. Tracked as a sub-issue: re-run
> duplicate clustering across the human-included set after overrides are applied.

🟢 `[nit]` **Bait centre self-inclusion.** The robust centre (B1 median) is
computed with the bait row still present. Because the median is positional, a
single low outlier does not move it materially — this is precisely why median,
not mean, is used. Left as-is; documented.

## Verification

`npm run lint` ✓ · `npx tsc --noEmit` ✓ · `npm run test:engine` ✓ (updated
contract + new detector assertions) · `npm run test:signals` ✓ (pure detectors)
· `npm run test:registry` ✓.

## Decision

✅ **Approve.** The one `important` finding is a bounded, documented edge case
promoted to the execution plan rather than a defect in this change.
