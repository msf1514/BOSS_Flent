# Ingestion architecture — how evidence enters BOSS

Status: designed in full; Lane 1 built as a working mock adapter; Lane 2 stubbed.

## The forcing function: provenance, not preference

Every input to BOSS has an origin, and the origin dictates the pipeline. There
are exactly two, and they fail differently — which is why they are two lanes, not
one.

| | Lane 1 — Market comparables | Lane 2 — Deal terms |
|---|---|---|
| Example fields | rent, deposit, area, bhk, furnishing | maintenance, capex, landlord ask, lock-in, escalation |
| Origin | Public — scraped from portals | Private — deal record, Slack, a human |
| How it fails | duplicated, stale, bait, aspirational, mislabelled | stale, unconfirmed, verbal, disputed |
| What it needs | a **trust** layer (dedup, flag, confidence) | a **confirmation** layer (evidence status, review-before-commit) |
| Ends up in | the market-rate median | never the median — a labelled deal fact |

A single lane would apply the wrong failure-handling to half the data: deduping a
landlord's ask is nonsense; running a confirmation workflow over 86 scraped rows
is nonsense. So the split is forced by the data, not chosen for neatness.

## The shape

```
LANE 1 — Market comparables (public, scraped)
  Portal adapter A ┐
  Portal adapter B ┼─ normalise ─ 13-col listings contract ─┐
  Portal adapter C ┘   (one gate)                            │
                                                             ├─ Evidence Registry ─ Market Engine
LANE 2 — Deal terms (private, negotiated)                    │   (hash·source·        (median +
  deal.md / Slack adapter ── terms contract (per-field ──────┘    timestamp·kind)      confidence)
                              evidence status)                                          │
                                                                                        └─ the two lanes
                                                                                           meet only at the
                                                                                           human decision layer
```

## What makes this a good design, not just a diagram

**1. One contract, enforced once.** Whatever the origin, a market listing becomes
the exact 13 columns the engine already validates (`lib/ingestion/contract.ts`).
There is a single normaliser; a scrape that doesn't conform is rejected the same
way a bad CSV is. This is the guarantee that *scraped data matches the uploaded
shape* — not by convention, by a shared gate.

**2. Zero engine changes.** A scrape is just another `listing_csv`-kind artifact
with `source_system: "scraper:<portal>"`. The market engine cannot distinguish a
scrape from an upload — proven by `scripts/test-ingestion.mjs`, which runs mock
adapter output through the same parser and engine and catches the planted junk.
That indistinguishability is the tell of a correct seam.

**3. Bias resistance is structural, not bolted on.** A market set assembled from
too few sources inherits that source's skew. We do not "correct" bias — we
surface it: sets below a 3-source floor are flagged low-diversity, and because the
engine already lowers its confidence tier on thin portal diversity, a
single-source scrape automatically presents as *lower confidence* rather than a
falsely clean number. The honesty machinery already built does the work.

**4. The capture/calculate wall holds across lanes.** Maintenance, capex and terms
are absent from the Lane 1 contract by design — they are not scrapeable, so a
scraper can never invent them onto a listing. They arrive only through Lane 2,
each field carrying its own evidence status, and never enter the median. The two
lanes meet only where a named human makes the decision.

## Why not a live scraper (now)

The brief describes the listings as scraped and says *start with the provided
CSV*; it also requires the recommendation to be **reproducible when inputs
change**. A live crawler pulling different data each run works against that, and
it can never reproduce the packet's planted failure cases — so it would either
blunt the demo or tempt fabricating data to match, which the brief forbids. The
value is the *contract and the seam*, not a crawler. A real portal adapter is a
drop-in later: implement `SourceAdapter.fetch` against a real source (e.g. via a
headless fetch/Firecrawl step), and everything downstream is unchanged.

## Lane 2 status

Designed and stubbed (`lib/ingestion/deal-terms-adapter.ts`): the `TermsRecord`
contract with per-field `EvidenceStatus`, the `DealTermsAdapter` interface, and an
explicit not-implemented stub. Building the terms-confirmation workflow is
Problem 3 territory; the interface exists so the system's shape is honest and
complete.

## Files

- `lib/ingestion/contract.ts` — the 13-column gate + CSV serializer.
- `lib/ingestion/source-adapter.ts` — Lane 1 interface, normaliser, diversity floor.
- `lib/ingestion/mock-portal-adapter.ts` — working deterministic multi-source mock.
- `lib/ingestion/deal-terms-adapter.ts` — Lane 2 contract + interface + stub.
- `scripts/test-ingestion.mjs` — proves the seam end-to-end.
