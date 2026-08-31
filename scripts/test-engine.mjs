import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runEvidenceEngine } from '../lib/evidence-engine.ts';

const csv = await readFile(new URL('../public/anonymised-deal-sample.csv', import.meta.url), 'utf8');
const config = {
  dealName: 'Anonymised Lakeview deal', evidenceCutoff: '2026-08-18', societyPrefix: 'Lakeview',
  bhk: 2, areaSqft: 1175, furnishing: 'semi-furnished', landlordBaseRent: 56000,
  landlordMaintenance: 5000, landlordDeposit: 280000, improvementCapex: 160000,
  areaToleranceSqft: 100, maxLastSeenAgeDays: 30, sampleAnnotation: true,
};
const result = await runEvidenceEngine(csv, config);
assert.deepEqual(result.summary.baselines, { B0:{count:84,estimate:59000}, B1:{count:9,estimate:58000}, B2:{count:8,estimate:58250} });
assert.deepEqual(result.summary.stateCounts, { exclude:74, include:8, duplicate_collapsed:2, needs_human_review:2 });
assert.equal(result.validation.acceptedRows, 86);
assert.equal(result.validation.rejectedRows, 0);
assert.equal(result.rows.find((row) => row.listingId === 'CP-0081')?.b2State, 'needs_human_review');
const invalid = await runEvidenceEngine('listing_id,source,rent\nBAD-1,Portal,50000\n', config);
assert.equal(invalid.rows.length, 0);
assert.ok(invalid.validation.issues.some((issue) => issue.code === 'missing_header'));
console.log('Engine contract passed: sample invariants and blocking-schema failure.');
