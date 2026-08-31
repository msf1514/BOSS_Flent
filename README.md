# BOSS Market Evidence Inspector

A working, client-facing Problem 1 pilot for converting uploaded comparable-listing CSVs into reproducible, reviewable market evidence. It preserves the raw upload in R2, stores versioned runs and workflow records in D1, exposes row-level lineage, and separates engine output from human adjudication.

## What the pilot proves

- Upload either the anonymised sample or another CSV that satisfies the visible 13-column contract.
- Validate the schema and rows at runtime; rejected values return actionable issues.
- Normalize records and calculate deterministic B0/B1/B2 evidence views.
- Preserve source filename, SHA-256, timestamps, configuration, engine version, and immutable child-run lineage.
- Record include, exclude, or defer decisions and evidence-request updates in an audit ledger.
- Recompute from preserved source data without overwriting the parent run.

Deposit and improvement capex are explicit, governed deal inputs. They are shown as economics context but are intentionally not injected into the comparable-rent median. That separation prevents a market-observation metric from silently becoming an investment-underwriting model.

## Trust boundaries

- Audit identity is server-controlled. In hosted Sites environments it is derived from authenticated-user request headers; a named local-pilot identity exists only on localhost for development.
- The client cannot supply an audit actor.
- Case-packet annotations are applied only when the uploaded bytes match the verified anonymised-sample SHA-256.
- Completed runs are immutable; reruns are idempotent and create versioned children.
- Internal failures are logged with correlation IDs while API clients receive stable, non-sensitive messages.

## Deliberate scope

This version accepts CSV/manual uploads. Live portal scraping is not implemented and the product never claims that an upload was scraped. Scraping should be added later as an upstream ingestion adapter that produces the same raw-source contract, provenance fields, validation path, and immutable evidence snapshot. It is not coupled to authentication or audit identity.

The engine supports evidence analysis; it does not issue an ACQUIRE, NEGOTIATE, HOLD, or PASS capital decision.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run lint
npx tsc --noEmit
npm run test:engine
npm run build
npm audit
```

## Persistence

- D1 binding: `DB`
- R2 binding: `EVIDENCE`
- Schema source: `db/schema.ts`
- Migration: `drizzle/0002_integrity.sql`

The supplied BOSS screenshots informed the interface language—Inter typography, deep-ink actions, Flent teal/mint active states, warm canvas, white operational surfaces, left rail, and line tabs. Their seeded figures and hidden logic are not used as product truth.
