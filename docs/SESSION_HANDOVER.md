# Session handover — BOSS Problem 1 (Flent FDE take-home)

A complete pick-up-and-continue brief for a new session. It assumes you have also
read `CLAUDE.md` (project memory) and does not repeat everything there. Where the
two overlap, `CLAUDE.md` is the source of truth for boundaries and rationale, and
this file records what happened in the most recent working session and the current
state.

No em dashes are used in user-facing copy anywhere in this project. Keep it that
way (see the conventions section).

---

## 1. What this is, in one paragraph

A take-home for Flent (a Forward Deployed Engineer role). The product is **BOSS**,
a real-estate acquisition tool. The brief asks you to pick one of three problems
and prove the riskiest part end to end. We chose **Problem 1: a trust layer for
market listings**. Scraped rental listings lie (duplicates, bait, stale,
aspirational, mislabelled), and on a dashboard a bad market rate looks exactly as
precise as a good one. Problem 1 turns a noisy CSV of comparable listings into a
trustworthy market-rent benchmark with an explicit confidence level, where every
listing's keep or drop decision is visible with its reason and a human can overrule
any single call.

The riskiest assumption we proved: honest cleaning changes the answer's
trustworthiness, not just its cosmetics. On the real 86-row packet the naive
pipeline reports HIGH confidence at ₹58,250 while silently double-counting
cross-posts and leaving bait in the sample. The trust layer fixes that.

---

## 2. The three graded deliverables and where they live

The brief (in the reference folder, see section 8) asks for three things. All three
exist and are aligned to the brief:

| Deliverable | Where | Status |
|---|---|---|
| **Approach note** (max 8 slides / 4 pages) | `docs/approach-note.html` | 8-slide self-contained HTML deck, prints to PDF, byline "Prepared by Sufiyan for Flent" |
| **Proof of work** (5 min, one failure case) | the app itself, deployed | CSV in, trust breakdown out, INSUFFICIENT failure case, anonymous try-it |
| **Execution plan** (1 parent + 5 to 8 sub-issues) | `docs/EXECUTION_PLAN.md` | 1 parent + 8 ordered sub-issues, client-facing, dateless |

The approach note deck references `docs/assets/shot-*.png` (product screenshots) by
relative path, so it is fully self-contained and works offline (fonts aside).

Deck slide order: 1 title and thesis, 2 the problem sharpened, 3 before and after
(proof), 4 system shape (capture vs calculate, two lanes, human/AI/code), 5 how the
team uses it plus the anonymous try-it, 6 when the evidence runs out (failure case),
7 scope and assumptions and metric and AI note, 8 the wider system with the
Problems 2 and 3 approach and the two preview thumbnails.

---

## 3. What was built or changed in the most recent session

In order (newest commit first). Everything is on `main` and pushed to origin.

- `9e1a87d` Deck compressed from 10 to **8 slides** to meet the brief's cap, byline added.
- `942cc16` Deck screenshots re-captured dash-free; embedded the `/decision` and `/calibration` preview thumbnails.
- `6f76c2c` **App-wide em-dash sweep** (134 replacements) plus enhanced the P2/P3 preview pages (approach bands, a fill-time-bias chart on `/calibration`).
- `6beb25d` Deck rewrite to an expert voice with a usage walkthrough and P2/P3 approach.
- `18c0a34` Deck rework with before/after and product screenshots.
- `1fb495e` **Anonymous market-trust check** (client-side, nothing saved).
- `c9610c6` First BOSS-branded approach deck.
- `38a5624` **Header milestone tracker** consolidation (single review spine).
- `22890f4` **Evidence tasks**: named assignee plus in-app notify, as a compact list (D1 schema migration).
- `e9cd141` **Intake polish** plus an info-icon affordance on every field and card.
- `1aeb6c6` **Funnel breakdown modal** (each drop opens the exact listings).

Earlier baseline before this session: `bc68dd3` added `CLAUDE.md`.

### Feature notes a new session needs

- **Funnel breakdown modal** (`FunnelBreakdownModal` in `app/_components/trust-vocabulary.tsx`). The Overview funnel card and the Market to Summary "how the evidence was narrowed" card both open it. It shows the staged funnel with the median at each stage and each drop grouped by reason, then the trusted survivors. Reachable even at 0 trusted (INSUFFICIENT) so the honest-failure story is inspectable.
- **Info affordance** (`app/_components/info-hint.tsx`, `InfoHint`). An info icon plus a base-ui tooltip, inert inside clickable cards (stopPropagation). Added to every intake config field and every data card. Use it for any new card.
- **Evidence-task assignment** (schema change). `evidence_requests` gained `assignee` and `notified_at` via a tolerant forward migration in `db/schema.ts` (`migrationStatements`) run by `ensureSchema()` in `lib/storage.ts`. The `request` action persists the assignee and resets `notified_at` when the assignee changes; a new `notify_request` action stamps `notified_at` and writes an `evidence_request_notified` audit event. It is an honest in-app notification, there is no external email or Slack. UI is a compact list in `EvidenceTasks` (in `market-workbench.tsx`).
- **Header milestone tracker** (`MilestoneTracker` in `market-workbench.tsx`). One spine derived from `assessMarketReview` plus readiness: Analysed, Flagged rows, Evidence tasks, Apply judgments, Freeze and complete. The header's single primary CTA is the next action for the current step. The old `MarketPipeline` was deleted, the duplicate completion button in "Where this goes next" was removed, and the Version-control card's Apply button was removed (the header drives it).
- **Anonymous mode** (`app/_components/anonymous-analysis.tsx`). Reached from the deals list button "Try anonymously" and the `anonymous` view in `app/page.tsx`. The CSV is read with FileReader and `runEvidenceEngine` runs entirely in the browser (the engine and `listing-signals` are pure and use only browser-safe APIs). Nothing is uploaded or written to D1/R2. It is read-only by design. This is what makes the deck's "nothing saved" claim honest.
- **P2/P3 preview enhancements** (`app/calibration/page.tsx`, `app/decision/page.tsx`). Each got a "how this works" band that showcases the approach, `/calibration` also got a fill-time-error-by-case chart. All figures come from the real packet, nothing is invented, and both are clearly labelled illustrative previews.

---

## 4. Architecture map (quick)

Engine (deterministic, pure): `lib/evidence-engine.ts` (parse, validate, staged
baselines B0 to B1 to B2, median plus confidence tier), `lib/listing-signals.ts`
(dedup, bait/aspirational/mislabel detectors). Both are pure and run client-side.

Capture layer: `lib/evidence-registry.ts` plus `lib/evidence-classification.ts`
(the `evidence_artifacts` registry, capture only, never calculates).

Ingestion (two lanes): `lib/ingestion/*` (13-col contract, Lane 1 mock adapter,
Lane 2 deal-terms stub). See `docs/INGESTION_ARCHITECTURE.md`.

Storage and API: `lib/storage.ts` (D1 plus R2, `ensureSchema()` self-heals table by
table and now also runs `migrationStatements`), `lib/auth.ts`, and
`app/api/{runs,actions,intake,evidence}/route.ts`.

UI: `app/page.tsx` (views: list, intake, run, anonymous),
`app/_components/{deals-list,run-intake,market-workbench,problem-one-overview,trust-vocabulary,anonymous-analysis,info-hint}.tsx`.
Static previews: `app/calibration/page.tsx` (Problem 2), `app/decision/page.tsx`
(Problem 3).

---

## 5. Conventions to keep green

Run before every commit, all must pass:

```
npm run lint            # oxlint, 0 warnings
npx tsc --noEmit        # typecheck (use ./node_modules/.bin/tsc on this machine)
npm run test:engine     # engine contract on the real packet
npm run test:signals    # pure detectors
npm run test:registry   # evidence registry
npm run test:ingestion  # ingestion seam
npm run build           # vinext build, also confirms the engine bundles client-side
```

- Node type-stripping quirk: test scripts run under `node --experimental-strip-types`.
  Avoid constructor parameter properties and use relative `.ts` imports inside
  modules the tests import directly.
- Determinism: engine and signals must be deterministic. No randomness or wall clock
  in the engine.
- **No em dashes** in user-facing copy. The one exception kept on purpose is the
  blank-value glyph (a lone dash meaning "no data", for example a censored outcome
  cell or an unavailable median). Prose uses commas, periods or colons.
- `oxlint` gotcha seen this session: `no-base-to-string` fires when you truthy-narrow
  an `unknown` (it becomes `{}`), so cast DB columns like `(item.x as string | null) ?? ''`
  instead of `item.x ? String(item.x) : ''`.

### Known pre-existing issue (not from this session)

`npm run test:engine` currently fails with a state-count mismatch (the engine reports
`exclude: 75, needs_human_review: 1` where the test expects `74 / 2`). This fails
identically with all recent work stashed, so it predates this session and is in the
engine or its test, not the UI. Worth a look, but it is not caused by the recent
commits.

---

## 6. Build, run, test, deploy

- Local dev: `npm install` then `npm run dev`, opens at `http://localhost:3000`.
  On this Windows machine, kill a stale dev server by finding the PID on port 3000
  (`netstat -ano | grep :3000`) and `taskkill //PID <pid> //F`.
- Deploy: **Cloudflare is connected to the GitHub repo**, so pushing to `main`
  triggers the build and deploy automatically. There is nothing to run by hand.
  The live prototype is `https://mohsufboss.msf1514.workers.dev/`.
- `wrangler` is **not authenticated** in this environment (`wrangler login` is
  interactive and cannot run here), so do not try to `wrangler deploy` from here.
  Rely on the Git integration.
- First request after a deploy runs the D1 migration automatically via
  `ensureSchema()`, so the new `evidence_requests` columns appear on the live
  database with no manual step.

### Screenshots for the deck

Product screenshots in `docs/assets/` are captured from local dev (which is always
current), not from the live prototype (which can lag until Cloudflare finishes a
build). Playwright is installed only in the session scratchpad, not in the repo
(the repo `package.json` stays clean). To re-capture: start dev, then run the
Playwright script that drives the deals list, the anonymous flow, the sample run,
the funnel modal, the tasks tab, and `/calibration` and `/decision`, writing PNGs
into `docs/assets/`.

---

## 7. Decisions made this session (so you do not relitigate them)

- **Anonymous mode is client-side**, not server-side. The engine is pure, so the
  data literally never leaves the browser. This is the honest reading of "try it
  with your own data, nothing saved".
- **Deck is 8 slides**, not 10. The brief caps the approach note at 8 slides or 4
  pages. Everything (including the P2/P3 approach and the anonymous framing) is
  folded into 8.
- **Deck uses BOSS brand tokens** (Plus Jakarta Sans, Flent teal, mint, warm canvas
  from `app/globals.css`), not a separate visual identity. It reads as BOSS.
- **The blank-value dash is kept**; only prose em dashes were removed.
- **P2/P3 are approach only**, in the approach note, not separate execution plans.
  The brief asks for one problem's execution plan (Problem 1), which we have.
- Artifacts (claude.ai hosted pages) are **not used**. Everything is a local file in
  the repo, per the user's explicit instruction.

---

## 8. Reference material and where to align

Two folders are dropped into the repo root for context and are **gitignored** (never
commit them):

- `flent-fde-take-home/` contains the original brief PDF, the BOSS context pack, and
  the case packet (`listings.csv`, `deal.md`, `comments.md`, `outcomes.csv`,
  `boss-assessment.md`, photos).
- `BOSS_Problem1_Handoff (3)/` is a prior builder's handoff. Useful subfolders:
  `03_evaluation_contract` (how a trust layer would be benchmarked against B0/B1/B2
  baselines, with strong integrity gates), `02_semantic_contract`, `04_world_build_spec`.

Alignment already confirmed: our staged baselines map to the contract's B0 (raw),
B1 (heuristic), B2 (trust layer). The contract's principles (no invented data,
auditable reasons, abstention as INSUFFICIENT, reasonable disagreement via human
override, duplicate/correlation handling, confidence quality, complexity-vs-value)
all match the build and the execution plan.

---

## 9. Open items and honest gaps

- **Execution-plan piece 7** (re-cluster duplicates across the human-included set)
  is the one real gap in the current build, carried as a tracked piece of work in
  `docs/EXECUTION_PLAN.md`. If two cross-post twins are both excluded and then both
  re-included by a human, they could double-count.
- **RBAC / tenancy** is auth-only today (`authorizeDealAccess` confirms
  authentication, not per-user isolation). Documented as an accepted pilot
  limitation.
- **The pre-existing engine test failure** (section 5).
- The live prototype only matches the latest work after Cloudflare finishes building
  the latest `main`. If the deck's screenshots look newer than the live site, a
  build is still in flight or has not been triggered.

---

## 10. Pointers

- `CLAUDE.md` — project memory, boundaries, the why.
- `docs/EXECUTION_PLAN.md` — the client-facing Problem 1 plan.
- `docs/approach-note.html` — the 8-slide deck (open in a browser, Print to PDF).
- `docs/INGESTION_ARCHITECTURE.md` — the two-lane design.
- `docs/CASE_PACKET_COVERAGE_AND_NEXT_WORK.md` — capture vs calculate analysis.
- `docs/reviews/*` — per-change review notes and the UX open-issues audit.

When in doubt, prefer the honest, narrower answer over the impressive-looking one.
That instinct is the whole point of this submission.
