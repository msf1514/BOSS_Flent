import type { EngineResult, RunConfig } from './evidence-engine.ts';
import type { WorkflowReadiness } from './workflow.ts';

export type MarketReviewDisposition =
  | 'usable_with_caveats'
  | 'insufficient_evidence';

export type MarketReviewClosure = {
  id: string;
  runId: string;
  disposition: MarketReviewDisposition;
  rationale: string;
  actor: string;
  createdAt: string;
};

export type MarketReviewAssessment = {
  state: 'in_review' | 'ready_to_complete' | 'complete';
  statusLabel: string;
  headline: string;
  explanation: string;
  nextAction: string;
  completionDisposition: MarketReviewDisposition;
  ownerMonthlyCost: number;
  marketMedian: number | null;
  monthlyGap: number | null;
  gapPercent: number | null;
  evidenceCoverage: Array<{
    id: 'market' | 'demand' | 'economics' | 'quality' | 'closing';
    label: string;
    status: 'assessed' | 'context_only' | 'not_assessed';
    detail: string;
    owner: string;
  }>;
};

export const requestPurpose = (request: { title: string }) => {
  if (/maintenance/i.test(request.title))
    return {
      why: 'Without a common rent basis, the owner cost and listing asks are not directly comparable.',
      decisionImpact: 'Blocks a clean above/below-market comparison.',
      defaultOwner: 'Market analyst',
    };
  if (/achieved|signed.lease/i.test(request.title))
    return {
      why: 'Listings show asking prices. A signed lease or achieved-rent source is needed before treating the benchmark as tenant revenue.',
      decisionImpact:
        'Keeps achievable rent outside the market-evidence conclusion.',
      defaultOwner: 'Pricing / Revenue',
    };
  return {
    why: 'This fact cannot be resolved from the uploaded listing fields alone.',
    decisionImpact:
      'Keeps the affected conclusion conditional until evidence is attached.',
    defaultOwner: 'Acquisition lead',
  };
};

export function assessMarketReview(input: {
  config: RunConfig;
  summary: EngineResult['summary'];
  readiness: WorkflowReadiness;
  closure: MarketReviewClosure | null;
  hasUnappliedReviews?: boolean;
}): MarketReviewAssessment {
  const marketMedian = input.summary.baselines.B2.estimate;
  const ownerMonthlyCost =
    input.config.landlordBaseRent + input.config.landlordMaintenance;
  const monthlyGap =
    marketMedian === null ? null : ownerMonthlyCost - marketMedian;
  const gapPercent =
    marketMedian && monthlyGap !== null
      ? Math.round((monthlyGap / marketMedian) * 10_000) / 100
      : null;
  const completionDisposition: MarketReviewDisposition =
    input.summary.askingEvidenceConfidence === 'INSUFFICIENT'
      ? 'insufficient_evidence'
      : 'usable_with_caveats';

  if (input.closure)
    return {
      state: 'complete',
      statusLabel: 'Market review complete',
      headline:
        input.closure.disposition === 'insufficient_evidence'
          ? 'Closed with insufficient market evidence'
          : 'Market evidence packet is complete',
      explanation:
        input.closure.disposition === 'insufficient_evidence'
          ? 'The review is closed without manufacturing a market answer. The recorded limitation travels with the deal.'
          : 'The comparable decisions, limitations and source lineage are frozen for the next BOSS decision stage.',
      nextAction:
        'Use this frozen market packet with demand, economics and property diligence.',
      completionDisposition,
      ownerMonthlyCost,
      marketMedian,
      monthlyGap,
      gapPercent,
      evidenceCoverage: coverage(input),
    };

  if (input.readiness.ready && !input.hasUnappliedReviews)
    return {
      state: 'ready_to_complete',
      statusLabel: 'Ready to complete review',
      headline:
        completionDisposition === 'insufficient_evidence'
          ? 'Close the review as insufficient evidence'
          : 'Freeze the market evidence packet',
      explanation:
        completionDisposition === 'insufficient_evidence'
          ? 'All review work is recorded, but the surviving sample cannot support a stable asking-rent estimate.'
          : 'All required comparable decisions and evidence tasks are recorded. A named reviewer can now complete this market review.',
      nextAction:
        'Complete the review and hand the frozen packet to the wider deal decision.',
      completionDisposition,
      ownerMonthlyCost,
      marketMedian,
      monthlyGap,
      gapPercent,
      evidenceCoverage: coverage(input),
    };

  const reviewCount =
    input.readiness.pendingReviewCount + input.readiness.deferredReviewCount;
  const blockers = [
    reviewCount
      ? `${reviewCount} comparable decision${reviewCount === 1 ? '' : 's'}`
      : '',
    input.readiness.unresolvedRequestCount
      ? `${input.readiness.unresolvedRequestCount} evidence task${input.readiness.unresolvedRequestCount === 1 ? '' : 's'}`
      : '',
  ].filter(Boolean);
  return {
    state: 'in_review',
    statusLabel: 'Review required',
    headline: 'Market evidence is not ready to hand off',
    explanation: input.hasUnappliedReviews
      ? 'Recorded comparable decisions have not yet been applied to a new immutable evidence version.'
      : `${blockers.join(' and ')} still require a recorded owner and resolution.`,
    nextAction: input.hasUnappliedReviews
      ? 'Create the next evidence version.'
      : reviewCount
        ? 'Continue comparable review.'
        : 'Resolve the open evidence tasks.',
    completionDisposition,
    ownerMonthlyCost,
    marketMedian,
    monthlyGap,
    gapPercent,
    evidenceCoverage: coverage(input),
  };
}

function coverage(input: {
  config: RunConfig;
  summary: EngineResult['summary'];
}): MarketReviewAssessment['evidenceCoverage'] {
  const marketStatus: 'assessed' | 'context_only' =
    input.summary.askingEvidenceConfidence === 'INSUFFICIENT'
      ? 'context_only'
      : 'assessed';
  return [
    {
      id: 'market' as const,
      label: 'Market asking evidence',
      status: marketStatus,
      detail:
        marketStatus === 'assessed'
          ? `${input.summary.baselines.B2.count} current comparables; ${input.summary.askingEvidenceConfidence.toLowerCase()} stability.`
          : 'The surviving sample is too thin or unstable for a market estimate.',
      owner: 'Market analyst',
    },
    {
      id: 'demand' as const,
      label: 'Demand and achievable rent',
      status: 'not_assessed' as const,
      detail:
        'The listing upload contains asks, not signed tenant prices or fill evidence.',
      owner: 'Pricing / Revenue',
    },
    {
      id: 'economics' as const,
      label: 'Unit economics',
      status: 'context_only' as const,
      detail: `Owner cost, deposit and capex are captured; contribution and payback are not calculated by this module.`,
      owner: 'Finance / Acquisition',
    },
    {
      id: 'quality' as const,
      label: 'Property condition',
      status: 'not_assessed' as const,
      detail:
        'Photos and inspection findings are outside this uploaded listing source.',
      owner: 'Property team',
    },
    {
      id: 'closing' as const,
      label: 'Terms and closing',
      status: 'not_assessed' as const,
      detail:
        'Written terms, approvals and closing documents are not part of this market run.',
      owner: 'Acquisition lead',
    },
  ];
}
