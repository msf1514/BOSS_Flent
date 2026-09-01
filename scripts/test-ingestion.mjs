import assert from 'node:assert/strict';
import { runEvidenceEngine, parseCsv } from '../lib/evidence-engine.ts';
import { headerMatchesContract } from '../lib/ingestion/contract.ts';
import { assembleListingSet, MIN_SOURCES } from '../lib/ingestion/source-adapter.ts';
import { mockPortalAdapters } from '../lib/ingestion/mock-portal-adapter.ts';
import { NotImplementedDealTermsAdapter } from '../lib/ingestion/deal-terms-adapter.ts';

const query = {
  society: 'Lakeview',
  locality: 'Harlur-Sarjapur Road',
  bhk: 2,
  asOf: '2026-08-18T00:00:00.000Z',
};

// --- Lane 1: adapter output must satisfy the SAME contract as an upload ---
const set = await assembleListingSet(mockPortalAdapters(), query);

// Multi-source by design → diversity floor satisfied (bias resistance).
assert.ok(set.sourceCount >= MIN_SOURCES, 'assembled from >= MIN_SOURCES portals');
assert.equal(set.diversityOk, true);

// The produced CSV parses under the engine's own parser with the exact header.
const parsed = parseCsv(set.csv);
assert.ok(headerMatchesContract(parsed.headers), 'header matches the 13-col contract');
assert.equal(parsed.headers.length, 13);

// Determinism: same query → identical bytes (reproducibility requirement).
const set2 = await assembleListingSet(mockPortalAdapters(), query);
assert.equal(set.csv, set2.csv, 'adapter output is deterministic for a fixed query');

// The engine runs on adapter output exactly as on an upload, and catches the
// planted junk (bait + cross-post) the noisy adapter emitted.
const result = await runEvidenceEngine(set.csv, {
  dealName: 'Mock ingest',
  evidenceCutoff: '2026-08-18',
  societyPrefix: 'Lakeview',
  bhk: 2,
  areaSqft: 1150,
  furnishing: 'semi-furnished',
  landlordBaseRent: 56000,
  landlordMaintenance: 5000,
  landlordDeposit: 280000,
  improvementCapex: 160000,
  areaToleranceSqft: 120,
  maxLastSeenAgeDays: 30,
});
assert.ok(result.validation.rawRows > 0, 'engine accepted adapter rows');
const allReasons = result.rows.flatMap((r) => r.reasons);
assert.ok(
  allReasons.includes('suspected_bait_price'),
  'engine caught the adapter-produced bait row',
);

// A single-source pull must fail the diversity floor (bias would otherwise hide).
const oneSource = await assembleListingSet([mockPortalAdapters()[0]], query);
assert.equal(oneSource.diversityOk, false, 'single source flagged low-diversity');

// --- Lane 2: designed but explicitly not implemented ---
let threw = false;
try {
  await new NotImplementedDealTermsAdapter().extract({
    kind: 'deal_record',
    reference: 'deal.md',
    raw: 'base rent 56000',
  });
} catch {
  threw = true;
}
assert.ok(threw, 'Lane 2 terms extraction is a documented stub, not a silent no-op');

console.log(
  'Ingestion contract passed: adapter output matches the 13-col contract, is deterministic, engine-indistinguishable from an upload, catches planted junk, enforces the source-diversity floor, and Lane 2 is an explicit stub.',
);
