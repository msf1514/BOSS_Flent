export const ENGINE_VERSION = '2.0.0';
export const SCHEMA_VERSION = '1.0.0';
export const MAX_CSV_ROWS = 500;

export const requiredColumns = [
  'listing_id',
  'source',
  'posted_date',
  'last_seen_date',
  'society',
  'locality',
  'bhk',
  'furnishing',
  'area_sqft',
  'rent',
  'deposit',
  'photo_count',
  'poster_type',
] as const;

export type RunConfig = {
  dealName: string;
  evidenceCutoff: string;
  societyPrefix: string;
  bhk: number;
  areaSqft: number;
  furnishing: string;
  landlordBaseRent: number;
  landlordMaintenance: number;
  landlordDeposit: number;
  improvementCapex: number;
  areaToleranceSqft: number;
  maxLastSeenAgeDays: number;
};

export type EngineAnnotations = Record<string, string[]>;

export type ValidationIssue = {
  rowNumber: number | null;
  listingId?: string;
  severity: 'error' | 'warning';
  code: string;
  field?: string;
  message: string;
};

export type ReviewOverride = {
  listingId: string;
  decision: 'include' | 'exclude' | 'defer';
  reason: string;
};

export type AuditRow = {
  listingId: string;
  sourceRowNumber: number;
  observed: Record<string, string | number | null>;
  normalized: {
    societyFamily: string;
    furnishing: string;
    lastSeenAgeDays: number;
  };
  b0State: 'include' | 'exclude';
  b1State: 'include' | 'exclude' | 'duplicate_collapsed';
  b2State: 'include' | 'exclude' | 'duplicate_collapsed' | 'needs_human_review';
  effectiveWeight: number;
  duplicateGroup: string | null;
  representativeListingId: string | null;
  reasons: string[];
  appliedOverride: ReviewOverride | null;
};

export type EngineResult = {
  validation: {
    rawRows: number;
    acceptedRows: number;
    rejectedRows: number;
    warningCount: number;
    errorCount: number;
    issues: ValidationIssue[];
  };
  rows: AuditRow[];
  summary: {
    inputRows: number;
    baselines: {
      B0: { count: number; estimate: number | null };
      B1: { count: number; estimate: number | null };
      B2: { count: number; estimate: number | null };
    };
    band: {
      p25: number | null;
      p75: number | null;
      minimum: number | null;
      maximum: number | null;
    };
    stateCounts: Record<string, number>;
    observedPortalLabelCount: number;
    maximumLeaveOneOutMovementPct: number | null;
    askingEvidenceConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
    achievableBaseRentConfidence: 'LOW';
    limitations: string[];
    decisionBoundary: string;
  };
};

type ParsedRow = Record<string, string> & {
  __rowNumber: string;
};

const normalizeText = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '');
const normalizeFurnishing = (value: string) =>
  ({
    semifurnished: 'semi-furnished',
    fullyfurnished: 'fully-furnished',
    unfurnished: 'unfurnished',
  })[normalizeText(value)] ?? normalizeText(value);
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};
const percentile = (values: number[], fraction: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return lower === upper
    ? sorted[lower]
    : sorted[lower] * (upper - position) + sorted[upper] * (position - lower);
};

export function parseCsv(csv: string): {
  headers: string[];
  rows: ParsedRow[];
  issues: ValidationIssue[];
} {
  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    if (quoted) {
      if (char === '"' && csv[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/, ''));
      matrix.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (quoted)
    return {
      headers: [],
      rows: [],
      issues: [
        {
          rowNumber: null,
          severity: 'error',
          code: 'invalid_csv',
          message: 'The CSV contains an unclosed quoted value.',
        },
      ],
    };
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''));
    matrix.push(row);
  }
  const headers = (matrix.shift() ?? []).map((value, index) =>
    index === 0 ? value.replace(/^\uFEFF/, '').trim() : value.trim(),
  );
  const issues: ValidationIssue[] = [];
  const seenHeaders = new Set<string>();
  for (const header of headers) {
    if (seenHeaders.has(header))
      issues.push({
        rowNumber: null,
        severity: 'error',
        code: 'duplicate_header',
        field: header,
        message: `Column ${header} appears more than once.`,
      });
    seenHeaders.add(header);
  }
  for (const column of requiredColumns)
    if (!headers.includes(column))
      issues.push({
        rowNumber: null,
        severity: 'error',
        code: 'missing_header',
        field: column,
        message: `Required column ${column} is missing.`,
      });
  const rows = matrix
    .filter((cells) => cells.some((value) => value.trim()))
    .map((cells, index) => {
      const record: ParsedRow = { __rowNumber: String(index + 2) };
      headers.forEach((header, columnIndex) => {
        record[header] = cells[columnIndex]?.trim() ?? '';
      });
      return record;
    });
  if (!rows.length)
    issues.push({
      rowNumber: null,
      severity: 'error',
      code: 'empty_dataset',
      message: 'The CSV contains no data rows.',
    });
  if (rows.length > MAX_CSV_ROWS)
    issues.push({
      rowNumber: null,
      severity: 'error',
      code: 'row_limit_exceeded',
      message: `This pilot supports up to ${MAX_CSV_ROWS} data rows per run.`,
    });
  return { headers, rows, issues };
}

const dateValue = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? timestamp
    : null;
};
const integerValue = (value: string) =>
  /^-?\d+$/.test(value) ? Number(value) : null;
const canonicalHash = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  )
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

export async function sha256(value: string) {
  return canonicalHash(value);
}

export async function runEvidenceEngine(
  csv: string,
  config: RunConfig,
  overrides: ReviewOverride[] = [],
  annotations: EngineAnnotations = {},
): Promise<EngineResult> {
  const parsed = parseCsv(csv);
  const issues = [...parsed.issues];
  const cutoff = dateValue(config.evidenceCutoff);
  if (!cutoff)
    issues.push({
      rowNumber: null,
      severity: 'error',
      code: 'invalid_cutoff',
      field: 'evidenceCutoff',
      message: 'Evidence cutoff must be a valid ISO date.',
    });
  if (!config.societyPrefix.trim())
    issues.push({
      rowNumber: null,
      severity: 'error',
      code: 'missing_subject',
      field: 'societyPrefix',
      message: 'Society match prefix is required.',
    });
  if (
    issues.some((item) => item.rowNumber === null && item.severity === 'error')
  )
    return emptyResult(parsed.rows.length, issues);
  const ids = new Set<string>();
  const accepted: Array<{
    raw: ParsedRow;
    bhk: number;
    area: number | null;
    rent: number;
    deposit: number | null;
    photoCount: number | null;
    posted: number;
    lastSeen: number;
    furnishing: string;
    societyFamily: string;
    age: number;
  }> = [];
  const cutoffValue = cutoff ?? 0;
  for (const raw of parsed.rows) {
    const rowNumber = Number(raw.__rowNumber);
    const listingId = raw.listing_id;
    let rejected = false;
    const error = (code: string, field: string, message: string) => {
      issues.push({
        rowNumber,
        listingId,
        severity: 'error',
        code,
        field,
        message,
      });
      rejected = true;
    };
    if (!listingId)
      error('missing_required_value', 'listing_id', 'Listing ID is required.');
    else if (ids.has(listingId))
      error(
        'duplicate_listing_id',
        'listing_id',
        `Listing ID ${listingId} is duplicated.`,
      );
    ids.add(listingId);
    for (const field of [
      'source',
      'posted_date',
      'last_seen_date',
      'society',
      'bhk',
      'furnishing',
      'rent',
    ])
      if (!raw[field])
        error('missing_required_value', field, `${field} is required.`);
    const bhk = integerValue(raw.bhk);
    const rent = integerValue(raw.rent);
    const area = raw.area_sqft ? integerValue(raw.area_sqft) : null;
    const deposit = raw.deposit ? integerValue(raw.deposit) : null;
    const photoCount = raw.photo_count ? integerValue(raw.photo_count) : null;
    const posted = dateValue(raw.posted_date);
    const lastSeen = dateValue(raw.last_seen_date);
    if (bhk === null || bhk <= 0)
      error(
        'invalid_positive_integer',
        'bhk',
        'BHK must be a positive integer.',
      );
    if (rent === null || rent <= 0)
      error(
        'invalid_positive_integer',
        'rent',
        'Rent must be a positive integer.',
      );
    if (raw.area_sqft && (area === null || area <= 0))
      error(
        'invalid_positive_integer',
        'area_sqft',
        'Area must be a positive integer when supplied.',
      );
    if (raw.deposit && (deposit === null || deposit < 0))
      error(
        'invalid_nonnegative_integer',
        'deposit',
        'Deposit must be non-negative when supplied.',
      );
    if (raw.photo_count && (photoCount === null || photoCount < 0))
      error(
        'invalid_nonnegative_integer',
        'photo_count',
        'Photo count must be non-negative when supplied.',
      );
    if (posted === null)
      error('invalid_date', 'posted_date', 'Posted date must use YYYY-MM-DD.');
    if (lastSeen === null)
      error(
        'invalid_date',
        'last_seen_date',
        'Last-seen date must use YYYY-MM-DD.',
      );
    if (lastSeen !== null && cutoff !== null && lastSeen > cutoff)
      error(
        'future_last_seen',
        'last_seen_date',
        'Last-seen date cannot be after the evidence cutoff.',
      );
    if (posted !== null && lastSeen !== null && posted > lastSeen)
      issues.push({
        rowNumber,
        listingId,
        severity: 'warning',
        code: 'date_sequence_conflict',
        field: 'posted_date',
        message:
          'Posted date is after last-seen date; review source chronology.',
      });
    if (!raw.area_sqft)
      issues.push({
        rowNumber,
        listingId,
        severity: 'warning',
        code: 'missing_optional_area',
        field: 'area_sqft',
        message:
          'Area is missing; the row will be retained but excluded from comparables.',
      });
    const furnishing = normalizeFurnishing(raw.furnishing);
    if (
      !['semi-furnished', 'fully-furnished', 'unfurnished'].includes(furnishing)
    )
      issues.push({
        rowNumber,
        listingId,
        severity: 'warning',
        code: 'unknown_furnishing',
        field: 'furnishing',
        message: 'Furnishing value is not in the recognized normalization set.',
      });
    if (
      !rejected &&
      bhk !== null &&
      rent !== null &&
      posted !== null &&
      lastSeen !== null
    )
      accepted.push({
        raw,
        bhk,
        area,
        rent,
        deposit,
        photoCount,
        posted,
        lastSeen,
        furnishing,
        societyFamily: normalizeText(raw.society),
        age: Math.floor((cutoffValue - lastSeen) / 86400000),
      });
  }
  const fileBlocking = issues.some(
    (item) => item.rowNumber === null && item.severity === 'error',
  );
  if (fileBlocking) return emptyResult(parsed.rows.length, issues);
  const subjectFurnishing = normalizeFurnishing(config.furnishing);
  const targetPrefix = normalizeText(config.societyPrefix);
  const overrideMap = new Map(overrides.map((item) => [item.listingId, item]));
  const base = accepted.map((item) => {
    const reasons: string[] = [];
    if (item.bhk !== config.bhk) reasons.push('bhk_mismatch');
    if (item.area === null) reasons.push('missing_required_field');
    else if (Math.abs(item.area - config.areaSqft) > config.areaToleranceSqft)
      reasons.push('area_outside_band');
    if (item.furnishing !== subjectFurnishing)
      reasons.push('furnishing_mismatch');
    if (!item.societyFamily.startsWith(targetPrefix))
      reasons.push('society_not_target_family');
    if (item.age > config.maxLastSeenAgeDays) reasons.push('old_last_seen');
    return {
      item,
      reasons,
      b0State: (item.bhk === config.bhk
        ? 'include'
        : 'exclude') as AuditRow['b0State'],
      b1State: (reasons.length ? 'exclude' : 'include') as AuditRow['b1State'],
      duplicateGroup: null as string | null,
      representativeListingId: null as string | null,
    };
  });
  const eligible = base.filter((row) => row.b1State === 'include');
  const groups = new Map<string, typeof eligible>();
  for (const row of eligible) {
    const key = JSON.stringify([
      row.item.raw.posted_date,
      row.item.raw.last_seen_date,
      row.item.bhk,
      row.item.furnishing,
      row.item.area,
      row.item.rent,
      row.item.deposit,
      row.item.societyFamily,
    ]);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  for (const [key, group] of groups) {
    group.sort((a, b) =>
      a.item.raw.listing_id.localeCompare(b.item.raw.listing_id),
    );
    if (group.length > 1) {
      const groupId = `DUP-${(await canonicalHash(key)).slice(0, 8).toUpperCase()}`;
      group.forEach((row, index) => {
        row.duplicateGroup = groupId;
        row.representativeListingId = group[0].item.raw.listing_id;
        if (index > 0) {
          row.b1State = 'duplicate_collapsed';
          row.reasons.push('possible_duplicate');
        }
      });
    } else group[0].representativeListingId = group[0].item.raw.listing_id;
  }
  const b1 = base.filter((row) => row.b1State === 'include');
  const center = b1.length ? median(b1.map((row) => row.item.rent)) : null;
  const rows: AuditRow[] = base
    .map((row) => {
      let b2State: AuditRow['b2State'] =
        row.b1State === 'include'
          ? 'include'
          : row.b1State === 'duplicate_collapsed'
            ? 'duplicate_collapsed'
            : 'exclude';
      if (
        center !== null &&
        row.b1State === 'include' &&
        (row.item.rent < center * 0.5 || row.item.rent > center * 1.75)
      ) {
        b2State = 'needs_human_review';
        row.reasons.push('extreme_value_review');
      }
      const sourceAnnotations = annotations[row.item.raw.listing_id] ?? [];
      if (sourceAnnotations.length) {
        b2State = 'needs_human_review';
        row.reasons.push(...sourceAnnotations);
      }
      const appliedOverride = overrideMap.get(row.item.raw.listing_id) ?? null;
      if (appliedOverride?.decision === 'include') b2State = 'include';
      if (appliedOverride?.decision === 'exclude') b2State = 'exclude';
      if (appliedOverride?.decision === 'defer') b2State = 'needs_human_review';
      const { __rowNumber: _sourceRow, ...rawObserved } = row.item.raw;
      return {
        listingId: row.item.raw.listing_id,
        sourceRowNumber: Number(row.item.raw.__rowNumber),
        observed: {
          ...rawObserved,
          bhk: row.item.bhk,
          areaSqft: row.item.area,
          rent: row.item.rent,
          deposit: row.item.deposit,
        },
        normalized: {
          societyFamily: row.item.societyFamily,
          furnishing: row.item.furnishing,
          lastSeenAgeDays: row.item.age,
        },
        b0State: row.b0State,
        b1State: row.b1State,
        b2State,
        effectiveWeight: b2State === 'include' ? 1 : 0,
        duplicateGroup: row.duplicateGroup,
        representativeListingId: row.representativeListingId,
        reasons: [...new Set(row.reasons)],
        appliedOverride,
      };
    })
    .sort((a, b) => a.listingId.localeCompare(b.listingId));
  const b0Values = accepted
    .filter((row) => row.bhk === config.bhk)
    .map((row) => row.rent);
  const b1Values = base
    .filter((row) => row.b1State === 'include')
    .map((row) => row.item.rent);
  const b2Rows = rows.filter((row) => row.b2State === 'include');
  const b2Values = b2Rows.map((row) => Number(row.observed.rent));
  const b2Estimate = b2Values.length ? median(b2Values) : null;
  let movement: number | null = null;
  if (b2Values.length >= 2 && b2Estimate)
    movement = Math.max(
      ...b2Values.map(
        (_, index) =>
          (Math.abs(
            median(b2Values.filter((__, idx) => idx !== index)) - b2Estimate,
          ) /
            b2Estimate) *
          100,
      ),
    );
  const portalCount = new Set(
    b2Rows.map((row) => normalizeText(String(row.observed.source))),
  ).size;
  const confidence =
    movement === null
      ? 'INSUFFICIENT'
      : b2Values.length >= 8 && portalCount >= 3 && movement <= 2.5
        ? 'HIGH'
        : b2Values.length >= 5 && portalCount >= 2 && movement <= 5
          ? 'MEDIUM'
          : b2Values.length >= 3 && movement <= 10
            ? 'LOW'
            : 'INSUFFICIENT';
  const stateCounts = rows.reduce<Record<string, number>>(
    (counts, row) => ({
      ...counts,
      [row.b2State]: (counts[row.b2State] ?? 0) + 1,
    }),
    {},
  );
  return {
    validation: {
      rawRows: parsed.rows.length,
      acceptedRows: accepted.length,
      rejectedRows: parsed.rows.length - accepted.length,
      warningCount: issues.filter((item) => item.severity === 'warning').length,
      errorCount: issues.filter((item) => item.severity === 'error').length,
      issues,
    },
    rows,
    summary: {
      inputRows: parsed.rows.length,
      baselines: {
        B0: {
          count: b0Values.length,
          estimate: b0Values.length ? median(b0Values) : null,
        },
        B1: {
          count: b1Values.length,
          estimate: b1Values.length ? median(b1Values) : null,
        },
        B2: { count: b2Values.length, estimate: b2Estimate },
      },
      band: {
        p25: b2Values.length ? percentile(b2Values, 0.25) : null,
        p75: b2Values.length ? percentile(b2Values, 0.75) : null,
        minimum: b2Values.length ? Math.min(...b2Values) : null,
        maximum: b2Values.length ? Math.max(...b2Values) : null,
      },
      stateCounts,
      observedPortalLabelCount: portalCount,
      maximumLeaveOneOutMovementPct:
        movement === null ? null : Math.round(movement * 1000) / 1000,
      askingEvidenceConfidence: confidence,
      achievableBaseRentConfidence: 'LOW',
      limitations: [
        'Listing rents do not reliably state whether maintenance is included.',
        'Asking rent is not achieved rent.',
        'Duplicate candidates are observable-field inferences, not ground truth.',
      ],
      decisionBoundary:
        'This engine estimates market evidence. It does not recommend ACQUIRE, NEGOTIATE, HOLD or PASS.',
    },
  };
}

function emptyResult(rawRows: number, issues: ValidationIssue[]): EngineResult {
  return {
    validation: {
      rawRows,
      acceptedRows: 0,
      rejectedRows: rawRows,
      warningCount: issues.filter((item) => item.severity === 'warning').length,
      errorCount: issues.filter((item) => item.severity === 'error').length,
      issues,
    },
    rows: [],
    summary: {
      inputRows: rawRows,
      baselines: {
        B0: { count: 0, estimate: null },
        B1: { count: 0, estimate: null },
        B2: { count: 0, estimate: null },
      },
      band: { p25: null, p75: null, minimum: null, maximum: null },
      stateCounts: {},
      observedPortalLabelCount: 0,
      maximumLeaveOneOutMovementPct: null,
      askingEvidenceConfidence: 'INSUFFICIENT',
      achievableBaseRentConfidence: 'LOW',
      limitations: ['The supplied input did not pass validation.'],
      decisionBoundary: 'No decision output was produced.',
    },
  };
}
