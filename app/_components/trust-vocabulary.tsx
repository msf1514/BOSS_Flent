'use client';

import {
  AlertTriangle,
  CalendarClock,
  CircleHelp,
  Copy,
  Ruler,
  ShieldCheck,
  Tag,
  TriangleAlert,
} from 'lucide-react';

// The trust vocabulary, in one place. Every reason code the engine can attach to
// a listing maps to a plain-language label, a short "what it means", a tone and
// an icon. This is what turns "preserve the reason behind every decision" from a
// hidden string into a scannable, coloured cue the user sees at a glance.

type Tone = 'neutral' | 'caution' | 'danger' | 'trust';

const TONE_CLASS: Record<Tone, string> = {
  trust: 'border-teal-200 bg-teal-50 text-teal-900',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  caution: 'border-amber-200 bg-amber-50 text-amber-900',
  danger: 'border-red-200 bg-red-50 text-red-800',
};

type ReasonMeta = {
  label: string;
  meaning: string;
  tone: Tone;
  icon: typeof Copy;
};

export const REASON_META: Record<string, ReasonMeta> = {
  cross_post_duplicate: {
    label: 'Duplicate',
    meaning:
      'The same flat re-posted on another portal. Kept once so it can’t inflate the sample.',
    tone: 'neutral',
    icon: Copy,
  },
  suspected_bait_price: {
    label: 'Bait price',
    meaning:
      'Priced far below the market to harvest enquiries. Pulled out of the rate.',
    tone: 'danger',
    icon: TriangleAlert,
  },
  suspected_aspirational_ask: {
    label: 'Aspirational ask',
    meaning:
      'Priced far above the market — an optimistic ask that rarely transacts.',
    tone: 'caution',
    icon: AlertTriangle,
  },
  suspected_mislabel_configuration: {
    label: 'Mislabelled',
    meaning:
      'Wears a different BHK label but looks like this home — likely a wrong-label copy.',
    tone: 'caution',
    icon: Tag,
  },
  implausible_area_for_bhk: {
    label: 'Impossible area',
    meaning: 'Floor area per bedroom is physically implausible for this config.',
    tone: 'caution',
    icon: Ruler,
  },
  old_last_seen: {
    label: 'Stale',
    meaning: 'Not seen recently enough — likely already rented.',
    tone: 'neutral',
    icon: CalendarClock,
  },
  bhk_mismatch: {
    label: 'Different size',
    meaning: 'A different BHK than the home being priced.',
    tone: 'neutral',
    icon: Ruler,
  },
  area_outside_band: {
    label: 'Area off',
    meaning: 'Floor area outside the comparable band for this home.',
    tone: 'neutral',
    icon: Ruler,
  },
  furnishing_mismatch: {
    label: 'Furnishing differs',
    meaning: 'A different furnishing level than the home being priced.',
    tone: 'neutral',
    icon: Tag,
  },
  society_not_target_family: {
    label: 'Different society',
    meaning: 'Not in the target society/cluster for this home.',
    tone: 'neutral',
    icon: Tag,
  },
  missing_required_field: {
    label: 'Missing data',
    meaning: 'A required field was blank, so it can’t be trusted as evidence.',
    tone: 'neutral',
    icon: CircleHelp,
  },
};

export function reasonLabel(code: string): string {
  return REASON_META[code]?.label ?? code.replace(/_/g, ' ');
}

// Inline chips for a single listing's reasons. Compact by default (the table),
// optionally with the meaning shown (the detail panel).
export function ReasonChips({
  reasons,
  showMeaning = false,
  limit,
}: {
  reasons: string[];
  showMeaning?: boolean;
  limit?: number;
}) {
  const known = reasons.filter((code) => REASON_META[code]);
  if (known.length === 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-900">
        <ShieldCheck className="size-3" /> Clean
      </span>
    );
  const shown = limit ? known.slice(0, limit) : known;
  const extra = known.length - shown.length;
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((code) => {
        const meta = REASON_META[code];
        return (
          <span
            key={code}
            title={meta.meaning}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${TONE_CLASS[meta.tone]}`}
          >
            <meta.icon className="size-3" />
            {meta.label}
          </span>
        );
      })}
      {extra > 0 && (
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">
          +{extra}
        </span>
      )}
      {showMeaning && (
        <ul className="mt-2 w-full space-y-1">
          {known.map((code) => (
            <li key={code} className="text-xs leading-5 text-muted-foreground">
              <strong className="text-foreground">
                {REASON_META[code].label}:
              </strong>{' '}
              {REASON_META[code].meaning}
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}

// Why the confidence tier is what it is — the derivation shown on screen, so the
// number is defensible instead of asserted. Each factor shows pass/attention.
type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';

export function ConfidenceDerivation({
  confidence,
  trustedCount,
  portals,
  looMovementPct,
}: {
  confidence: Confidence;
  trustedCount: number;
  portals: number;
  looMovementPct: number | null;
}) {
  const factors = [
    {
      label: 'Sample size',
      value: `${trustedCount} trusted listings`,
      ok: trustedCount >= 8,
      hint: 'More independent listings agreeing means a steadier rate.',
    },
    {
      label: 'Source diversity',
      value: `${portals} portal${portals === 1 ? '' : 's'}`,
      ok: portals >= 3,
      hint: 'Several portals reduce any single source’s skew.',
    },
    {
      label: 'Stability',
      value:
        looMovementPct === null
          ? 'Not measurable'
          : `${looMovementPct}% if one row is dropped`,
      ok: looMovementPct !== null && looMovementPct <= 2.5,
      hint: 'A rate that barely moves when the biggest listing is removed is robust.',
    },
  ];
  return (
    <div className="rounded-xl border bg-white p-5">
      <p className="data-label">Why this confidence level</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The tier isn’t asserted — it’s derived from three checks. This is what
        makes the rate defensible.
      </p>
      <div className="mt-4 space-y-3">
        {factors.map((f) => (
          <div key={f.label} className="flex items-start gap-3">
            <span
              aria-hidden
              className={`mt-1 size-2.5 shrink-0 rounded-full ${f.ok ? 'bg-[var(--status-success)]' : 'bg-[var(--status-warning)]'}`}
            />
            <div>
              <p className="text-sm font-semibold">
                {f.label}: <span className="font-normal">{f.value}</span>
              </p>
              <p className="text-xs leading-5 text-muted-foreground">{f.hint}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
        Overall:{' '}
        <strong className="text-foreground">{confidence}</strong>. When the checks
        don’t hold, the rate is labelled lower-confidence — or, if there simply
        isn’t enough evidence, we say so instead of guessing.
      </p>
    </div>
  );
}
