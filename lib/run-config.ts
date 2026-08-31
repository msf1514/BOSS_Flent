import type { RunConfig } from '@/lib/evidence-engine';

export type ConfigIssue = {
  field: keyof RunConfig | 'config';
  message: string;
};
export type ConfigParseResult =
  | { ok: true; value: RunConfig }
  | { ok: false; issues: ConfigIssue[] };

const exactDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

export function parseRunConfig(input: unknown): ConfigParseResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      issues: [
        { field: 'config', message: 'Run configuration must be an object.' },
      ],
    };
  }
  const raw = input as Record<string, unknown>;
  const issues: ConfigIssue[] = [];
  const text = (field: keyof RunConfig, max: number) => {
    const value = typeof raw[field] === 'string' ? raw[field].trim() : '';
    if (!value) issues.push({ field, message: 'This field is required.' });
    else if (value.length > max)
      issues.push({ field, message: `Must be ${max} characters or fewer.` });
    return value;
  };
  const integer = (
    field: keyof RunConfig,
    minimum: number,
    maximum: number,
  ) => {
    const value = raw[field];
    if (
      typeof value !== 'number' ||
      !Number.isSafeInteger(value) ||
      value < minimum ||
      value > maximum
    ) {
      issues.push({
        field,
        message: `Must be a whole number from ${minimum.toLocaleString()} to ${maximum.toLocaleString()}.`,
      });
      return minimum;
    }
    return value;
  };

  const dealName = text('dealName', 120);
  const evidenceCutoff = text('evidenceCutoff', 10);
  const societyPrefix = text('societyPrefix', 100);
  const furnishing = text('furnishing', 40);
  if (evidenceCutoff && !exactDate(evidenceCutoff)) {
    issues.push({
      field: 'evidenceCutoff',
      message: 'Use a real calendar date in YYYY-MM-DD format.',
    });
  }
  if (
    furnishing &&
    !['semi-furnished', 'fully-furnished', 'unfurnished'].includes(furnishing)
  ) {
    issues.push({
      field: 'furnishing',
      message: 'Choose a supported furnishing category.',
    });
  }

  const value: RunConfig = {
    dealName,
    evidenceCutoff,
    societyPrefix,
    furnishing,
    bhk: integer('bhk', 1, 10),
    areaSqft: integer('areaSqft', 100, 10_000),
    landlordBaseRent: integer('landlordBaseRent', 1, 10_000_000),
    landlordMaintenance: integer('landlordMaintenance', 0, 1_000_000),
    landlordDeposit: integer('landlordDeposit', 0, 100_000_000),
    improvementCapex: integer('improvementCapex', 0, 100_000_000),
    areaToleranceSqft: integer('areaToleranceSqft', 0, 2_000),
    maxLastSeenAgeDays: integer('maxLastSeenAgeDays', 1, 365),
  };
  return issues.length ? { ok: false, issues } : { ok: true, value };
}
