import { requiredColumns } from '../evidence-engine.ts';

// The single ingestion contract for Lane 1 (market comparables).
//
// Whatever the origin — a hand-uploaded CSV or a scraper adapter — every market
// listing must arrive as these exact columns, in this exact order. The market
// engine already validates against `requiredColumns`; this module makes that
// contract the one gate all producers pass through, so a scrape is provably
// indistinguishable from an upload by the time it reaches the engine.
//
// Note what is deliberately ABSENT: maintenance, landlord terms, capex. Those
// are never public/scrapeable — they are negotiated deal facts and belong to
// Lane 2 (see deal-terms-adapter.ts). Keeping them out of this contract is what
// structurally prevents a private, unverified number from leaking into the
// market median.

export const LISTING_COLUMNS = requiredColumns;

export type ListingRecord = {
  listing_id: string;
  source: string;
  posted_date: string;
  last_seen_date: string;
  society: string;
  locality: string;
  bhk: string;
  furnishing: string;
  area_sqft: string;
  rent: string;
  deposit: string;
  photo_count: string;
  poster_type: string;
};

const csvCell = (value: string) =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

// Serialize normalized records to the exact CSV the upload path produces, so the
// downstream pipeline (validation → engine → registry) is byte-for-byte the same
// regardless of origin.
export function toListingCsv(rows: ListingRecord[]): string {
  const header = LISTING_COLUMNS.join(',');
  const body = rows.map((row) =>
    LISTING_COLUMNS.map((col) => csvCell(String(row[col] ?? ''))).join(','),
  );
  return [header, ...body].join('\n');
}

export function headerMatchesContract(header: string[]): boolean {
  return (
    header.length === LISTING_COLUMNS.length &&
    LISTING_COLUMNS.every((col, i) => header[i] === col)
  );
}
