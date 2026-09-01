# BOSS Evidence Workbench design system

This file records the design decisions actually used by the product. The supplied BOSS/Flent screenshots are context references, not a functional specification: reuse their recurring visual language, but never inherit seeded values, hidden logic, or unsupported claims.

## Product character

- A calm, high-density internal operating surface for acquisition evidence.
- Content-first application layout; never use a marketing hero, ornamental dashboard, glassmorphism, gradients, or decorative charts.
- Desktop: 248px white left rail, warm off-white work canvas, section tabs, and wide analytical surfaces.
- Mobile: compact branded header, stacked content, 44px minimum interactive controls, and no page-level horizontal overflow.

## Brand tokens

| Role                            | Value                       | Usage                                                                                     |
| ------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------- |
| BOSS ink                        | `#15102F`                   | Wordmark, headings, primary actions                                                       |
| Flent teal                      | `#008F76`                   | Active navigation, links, focus/selection accents                                         |
| Flent mint                      | `#E3F3EF`                   | Active and informational surface fills                                                    |
| Warm canvas                     | `#FBFAF7`                   | Application background                                                                    |
| Surface                         | `#FFFFFF`                   | Rail, tables, cards, dialogs                                                              |
| Border                          | neutral slate, low contrast | Structure without heavy shadow                                                            |
| Semantic success/warning/danger | emerald/amber/red           | Completed/approved, action-needed, and blocked only; always pair colour with text or icon |

Primary actions use BOSS ink. Teal communicates active/product state; it is not applied indiscriminately to every button.

## Typography

- Plus Jakarta Sans for navigation, headings and body copy. Its geometric structure echoes the supplied BOSS reference while remaining legible at operational dashboard density.
- IBM Plex Mono only for immutable IDs and hashes.
- Use tabular numerals for prices, counts, dates, and calculated values.
- Page title: 28–42px depending on viewport; section title: 18–24px; body: 14–16px; never put meaningful text below 12px.
- Tight heading tracking, normal body tracking, and sentence case for product language.

## Components and layout

- Radius: 12–16px for operational surfaces; 6–10px for controls and compact facts; pills only for statuses.
- Prefer borders and spacing to shadows. A 1–2px low-opacity shadow is sufficient for raised surfaces.
- Cards are static containers. Do not add hover lift or pointer cursors unless the whole card is genuinely interactive.
- One visually primary action per decision context.
- Tabs use an underline/line treatment, echoing the current BOSS detail view.
- Tables and comparable rows should preserve desktop density and move secondary fields into details on smaller screens.
- Use Lucide outline icons consistently. Icons support labels; they do not replace essential text.

## Evidence and trust rules

- Separate system recommendation from human decision in language and layout.
- Never display a result that is not derived from the uploaded source and declared policy.
- Show source filename, timestamp, SHA-256, run version, engine version, and audit actor where relevant.
- Deferred reviews remain unresolved. A rerun creates a child version and never edits a completed run.
- B0/B1/B2 remain internal calculation identifiers. The product exposes Broad reference set, Policy-matched comparables, and Current evidence set.
- Green is reserved for completed validation, resolved work and recorded approval. Teal means product selection or verified analysis; amber means unresolved judgment or conditional evidence.
- Completing Problem 1 freezes a market-evidence packet. It does not authorize acquisition or close the lease transaction.
- Uploaded evidence is the present ingestion boundary. Do not imply that live scraping occurred.

## Accessibility and interaction

- WCAG 2.2 AA contrast target; visible 2–4px focus treatment; complete keyboard operation.
- Status uses icon/text in addition to colour.
- Error summaries link the failure to an actionable field/row where possible.
- Loading, empty, failure, partial-success, stale, and permission states require explicit copy and recovery actions.
- Respect `prefers-reduced-motion`; motion is optional and must not carry meaning.
- Test at 375px, 768px, 1024px, and 1440px.

## Release check

- The first viewport answers: is the evidence decision-ready, why/why not, and what should happen next?
- Uploaded sample and arbitrary valid CSVs both execute through the real engine.
- No seeded fixture values are presented as live facts.
- There is no client-editable audit identity.
- Deposit and capex remain explicit declared inputs; scraping remains explicitly out of scope for this uploaded-data pilot.
