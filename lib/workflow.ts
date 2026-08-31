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
    (request) => request.status !== 'resolved',
  ).length;
  return {
    ready:
      pendingReviewCount === 0 &&
      deferredReviewCount === 0 &&
      unresolvedRequestCount === 0,
    pendingReviewCount,
    deferredReviewCount,
    unresolvedRequestCount,
  };
}
