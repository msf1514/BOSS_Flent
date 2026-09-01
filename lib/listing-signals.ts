// Pure, deterministic listing-trust signals for Problem 1.
//
// Every function here is a plain function of its inputs — same inputs, same
// output, no IO — so the market engine stays reproducible and every flag it
// raises can be explained to a human reviewing listing-by-listing. Thresholds
// are named constants with a rationale, per the brief's instruction to "choose
// sensible numbers and explain why". None of these detectors delete a row; they
// attach a reason. A human decides. (Brief: "a human should be able to inspect
// the result listing by listing and disagree with it.")

export type SignalRow = {
  listingId: string;
  bhk: number | null;
  area: number | null;
  rent: number;
  deposit: number | null;
  furnishing: string;
  source: string;
  posterType: string;
  lastSeen: number; // epoch ms
};

// --- Fuzzy duplicate clustering -------------------------------------------
// The same physical flat is cross-posted on several portals, often with the
// society name spelled differently and sometimes at a slightly different rent.
// Exact-field matching misses these. We treat two rows as the same unit when
// they share configuration and built-up area AND carry an identical, specific
// security deposit — a deposit is a precise rupee figure that is very unlikely
// to collide by chance between two genuinely distinct units. Rent is allowed to
// differ, because the brief explicitly describes "the same flat posted by
// several brokers at different rents".
export const DUP_AREA_TOLERANCE_SQFT = 25;

function sameUnit(a: SignalRow, b: SignalRow): boolean {
  return (
    a.bhk !== null &&
    a.bhk === b.bhk &&
    a.furnishing === b.furnishing &&
    a.area !== null &&
    b.area !== null &&
    Math.abs(a.area - b.area) <= DUP_AREA_TOLERANCE_SQFT &&
    a.deposit !== null &&
    b.deposit !== null &&
    a.deposit === b.deposit
  );
}

// Owner-posted, then freshest, then lowest id wins as the kept representative —
// an owner listing is closer to source than a broker cross-post.
function posterRank(posterType: string): number {
  const p = posterType.toLowerCase();
  if (p === 'owner') return 0;
  if (p === 'broker') return 1;
  return 2;
}

function representativeOf(group: SignalRow[]): SignalRow {
  return [...group].sort(
    (a, b) =>
      posterRank(a.posterType) - posterRank(b.posterType) ||
      b.lastSeen - a.lastSeen ||
      a.listingId.localeCompare(b.listingId),
  )[0];
}

export type DuplicateCluster = {
  clusterId: string;
  representativeId: string;
  memberIds: string[];
};

// Union-find over the eligible rows. O(n^2) pairwise is fine at the exercise's
// bounded row count and keeps the rule transparent rather than hiding it inside
// a blocking key.
export function clusterDuplicates(rows: SignalRow[]): DuplicateCluster[] {
  const parent = new Map<string, string>();
  rows.forEach((r) => parent.set(r.listingId, r.listingId));
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root) as string;
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur) as string;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (x: string, y: string) => parent.set(find(x), find(y));

  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length; j++)
      if (sameUnit(rows[i], rows[j]))
        union(rows[i].listingId, rows[j].listingId);

  const byRoot = new Map<string, SignalRow[]>();
  for (const row of rows) {
    const root = find(row.listingId);
    byRoot.set(root, [...(byRoot.get(root) ?? []), row]);
  }

  const clusters: DuplicateCluster[] = [];
  for (const group of byRoot.values()) {
    if (group.length < 2) continue;
    const rep = representativeOf(group);
    const memberIds = group
      .map((r) => r.listingId)
      .sort((a, b) => a.localeCompare(b));
    // Deterministic cluster id derived from its sorted members.
    clusters.push({
      clusterId: `DUP-${memberIds.join('|')}`,
      representativeId: rep.listingId,
      memberIds,
    });
  }
  return clusters.sort((a, b) => a.clusterId.localeCompare(b.clusterId));
}

// --- Price-plausibility signals -------------------------------------------
// Bait: a price posted to harvest enquiries for a unit that does not really
// exist at that rent. Aspirational: a landlord's optimistic ask that never
// transacts. Both are measured against a robust centre (the median of the
// same-configuration comparable set) so a thin or skewed sample does not move
// the threshold as much as a mean would.
export const BAIT_FLOOR_FACTOR = 0.6; // < 60% of centre → suspected bait
export const ASPIRATIONAL_CEILING_FACTOR = 1.4; // > 140% of centre → suspected aspirational

export function priceSignal(
  rent: number,
  centre: number | null,
): 'suspected_bait_price' | 'suspected_aspirational_ask' | null {
  if (centre === null || centre <= 0) return null;
  if (rent < centre * BAIT_FLOOR_FACTOR) return 'suspected_bait_price';
  if (rent > centre * ASPIRATIONAL_CEILING_FACTOR)
    return 'suspected_aspirational_ask';
  return null;
}

// --- Mislabel signals ------------------------------------------------------
// A row can wear the wrong label: a 3BHK that is really this 2BHK copied over,
// or a "1BHK" at an impossible area. Two deterministic checks:
//  1. Implausible area-per-bedroom (independent of the subject deal).
//  2. A configuration that differs from the subject yet whose area AND rent sit
//     squarely inside the subject's comparable band — i.e. it looks like the
//     subject in disguise.
export const MIN_AREA_PER_BHK = 300;
export const MAX_AREA_PER_BHK = 1200;

export function areaPerBhkImplausible(
  bhk: number | null,
  area: number | null,
): boolean {
  if (bhk === null || bhk <= 0 || area === null || area <= 0) return false;
  const perRoom = area / bhk;
  return perRoom < MIN_AREA_PER_BHK || perRoom > MAX_AREA_PER_BHK;
}

export function looksLikeSubjectInDisguise(input: {
  bhk: number | null;
  area: number | null;
  rent: number;
  subjectBhk: number;
  subjectArea: number;
  subjectAreaTolerance: number;
  comparableLow: number | null;
  comparableHigh: number | null;
}): boolean {
  if (input.bhk === null || input.bhk === input.subjectBhk) return false;
  if (input.area === null) return false;
  const areaInBand =
    Math.abs(input.area - input.subjectArea) <= input.subjectAreaTolerance;
  const rentInBand =
    input.comparableLow !== null &&
    input.comparableHigh !== null &&
    input.rent >= input.comparableLow &&
    input.rent <= input.comparableHigh;
  return areaInBand && rentInBand;
}
