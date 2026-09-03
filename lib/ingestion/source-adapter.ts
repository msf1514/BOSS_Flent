import {
  toListingCsv,
  type ListingRecord,
} from './contract.ts';

// Lane 1, market comparables (public, scraped).
//
// A SourceAdapter turns one portal's raw output into loosely-typed records. It
// knows nothing about the engine or the registry, it only produces raw rows for
// its own source. Adapters are swappable and independently testable; adding a
// portal is adding an adapter, never touching the engine.

export type AdapterQuery = {
  society: string;
  locality: string;
  bhk: number;
  // A capture timestamp so every produced set is reproducible and hashable.
  asOf: string;
};

// Loose shape: whatever a portal exposes. Fields may be missing or dirty, that
// is expected, and is exactly why the trust engine exists downstream.
export type RawListing = {
  externalId: string;
  society?: string;
  locality?: string;
  bhk?: number | string;
  furnishing?: string;
  areaSqft?: number | string;
  rent?: number | string;
  deposit?: number | string;
  photoCount?: number | string;
  posterType?: string;
  postedDate?: string;
  lastSeenDate?: string;
};

export interface SourceAdapter {
  readonly sourceName: string;
  fetch(query: AdapterQuery): Promise<RawListing[]>;
}

const str = (value: string | number | undefined) =>
  value === undefined ? '' : String(value);

// Normalize one source's raw rows to the shared contract, stamping provenance.
// This is the ONLY place raw adapter output becomes contract rows, so every
// producer is held to the same schema, the guarantee that scraped data matches
// the uploaded shape.
export function normalize(
  source: string,
  raws: RawListing[],
): ListingRecord[] {
  return raws.map((raw, index) => ({
    listing_id: raw.externalId || `${source}-${index + 1}`,
    source,
    posted_date: str(raw.postedDate),
    last_seen_date: str(raw.lastSeenDate),
    society: str(raw.society),
    locality: str(raw.locality),
    bhk: str(raw.bhk),
    furnishing: str(raw.furnishing),
    area_sqft: str(raw.areaSqft),
    rent: str(raw.rent),
    deposit: str(raw.deposit),
    photo_count: str(raw.photoCount),
    poster_type: str(raw.posterType),
  }));
}

// Bias resistance is a design property, not an afterthought.
//
// If a market set is built from too few independent sources, it inherits that
// source's skew. We do NOT try to "correct" the bias, we surface it: a set
// below MIN_SOURCES is flagged low-diversity, and because the market engine
// already lowers its confidence tier when portal diversity is thin, a
// single-source scrape automatically presents as *lower confidence* rather than
// a falsely clean number. The honesty machinery already built does the work.
export const MIN_SOURCES = 3;

export type AssembledSet = {
  csv: string;
  sourceCount: number;
  sourcesUsed: string[];
  rowCount: number;
  diversityOk: boolean;
  diversityNote: string;
};

export async function assembleListingSet(
  adapters: SourceAdapter[],
  query: AdapterQuery,
): Promise<AssembledSet> {
  const perSource = await Promise.all(
    adapters.map(async (adapter) => ({
      source: adapter.sourceName,
      rows: normalize(adapter.sourceName, await adapter.fetch(query)),
    })),
  );

  const contributing = perSource.filter((s) => s.rows.length > 0);
  const rows = contributing.flatMap((s) => s.rows);
  const sourcesUsed = contributing.map((s) => s.source).sort();
  const diversityOk = sourcesUsed.length >= MIN_SOURCES;

  return {
    csv: toListingCsv(rows),
    sourceCount: sourcesUsed.length,
    sourcesUsed,
    rowCount: rows.length,
    diversityOk,
    diversityNote: diversityOk
      ? `${sourcesUsed.length} independent sources, diversity sufficient.`
      : `Only ${sourcesUsed.length} source(s). Below the ${MIN_SOURCES}-source floor: treat the resulting rate as low-confidence until more portals are added.`,
  };
}
