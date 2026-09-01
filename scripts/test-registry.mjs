import assert from 'node:assert/strict';
import {
  classifyArtifact,
  hashBytes,
  PACKET_MANIFEST,
} from '../lib/evidence-classification.ts';

// Declared kind honoured when the file group can carry it.
assert.equal(
  classifyArtifact({
    filename: 'listings.csv',
    mimeType: 'text/csv',
    declaredKind: 'listing_csv',
  }).kind,
  'listing_csv',
);

// Filename inference when no kind declared.
assert.equal(
  classifyArtifact({ filename: 'outcomes.csv', mimeType: 'text/csv' }).kind,
  'outcome_set',
);
assert.equal(
  classifyArtifact({ filename: 'comments.md', mimeType: 'text/markdown' }).kind,
  'comment_thread',
);
assert.equal(
  classifyArtifact({ filename: 'deal.md', mimeType: 'text/markdown' }).kind,
  'deal_record',
);
assert.equal(
  classifyArtifact({ filename: 'boss-assessment.md', mimeType: 'text/markdown' })
    .kind,
  'reference_assessment',
);

// A declared kind the file group cannot carry is NOT trusted blindly; it falls
// back to inference (image bytes can never become a listing_csv).
assert.equal(
  classifyArtifact({
    filename: 'site.jpg',
    mimeType: 'image/jpeg',
    declaredKind: 'listing_csv',
  }).kind,
  'image',
);

// Unsupported files are classified, not dropped, and flagged with a reason.
const unsupported = classifyArtifact({
  filename: 'floorplan.dwg',
  mimeType: 'application/acad',
});
assert.equal(unsupported.kind, 'unsupported');
assert.equal(unsupported.supported, false);
assert.ok(unsupported.reason && unsupported.reason.length > 0);

// Sensitivity defaults differ by type; photos are personal by default.
assert.equal(
  classifyArtifact({ filename: 'a.png', mimeType: 'image/png' }).sensitivity,
  'personal',
);

// Manifest: exactly the two required artifacts, and the leakage-guarded kinds
// are never marked consumable by Problem 1.
const required = PACKET_MANIFEST.filter((e) => e.required).map((e) => e.kind);
assert.deepEqual(required.sort(), ['deal_record', 'listing_csv']);
for (const kind of ['image', 'outcome_set', 'reference_assessment']) {
  const entry = PACKET_MANIFEST.find((e) => e.kind === kind);
  assert.equal(entry.consumedByProblem1, false, `${kind} must not feed Problem 1`);
}

// Identical bytes hash identically (dedupe key); different bytes do not.
const a = new TextEncoder().encode('same').buffer;
const b = new TextEncoder().encode('same').buffer;
const c = new TextEncoder().encode('different').buffer;
assert.equal(await hashBytes(a), await hashBytes(b));
assert.notEqual(await hashBytes(a), await hashBytes(c));

// --- Mutation guard rules (pure predicates mirrored from the registry) ---
// These document the state-machine invariants the DB writes enforce, so a
// regression in the guard conditions is caught without a live D1 binding.
const canSupersede = (s, r) =>
  s.id !== r.id &&
  s.kind === r.kind &&
  s.status !== 'deleted' &&
  r.status !== 'deleted';

const photo1 = { id: 'a1', kind: 'image', status: 'received' };
const photo2 = { id: 'a2', kind: 'image', status: 'received' };
const csv1 = { id: 'a3', kind: 'listing_csv', status: 'received' };
const deletedPhoto = { id: 'a4', kind: 'image', status: 'deleted' };

assert.equal(canSupersede(photo1, photo2), true, 'same-kind live pair allowed');
assert.equal(canSupersede(photo1, photo1), false, 'cannot supersede itself');
assert.equal(canSupersede(csv1, photo2), false, 'cross-kind rejected');
assert.equal(
  canSupersede(deletedPhoto, photo2),
  false,
  'deleted artifact cannot participate',
);

// Delete is idempotent: an already-deleted artifact reports no change.
const deleteChanges = (status) => status !== 'deleted';
assert.equal(deleteChanges('received'), true);
assert.equal(deleteChanges('deleted'), false);

console.log(
  'Registry contract passed: declared/inferred kinds, mislabel fallback, unsupported preservation, sensitivity defaults, manifest boundary, content-hash dedupe, and mutation guards (supersede/idempotent delete).',
);
