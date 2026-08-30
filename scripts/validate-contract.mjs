import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const data = JSON.parse(readFileSync(resolve(root, 'data/prototype.json'), 'utf8'));
const page = readFileSync(resolve(root, 'app/page.tsx'), 'utf8');

assert.equal(data.snapshot.isLive, false);
assert.equal(data.snapshot.isProduction, false);
assert.equal(data.marketEvidence.input_rows, 86);
assert.deepEqual(data.marketEvidence.baselines, {
  B0: { count: 84, estimate: 59000 },
  B1: { effective_count: 9, estimate: 58000 },
  B2: { effective_count: 8, estimate: 58250 },
});
assert.deepEqual(data.marketEvidence.b2_state_counts, {
  duplicate_collapsed: 2, exclude: 74, include: 8, needs_human_review: 2,
});
assert.equal(data.marketEvidence.observed_portal_label_count, 3);
assert.equal(data.marketEvidence.maximum_leave_one_out_movement_pct, 0.429);
assert.equal(data.marketEvidence.decision_boundary.includes('does not recommend'), true);
assert.equal(data.case.referenceDecision.generatedByPrototype, false);
assert.equal(data.economics.scenarios.find((s) => s.id === 'opening_ask').simplePaybackMonths, 35.1);
assert.equal(data.economics.scenarios.find((s) => s.id === 'verbal_54000').simplePaybackMonths, 27.7);
assert.equal(data.economics.scenarios.find((s) => s.id === 'room_2_downside_fixed_deposit').simplePaybackMonths, 57.1);
assert.equal(data.economics.scenarios.find((s) => s.id === 'room_2_downside_linked_deposit').simplePaybackMonths, 58.8);
assert.equal(data.listings.filter((r) => r.decision.b2State === 'include').length, 8);
assert.equal(data.listings.filter((r) => r.decision.b2State === 'duplicate_collapsed').length, 2);
assert.equal(data.listings.filter((r) => r.decision.b2State === 'needs_human_review').length, 2);
assert.match(page, /Local demonstration only · not saved/);
assert.match(page, /Decision-grade comparison: INSUFFICIENT/);
assert.match(page, /do not numerically consume the ₹58,250 market estimate/);
assert.match(page, /Nothing is assigned, sent, persisted or authorized/);

console.log('Prototype contract validated: 20 assertions passed.');
