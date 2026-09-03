# Submission · Problem 1: a trust layer for market listings

Prepared by Sufiyan for Flent.

We picked Problem 1: the market data lies to us. Scraped rental listings are full
of duplicates, stale inventory, bait and optimistic asks, and on a dashboard a bad
market rate looks exactly as precise as a good one. This turns a noisy listing pull
into a market rate you can defend, with an explicit confidence level, where every
keep or drop decision is visible with its reason and a human can overrule any single
call. When the surviving evidence is too thin, it says so instead of guessing.

---

## The three deliverables

### 1. Approach note (8 slides)
- Live: `https://mohsufboss.msf1514.workers.dev/deck/approach-note.html`
- Local: `docs/approach-note.html` (open in a browser, use the Print button for a PDF)

It covers the brief's checklist in eight slides: the problem in our words, the
approach and what we chose not to solve, the shape of the system (where humans
judge, where AI helps, what stays deterministic), how we handle missing, stale and
conflicting evidence, the failure case, our assumptions and trade-offs, the first
metric we would watch, and how Problems 2 and 3 fit.

### 2. Proof of work (the live prototype)
- Live: `https://mohsufboss.msf1514.workers.dev/`

Raw CSV in, reviewable market evidence out, with the reason behind every decision
preserved and a deliberate failure case. See the five-minute path below.

### 3. Execution plan
- `docs/EXECUTION_PLAN.md`

One parent outcome and eight ordered pieces of work, each with its outcome, scope
boundary, dependencies, real or mocked data, and how we would prove it, plus the
next increment (live ingestion) that replaces the CSV upload through the same gate.

---

## Review it in five minutes

1. **Open the prototype.** The deals workspace shows six real reviews across the
   full confidence range (HIGH, MEDIUM, LOW, INSUFFICIENT) and both complete and
   in-progress states. Every one was produced by running a noisy listing set
   through the real engine, so the tier on each card is the engine's own verdict.
2. **Open the Whitefield deal (HIGH).** The header tracks the review from analysed
   to frozen. The rate shows its confidence tier, the three checks behind it, and
   the funnel from all listings down to the trusted set. Click the funnel to see
   exactly which rows dropped and why.
3. **Open the Sarjapur Road deal (INSUFFICIENT).** This is the required failure
   case: the surviving sample is too thin, so the system says so rather than
   manufacturing a number.
4. **Try it with your own data.** The "Try anonymously" button runs the whole trust
   layer in your browser. Nothing is uploaded or saved to our database.
5. **See how it hands off.** The `/decision` and `/calibration` previews show how a
   frozen market packet feeds Problem 3 (the decision) and Problem 2 (the feedback
   loop), each with its own architecture and the questions a sceptical reviewer
   asks.

---

## What we are proud of, and what we did not do

- The win we proved is not a prettier number, it is a defensible one. On the real
  packet the naive median reports HIGH confidence while double-counting cross-posts
  and keeping bait in the sample; the trust layer produces a sample every excluded
  row can justify.
- We deliberately did not build the acquisition verdict (Problem 3), achieved rent
  (Problem 2), any use of photos or comments inside the median, or live scraping in
  the graded path. Those are scoped in the approach note and the execution plan.
- Inventing evidence is the one hard no. Missing stays missing, every flag traces to
  a rule, and the confidence tier returns INSUFFICIENT when the evidence runs out.

Every check is green: `npm run lint`, `npx tsc --noEmit`, and the engine, signals,
registry and ingestion contract tests. The prototype deploys automatically from the
main branch.
