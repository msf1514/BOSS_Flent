// Lane 2 — deal terms (private, negotiated). DESIGNED AND STUBBED, not built.
//
// This is the second, structurally-separate lane. Deal terms — landlord ask,
// maintenance, deposit, capex, escalation, lock-in — are NOT public and NOT
// scrapeable. They come from a deal record (deal.md), Slack, or a human, and
// they fail differently from listings: a term goes stale or stays unconfirmed,
// it is not duplicated or bait. So it needs a *confirmation* model, not a *trust*
// model, and it must never be averaged into the market median.
//
// It is stubbed on purpose: fully building a terms-confirmation workflow is
// Problem 3 territory. What matters architecturally is that the interface and
// contract exist, so the system's shape is honest and complete, and the two
// lanes meet only at the human decision layer — never in a shared number.

export type EvidenceStatus =
  | 'confirmed' // signed / in writing
  | 'recorded' // captured but not signed
  | 'estimated' // a working assumption
  | 'verbal' // said, nothing received
  | 'disputed' // teams disagree
  | 'missing';

// The canonical terms record. Every field carries its own evidence status, so a
// recommendation built on three guesses can never look like one built on five
// confirmed facts.
export type TermsRecord = {
  dealId: string;
  baseRent: { value: number | null; status: EvidenceStatus };
  maintenance: { value: number | null; status: EvidenceStatus };
  deposit: { value: number | null; status: EvidenceStatus };
  improvementCapex: { value: number | null; status: EvidenceStatus };
  escalationPct: { value: number | null; status: EvidenceStatus };
  lockInMonths: { value: number | null; status: EvidenceStatus };
  source: string; // e.g. 'deal.md', 'slack:#supply', 'manual'
  capturedAt: string;
};

export type DealSource = {
  kind: 'deal_record' | 'slack_thread' | 'manual';
  reference: string;
  raw: string;
};

export interface DealTermsAdapter {
  readonly sourceName: string;
  // Parse a deal source into a terms record with per-field evidence status.
  // Review-before-commit is mandatory: nothing an adapter extracts becomes a
  // governed input until a human confirms it.
  extract(source: DealSource): Promise<TermsRecord>;
}

export class NotImplementedDealTermsAdapter implements DealTermsAdapter {
  readonly sourceName = 'stub';
  async extract(_source: DealSource): Promise<TermsRecord> {
    throw new Error(
      'Lane 2 (deal-terms extraction) is designed but not implemented in this build. ' +
        'Terms are captured manually today; see docs/INGESTION_ARCHITECTURE.md.',
    );
  }
}
