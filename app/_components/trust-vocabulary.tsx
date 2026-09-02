'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
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

// The minimal shape each surface needs to show the listings behind a number.
export type EvidenceRow = {
  listingId: string;
  observed: {
    source?: string | number | null;
    society?: string | number | null;
    rent?: string | number | null;
    bhk?: string | number | null;
    areaSqft?: string | number | null;
  };
  reasons: string[];
  b0State: string;
  b1State: string;
  b2State: string;
};

const inr = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN')}` : '—';
};

// A single listing line inside an evidence modal.
function ListingLine({ row }: { row: EvidenceRow }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b py-2 last:border-0">
      <span className="data-value text-sm font-semibold">{row.listingId}</span>
      <span className="text-xs text-muted-foreground">
        {String(row.observed.source ?? '—')} · {String(row.observed.bhk ?? '?')}BHK ·{' '}
        {String(row.observed.areaSqft ?? '?')} sq ft
      </span>
      <span className="data-value text-sm">{inr(row.observed.rent)}</span>
      {row.reasons.filter((r) => REASON_META[r]).length > 0 && (
        <span className="w-full pt-1">
          <ReasonChips reasons={row.reasons} />
        </span>
      )}
    </li>
  );
}

// Reusable modal: shows exactly which listings sit behind a headline number.
export function EvidenceModal({
  open,
  onOpenChange,
  title,
  description,
  rows,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  rows: EvidenceRow[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[80vh] overflow-y-auto sm:max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No listings to show.</p>
        ) : (
          <ul className="mt-1">
            {rows.map((row) => (
              <ListingLine key={row.listingId} row={row} />
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

// The full funnel, broken down: how many listings survived each honest cleaning
// stage, WHAT was removed between stages, and WHY — every drop drilling down to the
// exact listings and their reasons, ending in the trusted survivors. This is the
// "every number reveals the listings behind it" principle applied to the funnel,
// and it works even when nothing survived (the honest-failure story).
export type Baseline = { count: number; estimate: number | null };

const FUNNEL_STAGES = [
  {
    key: 'all' as const,
    label: 'All uploaded listings',
    note: 'Everything in the file',
    tone: 'bg-slate-400',
  },
  {
    key: 'matched' as const,
    label: 'Match this home',
    note: 'Same size, config and area; recent enough',
    tone: 'bg-teal-500',
  },
  {
    key: 'trusted' as const,
    label: 'Trusted for the rate',
    note: 'After removing duplicates and flagged prices',
    tone: 'bg-[var(--flent-teal)]',
  },
];

// Pick the single reason we group a dropped row under, so per-group counts sum to
// the transition's "N removed". The engine pushes reasons structural → price, so
// the first known reason is the most fundamental cause of the drop.
function primaryReason(row: EvidenceRow): string {
  return row.reasons.find((code) => REASON_META[code]) ?? 'missing_required_field';
}

const byListingId = (a: EvidenceRow, b: EvidenceRow) =>
  a.listingId.localeCompare(b.listingId);

// The dropped listings for one transition, grouped by primary reason.
function DroppedGroups({ rows }: { rows: EvidenceRow[] }) {
  const groups = new Map<string, EvidenceRow[]>();
  for (const row of rows) {
    const code = primaryReason(row);
    const bucket = groups.get(code) ?? [];
    bucket.push(row);
    groups.set(code, bucket);
  }
  const ordered = Array.from(groups.entries()).sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  );
  return (
    <div className="mt-2 space-y-3">
      {ordered.map(([code, groupRows]) => {
        const meta = REASON_META[code];
        return (
          <div key={code}>
            <div className="flex items-center gap-2">
              <ReasonChips reasons={[code]} />
              <span className="text-xs text-muted-foreground">
                {groupRows.length} listing{groupRows.length === 1 ? '' : 's'}
              </span>
            </div>
            {meta && (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {meta.meaning}
              </p>
            )}
            <ul className="mt-1">
              {[...groupRows].sort(byListingId).map((row) => (
                <ListingLine key={row.listingId} row={row} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function FunnelBreakdownModal({
  open,
  onOpenChange,
  rows,
  baselines,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: EvidenceRow[];
  baselines: { B0: Baseline; B1: Baseline; B2: Baseline };
}) {
  const counts = {
    all: baselines.B0.count,
    matched: baselines.B1.count,
    trusted: baselines.B2.count,
  };
  const estimates = {
    all: baselines.B0.estimate,
    matched: baselines.B1.estimate,
    trusted: baselines.B2.estimate,
  };
  const max = Math.max(counts.all, 1);

  // Drops between stages, derived from row state so they equal the bar deltas.
  const droppedToMatch = rows.filter(
    (r) => r.b0State === 'include' && r.b1State !== 'include',
  );
  const droppedToTrusted = rows.filter(
    (r) => r.b1State === 'include' && r.b2State !== 'include',
  );
  const trusted = rows.filter((r) => r.b2State === 'include').sort(byListingId);

  const transitions = [droppedToMatch, droppedToTrusted];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[80vh] overflow-y-auto sm:max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>How the evidence was narrowed</DialogTitle>
          <DialogDescription>
            {counts.all} listings in the file → {counts.trusted} trusted for the
            rate. Every drop is shown with the listings behind it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-0">
          {FUNNEL_STAGES.map((stage, i) => {
            const count = counts[stage.key];
            const estimate = estimates[stage.key];
            const widthPct = Math.max((count / max) * 100, 22);
            const dropped = i > 0 ? transitions[i - 1] : [];
            return (
              <div key={stage.key} className="w-full">
                {i > 0 && dropped.length > 0 && (
                  <details className="group/drop w-full py-1.5">
                    <summary className="flex cursor-pointer list-none items-center justify-center gap-1 text-[0.6875rem] font-medium text-muted-foreground">
                      <ChevronDown className="size-3.5 transition-transform group-open/drop:rotate-180" />
                      <span>
                        {dropped.length} removed —{' '}
                        {i === 1
                          ? 'not a match for this home'
                          : 'duplicates & flagged prices'}
                        <span className="ml-1 underline underline-offset-2">
                          see which
                        </span>
                      </span>
                    </summary>
                    <div className="mt-2 rounded-lg border bg-[var(--warm-canvas)] p-3">
                      <DroppedGroups rows={dropped} />
                    </div>
                  </details>
                )}
                <div
                  className={`mx-auto flex flex-col items-center justify-center rounded-md py-3 text-center text-white ${stage.tone}`}
                  style={{ width: `${widthPct}%`, minWidth: '150px' }}
                >
                  <span className="data-value text-xl font-bold leading-none">
                    {count}
                  </span>
                  <span className="mt-1 px-2 text-[0.6875rem] font-semibold leading-tight">
                    {stage.label}
                  </span>
                  <span className="mt-1 text-[0.6875rem] font-medium leading-none opacity-90">
                    median {estimate === null ? '—' : inr(estimate)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <p className="data-label">
            {trusted.length} trusted for the rate
          </p>
          {trusted.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              No listings survived to the trusted set — the honest answer is
              &ldquo;not enough evidence&rdquo; rather than a confident guess.
            </p>
          ) : (
            <ul className="mt-1">
              {trusted.map((row) => (
                <ListingLine key={row.listingId} row={row} />
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
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

// How to legitimately resolve each flag. Deliberately NO "trust it anyway"
// action: distrust is only ever resolved by documented judgment, new evidence,
// or a corrected source — never by a naked toggle that would let someone game
// the rate greener. `lane` tells the UI which action to surface.
type Remedy = {
  headline: string;
  detail: string;
  lane: 'override' | 'task' | 'reupload';
  taskTitle?: string;
};

export const REMEDY: Record<string, Remedy> = {
  cross_post_duplicate: {
    headline: 'Confirm whether it’s really the same flat',
    detail:
      'If it’s a genuine re-post, leave it collapsed. If you’ve confirmed it’s a distinct unit, re-include it with that evidence recorded.',
    lane: 'override',
  },
  suspected_bait_price: {
    headline: 'Verify the price at source before trusting it',
    detail:
      'Bait prices harvest enquiries. Raise a task to confirm the rent with the poster/broker. Only include it if verified — never to lift the sample.',
    lane: 'task',
    taskTitle: 'Verify suspected bait price with source',
  },
  suspected_aspirational_ask: {
    headline: 'Check whether this ask ever transacts',
    detail:
      'An optimistic ask rarely rents at that number. Raise a task to check comparable closes before letting it influence the rate.',
    lane: 'task',
    taskTitle: 'Check aspirational ask against actual closes',
  },
  suspected_mislabel_configuration: {
    headline: 'Correct the label at the source',
    detail:
      'If the BHK/attributes are wrong, fix them in the source data and re-upload — editing evidence in-app would break its provenance.',
    lane: 'reupload',
  },
  implausible_area_for_bhk: {
    headline: 'Fix the area at the source',
    detail:
      'The floor area looks like a data error. Correct it in the CSV and re-upload as a new version rather than overriding a bad number.',
    lane: 'reupload',
  },
  old_last_seen: {
    headline: 'Check whether it re-listed',
    detail:
      'Stale listings have usually rented. Raise a task to confirm current availability before trusting it as live evidence.',
    lane: 'task',
    taskTitle: 'Confirm stale listing is still available',
  },
  missing_required_field: {
    headline: 'Supply the missing value at the source',
    detail:
      'A required field is blank, so it can’t be trusted. Fill it in the source data and re-upload — don’t invent the value.',
    lane: 'reupload',
  },
};

const LANE_LABEL: Record<Remedy['lane'], string> = {
  override: 'Record a human judgment (with evidence)',
  task: 'Raise an evidence task',
  reupload: 'Re-upload a corrected source',
};

export function RemediationGuide({
  reasons,
  onRaiseTask,
  onReupload,
}: {
  reasons: string[];
  onRaiseTask: (title: string) => void;
  onReupload: () => void;
}) {
  const remedies = reasons
    .map((code) => ({ code, remedy: REMEDY[code] }))
    .filter((r) => r.remedy);
  if (remedies.length === 0) return null;
  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-4">
      <p className="data-label text-sky-900">How to resolve this</p>
      <ul className="mt-3 space-y-3">
        {remedies.map(({ code, remedy }) => (
          <li key={code} className="text-sm">
            <p className="font-semibold">{remedy.headline}</p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              {remedy.detail}
            </p>
            <div className="mt-2">
              {remedy.lane === 'task' && (
                <button
                  type="button"
                  onClick={() => onRaiseTask(remedy.taskTitle ?? 'Verify listing')}
                  className="rounded-md border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-900 hover:bg-sky-100"
                >
                  {LANE_LABEL.task}
                </button>
              )}
              {remedy.lane === 'reupload' && (
                <button
                  type="button"
                  onClick={onReupload}
                  className="rounded-md border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-900 hover:bg-sky-100"
                >
                  {LANE_LABEL.reupload}
                </button>
              )}
              {remedy.lane === 'override' && (
                <span className="text-xs font-medium text-sky-900">
                  ↓ {LANE_LABEL.override} below
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';

export function ConfidenceDerivation({
  confidence,
  trustedCount,
  portals,
  looMovementPct,
  rows,
}: {
  confidence: Confidence;
  trustedCount: number;
  portals: number;
  looMovementPct: number | null;
  rows?: EvidenceRow[];
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const trusted = (rows ?? []).filter((r) => r.b2State === 'include');
  const portalCounts = new Map<string, number>();
  for (const r of trusted) {
    const src = String(r.observed.source ?? '—');
    portalCounts.set(src, (portalCounts.get(src) ?? 0) + 1);
  }
  const portalBreakdown = Array.from(portalCounts.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

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
  const canInspect = trusted.length > 0;
  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={`rounded-xl border bg-white p-5 ${canInspect ? 'cursor-pointer transition-shadow hover:shadow-sm' : ''}`}
      onClick={canInspect && !modalOpen ? () => setModalOpen(true) : undefined}
      role={canInspect ? 'button' : undefined}
      tabIndex={canInspect ? 0 : undefined}
      onKeyDown={
        canInspect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') setModalOpen(true);
            }
          : undefined
      }
    >
      <p className="data-label">Why this confidence level</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The tier isn’t asserted — it’s derived from three checks.
        {canInspect ? ' Click to see the exact sources and listings behind it.' : ''}
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

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          className="max-h-[80vh] overflow-y-auto sm:max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>The evidence behind this rate</DialogTitle>
            <DialogDescription>
              {trusted.length} trusted listings across {portalBreakdown.length}{' '}
              sources.
            </DialogDescription>
          </DialogHeader>
          <div>
            <p className="data-label">Sources in the rate</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {portalBreakdown.map(([src, count]) => (
                <span
                  key={src}
                  className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-900"
                >
                  {src} · {count}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <p className="data-label">Trusted listings</p>
            <ul className="mt-1">
              {trusted.map((row) => (
                <li
                  key={row.listingId}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b py-2 text-sm last:border-0"
                >
                  <span className="data-value font-semibold">
                    {row.listingId}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {String(row.observed.source ?? '—')} ·{' '}
                    {String(row.observed.bhk ?? '?')}BHK ·{' '}
                    {String(row.observed.areaSqft ?? '?')} sq ft
                  </span>
                  <span className="data-value">
                    {(() => {
                      const n = Number(row.observed.rent);
                      return Number.isFinite(n)
                        ? `₹${n.toLocaleString('en-IN')}`
                        : '—';
                    })()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
