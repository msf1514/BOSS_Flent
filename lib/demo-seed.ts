import { toListingCsv, type ListingRecord } from './ingestion/contract.ts';
import type { RunConfig } from './evidence-engine.ts';

// Demo workspace data.
//
// These are NOT hand-written run outputs. Each scenario is a realistic, noisy
// listing pull (duplicates, bait, aspirational, stale, mislabel, wrong-society
// and wrong-config rows mixed in with genuine comparables). The seed route runs
// every scenario through the SAME evidence engine a real upload uses, so the
// confidence tier and the trusted count on each demo deal are the engine's honest
// verdict on that data, not a label we chose. We tune the amount of clean
// evidence per scenario to get a spread of outcomes (HIGH, MEDIUM, LOW,
// INSUFFICIENT, and both complete and in-progress reviews); we do not fake the
// result.

const EVIDENCE_CUTOFF = '2026-08-20';
const POSTED_RECENT = '2026-06-20';
const POSTED_OLD = '2026-03-15';
// Last-seen dates that are recent enough to pass a 45-day freshness window.
const RECENT = [
  '2026-08-18', '2026-08-15', '2026-08-12', '2026-08-10', '2026-08-08',
  '2026-08-05', '2026-08-02', '2026-07-30', '2026-07-28', '2026-07-25',
  '2026-07-22', '2026-07-20',
];
const STALE = '2026-05-15';
const PORTALS = ['MagicBricks', 'NoBroker', 'Housing', '99acres', 'CommonFloor'];
const POSTERS = ['owner', 'broker', 'broker', 'builder'];

type Spec = {
  key: string;
  dealName: string;
  society: string; // full society name (its start must match societyPrefix)
  societyPrefix: string;
  locality: string;
  bhk: number;
  area: number;
  furnishing: string;
  rentCenter: number;
  // How many clean, distinct comparables to plant. This is what the engine turns
  // into the trusted count, which drives the confidence tier.
  goodCount: number;
  portals: number; // distinct sources among the clean comparables
  spread: number; // rent jitter half-width; tighter means a steadier rate
  // 'flagged' plants bait + aspirational rows that need a human call, so the
  // review stays in progress. 'clean' plants only auto-handled noise, so the
  // review can be completed.
  noise: 'flagged' | 'clean';
  complete: boolean;
};

// Realistic Bangalore rental scenarios. The goodCount / portals / spread are
// dialled so the engine lands them across the confidence tiers.
const SPECS: Spec[] = [
  {
    key: 'hsr', dealName: 'HSR Layout · Sobha City 3BHK',
    society: 'Sobha City', societyPrefix: 'Sobha City',
    locality: 'HSR Layout', bhk: 3, area: 1650, furnishing: 'fully-furnished',
    rentCenter: 92000, goodCount: 6, portals: 2, spread: 2600,
    noise: 'clean', complete: true,
  },
  {
    key: 'ind', dealName: 'Indiranagar · Purva Fountain 3BHK',
    society: 'Purva Fountain Square', societyPrefix: 'Purva Fountain',
    locality: 'Indiranagar', bhk: 3, area: 1720, furnishing: 'semi-furnished',
    rentCenter: 98000, goodCount: 9, portals: 3, spread: 1800,
    noise: 'flagged', complete: false,
  },
  {
    key: 'kor', dealName: 'Koramangala · Brigade Cornerstone 2BHK',
    society: 'Brigade Cornerstone', societyPrefix: 'Brigade Cornerstone',
    locality: 'Koramangala', bhk: 2, area: 1120, furnishing: 'semi-furnished',
    rentCenter: 61000, goodCount: 5, portals: 2, spread: 2200,
    noise: 'flagged', complete: false,
  },
  {
    key: 'bel', dealName: 'Bellandur · Adarsh Palm Retreat 2BHK',
    society: 'Adarsh Palm Retreat', societyPrefix: 'Adarsh Palm',
    locality: 'Bellandur', bhk: 2, area: 1240, furnishing: 'semi-furnished',
    rentCenter: 58000, goodCount: 4, portals: 2, spread: 3200,
    noise: 'flagged', complete: false,
  },
  {
    key: 'mar', dealName: 'Marathahalli · Gopalan Grandeur 1BHK',
    society: 'Gopalan Grandeur', societyPrefix: 'Gopalan Grandeur',
    locality: 'Marathahalli', bhk: 1, area: 650, furnishing: 'unfurnished',
    rentCenter: 27000, goodCount: 3, portals: 2, spread: 1500,
    noise: 'clean', complete: true,
  },
  {
    key: 'sar', dealName: 'Sarjapur Road · Mahaveer Ranches 2BHK',
    society: 'Mahaveer Ranches', societyPrefix: 'Mahaveer Ranches',
    locality: 'Sarjapur Road', bhk: 2, area: 1080, furnishing: 'semi-furnished',
    rentCenter: 49000, goodCount: 2, portals: 2, spread: 2800,
    noise: 'clean', complete: true,
  },
  {
    key: 'wf', dealName: 'Whitefield · Prestige Shantiniketan 2BHK',
    society: 'Prestige Shantiniketan', societyPrefix: 'Prestige Shantiniketan',
    locality: 'Whitefield', bhk: 2, area: 1180, furnishing: 'semi-furnished',
    rentCenter: 54000, goodCount: 11, portals: 4, spread: 1400,
    noise: 'clean', complete: true,
  },
];

function row(
  id: string,
  spec: Spec,
  over: Partial<ListingRecord>,
): ListingRecord {
  return {
    listing_id: id,
    source: PORTALS[0],
    posted_date: POSTED_RECENT,
    last_seen_date: RECENT[0],
    society: spec.society,
    locality: spec.locality,
    bhk: String(spec.bhk),
    furnishing: spec.furnishing,
    area_sqft: String(spec.area),
    rent: String(spec.rentCenter),
    deposit: String(spec.rentCenter * 3),
    photo_count: '6',
    poster_type: 'broker',
    ...over,
  };
}

function buildListings(spec: Spec): ListingRecord[] {
  const out: ListingRecord[] = [];
  // Clean, distinct comparables. Deterministic jitter keeps the rate steady but
  // not identical; each gets a distinct deposit so they are not dedup-collapsed.
  for (let i = 0; i < spec.goodCount; i += 1) {
    const rentJ = spec.rentCenter + (((i * 37) % (2 * spec.spread)) - spec.spread);
    const areaJ = spec.area + (((i * 17) % 100) - 50);
    out.push(
      row(`${spec.key}-G${String(i + 1).padStart(2, '0')}`, spec, {
        source: PORTALS[i % spec.portals],
        last_seen_date: RECENT[i % RECENT.length],
        area_sqft: String(areaJ),
        rent: String(Math.round(rentJ / 500) * 500),
        deposit: String(spec.rentCenter * 3 + i * 3500),
        poster_type: POSTERS[i % POSTERS.length],
        photo_count: String(4 + (i % 9)),
      }),
    );
  }
  // Two cross-post duplicates of the first two comps: same config, same area,
  // IDENTICAL deposit, different portal. The engine collapses these to one.
  for (let i = 0; i < Math.min(2, spec.goodCount); i += 1) {
    const g = out[i];
    out.push(
      row(`${spec.key}-D${i + 1}`, spec, {
        source: PORTALS[(i + spec.portals) % PORTALS.length],
        last_seen_date: RECENT[(i + 1) % RECENT.length],
        area_sqft: g.area_sqft,
        rent: String(Number(g.rent) + 500),
        deposit: g.deposit,
        poster_type: 'broker',
      }),
    );
  }
  // Two stale rows (rented weeks ago, still live): match otherwise, excluded on age.
  for (let i = 0; i < 2; i += 1) {
    out.push(
      row(`${spec.key}-S${i + 1}`, spec, {
        source: PORTALS[(i + 1) % PORTALS.length],
        posted_date: POSTED_OLD,
        last_seen_date: STALE,
        rent: String(spec.rentCenter + 1000),
        deposit: String(spec.rentCenter * 3 + 90000 + i * 1000),
      }),
    );
  }
  // Wrong society and wrong config: excluded from the reference set.
  out.push(
    row(`${spec.key}-X1`, spec, {
      society: 'Unrelated Enclave',
      source: 'CommonFloor',
      last_seen_date: RECENT[3],
      deposit: String(spec.rentCenter * 3 + 12345),
    }),
  );
  out.push(
    row(`${spec.key}-X2`, spec, {
      bhk: String(spec.bhk + 1),
      area_sqft: String(spec.area + 500),
      rent: String(Math.round(spec.rentCenter * 1.4)),
      source: '99acres',
      last_seen_date: RECENT[4],
      deposit: String(spec.rentCenter * 3 + 54321),
    }),
  );
  // Flagged prices, only for scenarios meant to stay in review.
  if (spec.noise === 'flagged') {
    out.push(
      row(`${spec.key}-B1`, spec, {
        source: 'NoBroker',
        last_seen_date: RECENT[2],
        rent: String(Math.round(spec.rentCenter * 0.32)),
        deposit: String(spec.rentCenter * 3 + 4321),
        poster_type: 'broker',
      }),
    );
    out.push(
      row(`${spec.key}-A1`, spec, {
        source: 'Housing',
        last_seen_date: RECENT[1],
        rent: String(Math.round(spec.rentCenter * 2.15)),
        deposit: String(spec.rentCenter * 3 + 6789),
        poster_type: 'owner',
      }),
    );
  }
  return out;
}

export type DemoDeal = {
  key: string;
  dealName: string;
  filename: string;
  config: RunConfig;
  csv: string;
  complete: boolean;
};

export function demoDeals(): DemoDeal[] {
  return SPECS.map((spec) => ({
    key: spec.key,
    dealName: spec.dealName,
    filename: `${spec.key}-${spec.locality.toLowerCase().replace(/\s+/g, '-')}.csv`,
    complete: spec.complete,
    config: {
      dealName: spec.dealName,
      evidenceCutoff: EVIDENCE_CUTOFF,
      societyPrefix: spec.societyPrefix,
      bhk: spec.bhk,
      areaSqft: spec.area,
      furnishing: spec.furnishing,
      landlordBaseRent: 0,
      landlordMaintenance: 0,
      landlordDeposit: 0,
      improvementCapex: 0,
      areaToleranceSqft: 130,
      maxLastSeenAgeDays: 45,
    },
    csv: toListingCsv(buildListings(spec)),
  }));
}
