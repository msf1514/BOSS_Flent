import assert from 'node:assert/strict';
import {
  clusterDuplicates,
  priceSignal,
  areaPerBhkImplausible,
  looksLikeSubjectInDisguise,
} from '../lib/listing-signals.ts';

const row = (o) => ({
  listingId: o.id,
  bhk: o.bhk ?? 2,
  area: o.area ?? 1100,
  rent: o.rent ?? 58000,
  deposit: o.deposit ?? null,
  furnishing: o.furnishing ?? 'semi-furnished',
  source: o.source ?? 'PortalA',
  posterType: o.posterType ?? 'unknown',
  lastSeen: o.lastSeen ?? 0,
});

// Same unit cross-posted on two portals, society spelled differently, rent off
// by a little, identical deposit + area + config → one cluster.
const clusters = clusterDuplicates([
  row({ id: 'A', source: 'PortalA', rent: 58000, deposit: 348000, area: 1100 }),
  row({ id: 'B', source: 'PortalB', rent: 58500, deposit: 348000, area: 1105 }),
  row({ id: 'C', source: 'PortalC', rent: 61000, deposit: 292500, area: 1200 }),
]);
assert.equal(clusters.length, 1, 'exactly one duplicate cluster');
assert.deepEqual(clusters[0].memberIds, ['A', 'B']);
assert.ok(!clusters[0].memberIds.includes('C'), 'distinct deposit not merged');

// Owner beats unknown as the kept representative.
const rep = clusterDuplicates([
  row({ id: 'X', posterType: 'unknown', deposit: 200000, area: 1000 }),
  row({ id: 'Y', posterType: 'owner', deposit: 200000, area: 1000 }),
]);
assert.equal(rep[0].representativeId, 'Y');

// Different configuration is never merged even with equal deposit.
assert.equal(
  clusterDuplicates([
    row({ id: 'P', bhk: 2, deposit: 200000, area: 1000 }),
    row({ id: 'Q', bhk: 3, deposit: 200000, area: 1000 }),
  ]).length,
  0,
);

// Price signals against a centre of 58,000.
assert.equal(priceSignal(12000, 58000), 'suspected_bait_price');
assert.equal(priceSignal(185000, 58000), 'suspected_aspirational_ask');
assert.equal(priceSignal(58000, 58000), null);
assert.equal(priceSignal(50000, null), null, 'no centre → no signal');

// Area-per-bedroom plausibility.
assert.equal(areaPerBhkImplausible(1, 2100), true); // 2100 sqft/room
assert.equal(areaPerBhkImplausible(2, 1175), false);
assert.equal(areaPerBhkImplausible(null, 1000), false);

// Wrong configuration but sitting inside the subject band → disguise.
assert.equal(
  looksLikeSubjectInDisguise({
    bhk: 3,
    area: 1175,
    rent: 58000,
    subjectBhk: 2,
    subjectArea: 1175,
    subjectAreaTolerance: 100,
    comparableLow: 54000,
    comparableHigh: 63000,
  }),
  true,
);
// Same configuration as subject is not a disguise case.
assert.equal(
  looksLikeSubjectInDisguise({
    bhk: 2,
    area: 1175,
    rent: 58000,
    subjectBhk: 2,
    subjectArea: 1175,
    subjectAreaTolerance: 100,
    comparableLow: 54000,
    comparableHigh: 63000,
  }),
  false,
);

console.log(
  'Signals contract passed: cross-post clustering, representative choice, config guard, bait/aspirational thresholds, area-per-bhk, and subject-disguise mislabel.',
);
