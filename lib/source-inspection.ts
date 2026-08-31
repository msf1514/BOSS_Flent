import {
  parseCsv,
  requiredColumns,
  sha256,
  type ValidationIssue,
} from './evidence-engine.ts';

export type DistributionValue = { value: string; count: number };

export type SourceInspection = {
  filename: string;
  sizeBytes: number;
  inputHash: string;
  rowCount: number;
  headerCount: number;
  requiredColumnCount: number;
  validStructure: boolean;
  issues: ValidationIssue[];
  dateRange: { postedFrom: string | null; lastSeenTo: string | null };
  areaRange: { minimum: number | null; maximum: number | null };
  rentRange: { minimum: number | null; maximum: number | null };
  societies: DistributionValue[];
  localities: DistributionValue[];
  bhks: DistributionValue[];
  furnishing: DistributionValue[];
  suggestions: {
    evidenceCutoff: string | null;
    societyPrefix: string | null;
  };
};

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const positiveInteger = /^\d+$/;

function distribution(values: string[]): DistributionValue[] {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const value = raw.trim();
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, 8);
}

function numberRange(values: string[]) {
  const numbers = values
    .filter((value) => positiveInteger.test(value) && Number(value) > 0)
    .map(Number);
  return {
    minimum: numbers.length ? Math.min(...numbers) : null,
    maximum: numbers.length ? Math.max(...numbers) : null,
  };
}

export async function inspectEvidenceSource(input: {
  filename: string;
  sizeBytes: number;
  csv: string;
}): Promise<SourceInspection> {
  const parsed = parseCsv(input.csv);
  const postedDates = parsed.rows
    .map((row) => row.posted_date)
    .filter((value) => isoDate.test(value))
    .sort();
  const lastSeenDates = parsed.rows
    .map((row) => row.last_seen_date)
    .filter((value) => isoDate.test(value))
    .sort();
  const societies = distribution(parsed.rows.map((row) => row.society));

  return {
    filename: input.filename,
    sizeBytes: input.sizeBytes,
    inputHash: await sha256(input.csv),
    rowCount: parsed.rows.length,
    headerCount: parsed.headers.length,
    requiredColumnCount: requiredColumns.length,
    validStructure: !parsed.issues.some((issue) => issue.severity === 'error'),
    issues: parsed.issues,
    dateRange: {
      postedFrom: postedDates[0] ?? null,
      lastSeenTo: lastSeenDates.at(-1) ?? null,
    },
    areaRange: numberRange(parsed.rows.map((row) => row.area_sqft)),
    rentRange: numberRange(parsed.rows.map((row) => row.rent)),
    societies,
    localities: distribution(parsed.rows.map((row) => row.locality)),
    bhks: distribution(parsed.rows.map((row) => row.bhk)),
    furnishing: distribution(parsed.rows.map((row) => row.furnishing)),
    suggestions: {
      evidenceCutoff: lastSeenDates.at(-1) ?? null,
      societyPrefix: societies[0]?.value ?? null,
    },
  };
}
