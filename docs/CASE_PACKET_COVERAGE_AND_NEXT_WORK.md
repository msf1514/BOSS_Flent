# Case-packet coverage and next work

Status: **working architectural backlog — 1 September 2026**

This document preserves the current product boundary, maps the supplied exercise case packet to the implementation, and records the next work needed to turn the narrow Problem 1 pilot into a well-integrated BOSS evidence surface. It is intentionally a living document. Decisions marked **Open** must be resolved before production implementation.

## Executive decision

BOSS should capture the complete deal evidence packet. The Problem 1 market engine should consume only evidence relevant to market comparability.

**Capture is not the same as calculation.** Property photos, demand comments, finance assumptions, historical outcomes, and a prior recommendation must not silently enter the comparable-rent median. They should be preserved, attributed, reviewed, and routed to the appropriate BOSS domain.

## Product boundary

The current pilot proves one narrow working slice:

> Raw listing CSV → source preservation → schema and row validation → normalized comparable policy → human review → versioned market estimate → frozen market-evidence handoff.

The broader BOSS product is described as a shared acquisition system that structures deal information, requests missing inputs, compares market and demand evidence, calculates economics, records property-quality judgments, and presents a human-owned recommendation.

Problem 1 is therefore a bounded market-trust service inside a larger deal evidence system. It is not the complete acquisition decision engine.

## Supplied case-packet inventory

| Artifact             | Intended meaning                                                                     | Current implementation                                                      | Correct destination                                            |
| -------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `listings.csv`       | Noisy comparable-listing pull                                                        | **Implemented**                                                             | Problem 1 market engine                                        |
| `deal.md`            | Subject home, landlord ask, commercial terms, working estimates and missing evidence | **Partially implemented** through manually entered run configuration        | Shared deal record and terms service                           |
| `comments.md`        | Time-ordered Supply, Property, Demand, Pricing, Finance and Acquisition discussion   | **Not ingested**; only a few concepts are represented by generic tasks/copy | Collaboration claims, disagreements and work items             |
| `photos/`            | Four subject-property site-visit stills                                              | **Not ingested**                                                            | Property-quality evidence                                      |
| `outcomes.csv`       | Historical acquisition predictions and day-90 outcomes                               | **Not ingested**                                                            | Problem 2 learning and calibration service                     |
| `boss-assessment.md` | Provisional exercise recommendation and sensitivity narrative                        | **Reference only**                                                          | Problem 3 evaluation/reference; never a Problem 1 engine input |
| BOSS screenshots     | Seeded examples of the current product shell                                         | **Design reference only**                                                   | Interaction and visual-language reference                      |

The `photo_count` field in `listings.csv` is only a marketplace image-count observation. It is not a substitute for the subject-property photos in `photos/`.

## What is implemented today

### Raw evidence and lineage

- Listing CSV upload and anonymised sample fast path.
- Raw bytes preserved in R2.
- Source filename, SHA-256, timestamps, validation result, engine version and configuration stored with the run.
- D1-backed immutable parent/child run versions.
- Row-level observed values, normalized values, states, reasons and effective weight.

### Deal context currently captured

- Deal name and evidence cutoff.
- Society, BHK, area and furnishing.
- Landlord base rent and maintenance.
- Security deposit and improvement capex.
- Area tolerance and maximum listing age policy.

These values are manual governed inputs. Deposit and capex are displayed as context and are not injected into the listing median.

### Review and handoff

- Comparable review for ambiguous/extreme rows.
- Evidence tasks with accountable role, status and resolution note.
- Audit events using server-derived actor identity.
- Immutable re-analysis with recorded judgments.
- Explicit Problem 1 completion that freezes one market-evidence version.
- Cross-functional coverage display for Market, Demand, Economics, Property and Closing.

## Material gaps

### Deal terms missing from the data model

- Escalation and effective date.
- Rent-free period and handover/start date.
- Contract term, lock-in and notice period.
- Exit/painting charge.
- Written versus verbal negotiation alternatives.
- Bathrooms, balcony, floor, outlook and key availability.
- Pet rules, working-professional rules, society KYC and other custom constraints.
- Evidence status for every term: confirmed, recorded, estimated, verbal, disputed or missing.

### Collaboration evidence missing

- Original internal comments and timestamps.
- Team/role attribution.
- Claims extracted from comments.
- Explicit disagreement between teams.
- Links from a claim to its source evidence.
- Human confirmation before an extracted claim becomes a governed input.
- A Notes/Collaboration tab comparable to the supplied BOSS interface.

### Property evidence missing

- Subject-photo upload and immutable storage.
- Photo manifest, view type and capture metadata.
- Human observations tied to a specific photo.
- Coverage/limitations: what the image establishes and what remains unknown.
- Technical-inspection checklist and sign-off.
- BOQ, maintenance invoice, society-dues statement and other document evidence.

### Learning and recommendation layers missing

- Historical outcome ingestion and censoring logic (Problem 2).
- Prediction-versus-actual calibration views (Problem 2).
- Full economic and demand models.
- Human-owned `ACQUIRE / NEGOTIATE / HOLD / PASS` authorization.
- Sensitivity and flip-condition decision page (Problem 3).

## Recommended target architecture

```text
Slack / case packet / portal export / manual upload
                        │
                        ▼
                Raw evidence registry
          hash · source · captured_at · access · owner
                        │
       ┌────────────────┼─────────────────┐
       ▼                ▼                 ▼
 Artifact adapters   Claim review      Missing-input tasks
 listings / deal    human-confirmed     owner · status · due
 comments / photos      facts
       │                │                 │
       └────────────────┼─────────────────┘
                        ▼
                 Shared deal record
                        │
       ┌────────┬───────┼────────┬────────┐
       ▼        ▼       ▼        ▼        ▼
    Market    Demand  Economics Property Terms/Closing
   Problem 1                      evidence
       │        │       │        │        │
       └────────┴───────┴────────┴────────┘
                        ▼
             Governed decision packet
                        ▼
      ACQUIRE / NEGOTIATE / HOLD / PASS
```

## Proposed evidence model

The exact schema remains open, but implementation should preserve these concepts.

### `evidence_artifacts`

| Field                                                  | Purpose                                                                                        |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `id`, `deal_id`                                        | Stable identity and deal ownership                                                             |
| `kind`                                                 | Listing CSV, deal record, comment thread, image, document, outcome set or reference assessment |
| `source_system`, `source_reference`                    | Slack, portal, upload, inspection or another origin                                            |
| `captured_at`, `captured_by`                           | Provenance                                                                                     |
| `content_hash`, `object_key`, `mime_type`, `byte_size` | Immutable source preservation                                                                  |
| `parser_version`, `ingestion_status`                   | Reproducibility and operational state                                                          |
| `sensitivity`, `retention_policy`                      | Access and lifecycle controls                                                                  |

### `evidence_claims`

| Field                                        | Purpose                                                     |
| -------------------------------------------- | ----------------------------------------------------------- |
| `artifact_id`                                | Source that supports the claim                              |
| `domain`                                     | Market, Demand, Economics, Property, Terms or Closing       |
| `claim_type`, `value_json`, `unit`           | Structured assertion                                        |
| `evidence_status`                            | Confirmed, recorded, estimated, verbal, disputed or missing |
| `confidence`, `freshness_at`                 | Quality and time boundary                                   |
| `extracted_by`, `reviewed_by`, `reviewed_at` | AI/human governance                                         |
| `supersedes_claim_id`                        | Negotiation and correction history                          |

### `work_items`

Every blocking or conditional claim should identify:

- What evidence is required.
- Why it matters to the decision.
- Which role owns it.
- Status, due time and SLA.
- Resolution evidence and reviewer.
- Which conclusion remains conditional while open.

## Case-comment routing example

| Packet observation                            | Domain             | Governed treatment                                                                        |
| --------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| Owner may accept ₹54,000                      | Terms              | Unconfirmed negotiation scenario; never replace the recorded ask without written evidence |
| Damp patch and weak bathroom exhaust          | Property           | Inspection issues linked to photos and an accountable property task                       |
| ₹1.6L capex placeholder                       | Economics/Property | Provisional assumption with a vendor-BOQ task                                             |
| 11 enquiries, four comparable                 | Demand             | Directional evidence with explicit sample limitation                                      |
| ₹38k + ₹34k room ladder                       | Demand/Economics   | Achievable-rent hypothesis, not achieved revenue                                          |
| ₹1L uncovered landlord deposit                | Economics          | Capital-exposure claim linked to the finance note                                         |
| Listing maintenance basis is unreliable       | Market             | Problem 1 limitation and market-evidence task                                             |
| Acquisition lead requests defensible evidence | Decision           | Completion gate, not an engine-generated fact                                             |

## Proposed user workflow

1. **Import evidence** — upload a complete packet or an individual artifact.
2. **Inventory** — show received, missing, unsupported and duplicate artifacts before analysis.
3. **Extract candidate claims** — deterministic parsers first; AI may suggest claims with source citations and confidence.
4. **Human confirmation** — no AI-extracted claim enters a decision model silently.
5. **Route by domain** — Market, Demand, Economics, Property, Terms and Closing receive only relevant confirmed/context inputs.
6. **Resolve evidence work** — owners, status and evidence-backed resolution are visible across teams.
7. **Freeze domain packets** — Problem 1 freezes market evidence; other domains complete independently.
8. **Assemble decision packet** — only then can a named acquisition owner authorize a commercial verdict.

The existing **Add listing evidence** flow should remain as a fast path. A new **Import case packet** path should surround it rather than replace it.

## Backlog

### P0 — preserve the complete evidence boundary

- [ ] Add an `evidence_artifacts` registry and migrations.
- [ ] Store all uploaded artifacts in R2 with immutable hashes and provenance.
- [ ] Add packet manifest validation and file-type/size limits.
- [ ] Add authorization, tenant isolation, sensitivity and retention decisions before broad upload support.
- [ ] Expose an inventory API: received, missing, duplicate, unsupported and failed.
- [ ] Add audit events for artifact ingest, parse, review, supersession and deletion.

**Acceptance criteria**

- Re-uploading identical bytes does not create uncontrolled duplicates.
- Every artifact can be traced to deal, source, actor, timestamp and content hash.
- Unsupported files are preserved or rejected according to an explicit policy; they are never silently ignored.
- One deal cannot read another deal's evidence.

### P1 — deal and comment adapters

- [ ] Define the canonical deal-term schema and evidence-status vocabulary.
- [ ] Add a `deal.md`/structured-form adapter with review-before-commit.
- [ ] Add a comment-thread adapter that preserves original ordering, role and timestamp.
- [ ] Create source-linked candidate claims and disagreement relationships.
- [ ] Add Notes/Collaboration UI with filters by domain, owner and evidence status.
- [ ] Generate bounded work items from missing or disputed claims.

**Acceptance criteria**

- The verbal ₹54,000 alternative remains distinguishable from the recorded opening ask.
- A reviewer can inspect the exact source passage behind every extracted claim.
- Editing a claim creates a new governed version rather than rewriting source history.
- Conflicting team claims remain visible; the system does not average disagreement away.

### P1 — property evidence adapter

- [ ] Upload and render subject-property photos.
- [ ] Persist photo manifest, view type and source metadata.
- [ ] Add human observations and inspection checklist items linked to photos/documents.
- [ ] Add the supplied photo limitations to the Quality view.
- [ ] Add document types for BOQ, inspection sign-off, maintenance invoice and society-dues statement.
- [ ] Keep unknown factors unknown; do not generate a synthetic quality score from missing evidence.

**Acceptance criteria**

- Daylight/storage observations can be supported without claiming unseen noise, smell, dimensions or hidden damage.
- Damp/exhaust issues become accountable tasks.
- Photos never alter the comparable-rent median.

### P2 — cross-functional handoff

- [ ] Replace placeholder domain tabs with source-backed deal evidence.
- [ ] Add domain completion states and accountable owners.
- [ ] Show the consequence of every unresolved blocker.
- [ ] Build a deal-level handoff packet from immutable domain versions.
- [ ] Keep market-review completion separate from acquisition authorization and transaction closing.

### Separate workstreams

- [ ] Problem 2: ingest `outcomes.csv`, model censored observations and compare predictions with actuals.
- [ ] Problem 3: assemble recommendation drivers, assumptions, disagreements, sensitivities and flip conditions.
- [ ] Portal/Slack integrations: implement upstream adapters only after the artifact contract and authorization model are stable.

## Open decisions

1. **Deal identity** — what stable identifier links Slack, portal data, photos, documents and BOSS records?
2. **Tenancy and access** — which teams may view financial terms, internal comments and property photos?
3. **Retention** — how long are raw comments/images retained, and how is deletion reconciled with audit requirements?
4. **AI governance** — which extracted fields require two-person review or source-specific confidence thresholds?
5. **Comment model** — immutable thread plus claims, or claims only with source excerpts?
6. **Negotiation history** — are landlord terms event-sourced, versioned snapshots, or both?
7. **Photo analysis** — human-only observations for the pilot, or bounded AI suggestions with mandatory confirmation?
8. **Document verification** — what establishes that a BOQ, invoice or society statement is current and authoritative?
9. **Domain completion** — which evidence tasks block a domain packet versus travel as caveats?
10. **Outcome isolation** — how will historical outcomes inform calibration without leaking evaluator-only truth into current-case inputs?
11. **Prior assessment handling** — where is `boss-assessment.md` stored so it can support evaluation without becoming engine evidence?
12. **Integration sequence** — manual packet upload first, followed by Slack/portal connectors, or direct connector proof first?

## Guardrails

- Preserve raw evidence before normalization or AI extraction.
- Show source and freshness beside claims.
- Blank, missing and unknown are not zero.
- AI may suggest structured inputs; it cannot silently commit them to deterministic arithmetic.
- Do not let historical outcomes or the supplied assessment leak into a current market estimate.
- Do not let photos or internal sentiment change the market median.
- A named human owns every capital decision.
- Completed domain packets remain inspectable and immutable.

## Definition of success for the next increment

A fresh clone should be able to ingest the exercise packet into a source inventory, preserve every artifact, route listings to the existing market engine, show deal terms/comments/photos without inventing scores, create source-backed cross-functional work items, and demonstrate that completing Problem 1 hands off a trustworthy market packet rather than closing the acquisition.
