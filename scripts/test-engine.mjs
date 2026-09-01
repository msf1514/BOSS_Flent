import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runEvidenceEngine, sha256 } from '../lib/evidence-engine.ts';
import { parseRunConfig } from '../lib/run-config.ts';
import { sourceAnnotationsForHash } from '../lib/source-annotations.ts';
import { inspectEvidenceSource } from '../lib/source-inspection.ts';
import { calculateReadiness } from '../lib/workflow.ts';
import { assessMarketReview } from '../lib/market-review.ts';

const csv = await readFile(
  new URL('../public/anonymised-deal-sample.csv', import.meta.url),
  'utf8',
);
const config = {
  dealName: 'Anonymised Lakeview deal',
  evidenceCutoff: '2026-08-18',
  societyPrefix: 'Lakeview',
  bhk: 2,
  areaSqft: 1175,
  furnishing: 'semi-furnished',
  landlordBaseRent: 56000,
  landlordMaintenance: 5000,
  landlordDeposit: 280000,
  improvementCapex: 160000,
  areaToleranceSqft: 100,
  maxLastSeenAgeDays: 30,
};
const inputHash = await sha256(csv);
const inspection = await inspectEvidenceSource({
  filename: 'anonymised-deal-sample.csv',
  sizeBytes: Buffer.byteLength(csv),
  csv,
});
assert.equal(inspection.validStructure, true);
assert.equal(inspection.rowCount, 86);
assert.equal(inspection.headerCount, 13);
assert.equal(inspection.suggestions.evidenceCutoff, '2026-08-18');
assert.deepEqual(inspection.bhks.slice(0, 3), [
  { value: '2', count: 84 },
  { value: '1', count: 1 },
  { value: '3', count: 1 },
]);
assert.ok(!('landlordDeposit' in inspection.suggestions));
const result = await runEvidenceEngine(
  csv,
  config,
  [],
  sourceAnnotationsForHash(inputHash),
);
assert.deepEqual(result.summary.baselines, {
  B0: { count: 84, estimate: 59000 },
  B1: { count: 11, estimate: 58000 },
  B2: { count: 10, estimate: 58250 },
});
assert.deepEqual(result.summary.stateCounts, {
  exclude: 74,
  include: 10,
  needs_human_review: 2,
});
assert.equal(result.validation.acceptedRows, 86);
assert.equal(result.validation.rejectedRows, 0);
assert.equal(
  result.rows.find((row) => row.listingId === 'CP-0081')?.b2State,
  'needs_human_review',
);
const unannotated = await runEvidenceEngine(csv, config);
assert.ok(
  !unannotated.rows
    .find((row) => row.listingId === 'CP-0081')
    ?.reasons.includes('attribute_conflict_candidate'),
);
const invalid = await runEvidenceEngine(
  'listing_id,source,rent\nBAD-1,Portal,50000\n',
  config,
);
assert.equal(invalid.rows.length, 0);
assert.ok(
  invalid.validation.issues.some((issue) => issue.code === 'missing_header'),
);
const impossibleDate = await runEvidenceEngine(
  csv.replace(/2026-\d{2}-\d{2}/, '2026-02-30'),
  config,
);
assert.ok(
  impossibleDate.validation.issues.some(
    (issue) => issue.code === 'invalid_date',
  ),
);
assert.equal(parseRunConfig({}).ok, false);
const reviewRow = result.rows.find(
  (row) => row.b2State === 'needs_human_review',
);
assert.ok(reviewRow);
const readiness = calculateReadiness(
  [reviewRow],
  [
    {
      id: 'review-1',
      listingId: reviewRow.listingId,
      decision: 'defer',
      reason: 'Needs source confirmation',
      actor: 'Reviewer',
      createdAt: new Date().toISOString(),
    },
  ],
  [],
);
assert.equal(readiness.ready, false);
assert.equal(readiness.deferredReviewCount, 1);
const resolvedReviews = result.rows
  .filter((row) => row.b2State === 'needs_human_review')
  .map((row, index) => ({
    id: `review-${index}`,
    listingId: row.listingId,
    decision: 'exclude',
    reason: 'Observable attribute conflict requires exclusion',
    actor: 'Reviewer',
    createdAt: new Date().toISOString(),
  }));
const resolvedRequests = [
  {
    id: 'request-1',
    title: 'Confirm whether maintenance is included in asking rents',
    owner: 'Market analyst',
    status: 'resolved',
    evidenceNote: 'Source note confirms the unresolved mixed basis.',
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
];
const completeReadiness = calculateReadiness(
  result.rows,
  resolvedReviews,
  resolvedRequests,
);
assert.equal(completeReadiness.ready, true);
const unappliedAssessment = assessMarketReview({
  config,
  summary: result.summary,
  readiness: completeReadiness,
  closure: null,
  hasUnappliedReviews: true,
});
assert.equal(unappliedAssessment.state, 'in_review');
assert.equal(
  unappliedAssessment.nextAction,
  'Create the next evidence version.',
);
const completableAssessment = assessMarketReview({
  config,
  summary: result.summary,
  readiness: completeReadiness,
  closure: null,
  hasUnappliedReviews: false,
});
assert.equal(completableAssessment.state, 'ready_to_complete');
assert.equal(
  completableAssessment.completionDisposition,
  'usable_with_caveats',
);
console.log(
  'Engine contract passed: sample invariants, strict dates, source-bound annotations, config validation, governed handoff and deferred readiness.',
);
