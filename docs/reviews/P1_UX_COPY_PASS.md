# Problem 1 UX & copy pass — decisions

Scope held tight to the instruction: **copy and position for user-friendliness
only.** No brand tokens, colours, type, spacing, or layout structure changed. No
logic changed except one consistency fix (below). Zero mentions of any outside
brand anywhere in the repo (verified).

## Principles applied (CRO + user-psychology)

1. **No meta copy.** Removed developer-facing narration that had leaked onto the
   user's screen — e.g. "internal calculation IDs remain in the audit layer" and
   "raw bytes are checked". Users never see the plumbing described at them.
2. **Plain words, kept technical where it earns trust.** "inspect the source" →
   "check your file"; "the subject" → "the home you're pricing"; "comparable
   ledger" → "listing-by-listing review"; "current treatment" → "what we did with
   it"; "outside policy" → "filtered out". The precise numbers (median, IQR,
   leave-one-out sensitivity) stay — they're what a Supply reviewer needs.
3. **User-first voice, not conversational-with-the-builder.** Copy addresses the
   reviewer doing the job ("get a market rate you can defend line by line"),
   never the developer.
4. **Removed redundancy.** Dropped the "Market evidence" eyebrow that sat directly
   above a market-evidence headline; replaced with a locating label
   ("Problem 1 · Market trust").
5. **Honest framing preserved.** Kept the "unknowns shown instead of scored as
   zero" stance and the "commercial context, not an underwriting result" guard —
   these are trust-builders, reworded only for clarity.

## Consistency fix (logic, deliberate)

The row detail claimed a filtered listing "cannot be overridden", but the engine
now accepts a human override on **any** row (the brief wants "inspect listing by
listing and disagree"). Aligned the UI: any selected listing can be
included / excluded / deferred with a required reason. Copy updated to match.

## Not changed

- Brand palette, fonts, radii, shadows, component library — untouched.
- Tab set (Overview / Market / Occupancy / Economics / Quality / Closing) — the
  non-market tabs still honestly show "not assessed here" with an accountable
  owner. Turning those into static Problem 2 / Problem 3 previews is a separate,
  proposed step, kept out of this pass to avoid scope sprawl.
