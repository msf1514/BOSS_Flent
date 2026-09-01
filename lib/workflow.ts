import type { AuditRow } from '@/lib/evidence-engine';
import type { EvidenceRequest, ReviewRecord } from '@/lib/storage';

export type WorkflowReadiness = {
  ready: boolean;
  pendingReviewCount: number;
  deferredReviewCount: number;
  unresolvedRequestCount: number;
};

export function calculateReadiness(
  rows: AuditRow[],
  reviews: ReviewRecord[],
  requests: EvidenceRequest[],
): WorkflowReadiness {
  const latestByListing = new Map(
    reviews.map((review) => [review.listingId, review]),
  );
  let pendingReviewCount = 0;
  let deferredReviewCount = 0;
  for (const row of rows) {
    if (row.b2State !== 'needs_human_review') continue;
    const review = latestByListing.get(row.listingId);
    if (!review) pendingReviewCount += 1;
    else if (review.decision === 'defer') deferredReviewCount += 1;
  }
  const unresolvedRequestCount = requests.filter(
    (request) =>
      request.status !== 'resolved' ||
      request.evidenceNote.trim().length < 12 ||
      !request.owner.trim() ||
      request.owner === 'Unassigned',
  ).length;
  const effectiveComparableCount = rows.filter((row) => {
    const review = latestByListing.get(row.listingId);
    if (review) return review.decision === 'include';
    return row.b2State === 'include';
  }).length;
  return {
    ready:
      pendingReviewCount === 0 &&
      deferredReviewCount === 0 &&
      unresolvedRequestCount === 0 &&
      effectiveComparableCount >= 3,
    pendingReviewCount,
    deferredReviewCount,
    unresolvedRequestCount,
  };
}
