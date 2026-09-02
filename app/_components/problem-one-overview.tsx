'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Copy,
  FileSpreadsheet,
  Gauge,
  Lock,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import type { StoredRun } from '@/lib/storage';
import {
  EvidenceModal,
  FunnelBreakdownModal,
  type Baseline,
  type EvidenceRow,
} from './trust-vocabulary';
import { InfoHint } from './info-hint';

// Problem 1 orientation + visual trust layer.
//
// Purpose: a first-time user should understand, before any table, WHAT this is,
// WHY the data exists, and WHERE it came from — then see the answer (a rent
// benchmark) with an honest, colour-coded confidence cue, the funnel that shows
// how many listings survived cleaning, and scannable chips for the junk we
// caught. No invented scores; every number is the engine's own output.

type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';

// Colour psychology: green = trustworthy, amber = use with care, orange = weak,
// red = do not rely. The tier is the user's primary at-a-glance signal.
const CONFIDENCE_UI: Record<
  Confidence,
  { label: string; ring: string; text: string; chip: string; meaning: string }
> = {
  HIGH: {
    label: 'High confidence',
    ring: 'var(--status-success)',
    text: 'text-[var(--status-success)]',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    meaning:
      'Enough independent, recent listings agree. You can quote this rate and defend it.',
  },
  MEDIUM: {
    label: 'Medium confidence',
    ring: 'var(--status-warning)',
    text: 'text-[var(--status-warning)]',
    chip: 'border-amber-200 bg-amber-50 text-amber-900',
    meaning:
      'A usable rate, but the sample is thinner or less varied. Quote it with the caveats shown.',
  },
  LOW: {
    label: 'Low confidence',
    ring: '#d97706',
    text: 'text-[#b45309]',
    chip: 'border-orange-200 bg-orange-50 text-orange-900',
    meaning:
      'Few comparables or an unstable spread. Treat as directional, not a benchmark.',
  },
  INSUFFICIENT: {
    label: 'Insufficient evidence',
    ring: 'var(--status-danger)',
    text: 'text-[var(--status-danger)]',
    chip: 'border-red-200 bg-red-50 text-red-900',
    meaning:
      'Not enough trustworthy listings to set a rate. The honest answer is “we can’t say yet”.',
  },
};

const money = (value: number) =>
  `₹${Math.round(value).toLocaleString('en-IN')}`;

// One-line orientation: what BOSS is, what this slice does, where data comes in.
export function ProblemOneOrientation({ run }: { run: StoredRun }) {
  return (
    <details className="group rounded-xl border bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <span className="eyebrow">Problem 1 · Market trust</span>
          <span className="text-sm font-semibold">
            What this is &amp; where the data comes from
          </span>
        </div>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t p-4 pt-4">
        <h2 className="text-base font-bold tracking-[-0.03em]">
          Is the landlord&apos;s ask in line with the market — and can we prove it?
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          BOSS turns a messy acquisition into structured, sourced evidence. This
          is the <strong>market slice</strong>: it takes a raw listing pull and
          returns a rent benchmark you can trust and defend, listing by listing —
          because on a dashboard a bad market rate looks exactly as precise as a
          good one.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-[var(--warm-canvas)] px-2.5 py-1 font-semibold">
            <FileSpreadsheet className="size-3.5" /> Evidence in: {run.filename}
          </span>
          <span>
            A portal listings export (comparable homes nearby). Asking rents, not
            achieved rents — no live scraping, no invented numbers.
          </span>
        </div>
      </div>
    </details>
  );
}

// The answer: rent benchmark + confidence as the dominant colour cue. The whole
// card is clickable to reveal the listings the rate is built from.
export function MarketAnswer({
  median,
  confidence,
  trustedCount,
  portals,
  looMovementPct,
  rows,
}: {
  median: number;
  confidence: Confidence;
  trustedCount: number;
  portals: number;
  looMovementPct: number | null;
  rows?: EvidenceRow[];
}) {
  const [open, setOpen] = useState(false);
  const ui = CONFIDENCE_UI[confidence];
  const trusted = (rows ?? []).filter((r) => r.b2State === 'include');
  const canInspect = trusted.length > 0;
  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={`rounded-xl border bg-white p-5 ${canInspect ? 'cursor-pointer transition-shadow hover:shadow-sm' : ''}`}
      onClick={canInspect && !open ? () => setOpen(true) : undefined}
      role={canInspect ? 'button' : undefined}
      tabIndex={canInspect ? 0 : undefined}
      onKeyDown={
        canInspect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') setOpen(true);
            }
          : undefined
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="data-label">
              Market rate for this home (asking median)
            </p>
            <InfoHint label="The middle (median) asking rent of the trusted comparable listings — half ask more, half ask less. We use the median, not the average, so one extreme listing can't drag the rate. It's an asking-rent benchmark, not an achieved or signed rent." />
          </div>
          <p className={`mt-1 text-4xl font-bold tracking-[-0.04em] ${ui.text}`}>
            {median > 0 ? money(median) : '—'}
            <span className="text-lg font-semibold text-muted-foreground">
              {' '}
              / month
            </span>
          </p>
        </div>
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${ui.chip}`}
        >
          <Gauge className="size-4" />
          {ui.label}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6">{ui.meaning}</p>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
        <span>
          <strong className="text-foreground">{trustedCount}</strong> trusted
          listings
        </span>
        <span>
          <strong className="text-foreground">{portals}</strong> independent
          sources
        </span>
        <span>
          Drops{' '}
          <strong className="text-foreground">
            {looMovementPct === null ? '—' : `${looMovementPct}%`}
          </strong>{' '}
          if the most influential listing is removed
        </span>
      </div>
      {(confidence === 'LOW' || confidence === 'INSUFFICIENT') && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-sm font-semibold text-amber-950">
            Can this be made trustworthy? Here&apos;s what would help:
          </p>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-950">
            {trustedCount < 8 && (
              <li>
                • <strong>Add more comparable listings</strong> — the trusted set
                is thin ({trustedCount}). A wider or fresher pull, or relaxing the
                area tolerance slightly, brings in more comps.
              </li>
            )}
            {portals < 3 && (
              <li>
                • <strong>Add more sources</strong> — only {portals} portal
                {portals === 1 ? '' : 's'} here. Pulling the same market from more
                portals reduces single-source skew.
              </li>
            )}
            <li>
              • <strong>Check the flagged rows</strong> — verify or re-include any
              wrongly-excluded listings (each has a resolve option in its detail).
            </li>
            <li>
              • <strong>Confirm the home&apos;s facts match the data</strong> — a
              society, BHK, area or furnishing mismatch filters out real comps.
            </li>
          </ul>
          <p className="mt-2 text-xs text-amber-900">
            If none of these change the picture, the honest answer stays
            &ldquo;not enough evidence&rdquo; — better than a confident guess.
          </p>
        </div>
      )}
      {canInspect && (
        <p className="mt-3 text-xs text-muted-foreground">
          Click to see the {trusted.length} listings this rate is built from.
        </p>
      )}
      <EvidenceModal
        open={open}
        onOpenChange={setOpen}
        title={`The rate is built from ${trusted.length} listings`}
        description="The market rate is the median asking rent of these trusted comparables."
        rows={trusted}
      />
    </div>
  );
}

// The funnel: how many listings survived each honest cleaning stage. Clickable —
// opens the list of listings that actually made it into the rate. Bars animate on
// mount and the whole card lifts on hover.
export function EvidenceFunnel({
  all,
  matched,
  trusted,
  rows: dataRows,
  baselines,
}: {
  all: number;
  matched: number;
  trusted: number;
  rows?: EvidenceRow[];
  baselines?: { B0: Baseline; B1: Baseline; B2: Baseline };
}) {
  const [open, setOpen] = useState(false);
  const rows = dataRows ?? [];
  const stages = [
    {
      label: 'All uploaded listings',
      count: all,
      tone: 'bg-slate-400',
      note: 'Everything in the file',
    },
    {
      label: 'Match this home',
      count: matched,
      tone: 'bg-teal-500',
      note: 'Same size, config and area; recent enough',
    },
    {
      label: 'Trusted for the rate',
      count: trusted,
      tone: 'bg-[var(--flent-teal)]',
      note: 'After removing duplicates and flagged prices',
    },
  ];
  const max = Math.max(all, 1);
  const canInspect = rows.length > 0;
  const modalBaselines = baselines ?? {
    B0: { count: all, estimate: null },
    B1: { count: matched, estimate: null },
    B2: { count: trusted, estimate: null },
  };
  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={`rounded-xl border bg-white p-5 ${canInspect ? 'cursor-pointer transition-shadow hover:shadow-sm' : ''}`}
      onClick={canInspect && !open ? () => setOpen(true) : undefined}
      role={canInspect ? 'button' : undefined}
      tabIndex={canInspect ? 0 : undefined}
      onKeyDown={
        canInspect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') setOpen(true);
            }
          : undefined
      }
    >
      <div className="flex items-center gap-1.5">
        <p className="data-label">How many listings survived cleaning</p>
        <InfoHint label="The funnel from every uploaded listing down to the few trusted for the rate: first keep only homes that match yours, then remove duplicates and flagged prices. A big drop is normal and healthy — it's the untrustworthy listings being taken out. Click the card for the full breakdown." />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        The number that matters isn&apos;t how many listings exist — it&apos;s how
        many you can actually trust.
        {canInspect ? ' Click to see the full breakdown.' : ''}
      </p>
      <div className="mt-5 flex flex-col items-center gap-0">
        {stages.map((stage, i) => {
          const widthPct = Math.max((stage.count / max) * 100, 14);
          const dropped = i > 0 ? stages[i - 1].count - stage.count : 0;
          return (
            <div key={stage.label} className="w-full">
              {i > 0 && dropped > 0 && (
                <div className="flex items-center justify-center py-1.5 text-[0.6875rem] font-medium text-muted-foreground">
                  <ChevronDown className="size-3.5" />
                  <span className="ml-1">
                    {dropped} removed —{' '}
                    {i === 1
                      ? 'wrong size, area, furnishing, off-society or stale'
                      : 'duplicates & flagged prices'}
                  </span>
                </div>
              )}
              <div
                className={`mx-auto flex flex-col items-center justify-center rounded-md py-3 text-center text-white transition-[width] duration-700 ease-out ${stage.tone}`}
                style={{ width: `${widthPct}%`, minWidth: '120px' }}
              >
                <span className="data-value text-xl font-bold leading-none">
                  {stage.count}
                </span>
                <span className="mt-1 px-2 text-[0.6875rem] font-semibold leading-tight">
                  {stage.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 border-t pt-3 text-center text-xs text-muted-foreground">
        {all} listings in the file → {trusted} trusted for the rate
        {all > 0 ? ` (${Math.round((trusted / all) * 100)}% survived)` : ''}
      </p>

      <FunnelBreakdownModal
        open={open}
        onOpenChange={setOpen}
        rows={rows}
        baselines={modalBaselines}
      />
    </div>
  );
}

type FlagDef = {
  code: string;
  label: string;
  icon: typeof Copy;
  tone: string;
};

const FLAGS: FlagDef[] = [
  {
    code: 'cross_post_duplicate',
    label: 'Cross-post duplicates',
    icon: Copy,
    tone: 'border-slate-200 bg-slate-50 text-slate-700',
  },
  {
    code: 'suspected_bait_price',
    label: 'Suspected bait prices',
    icon: TriangleAlert,
    tone: 'border-red-200 bg-red-50 text-red-800',
  },
  {
    code: 'suspected_aspirational_ask',
    label: 'Aspirational asks',
    icon: AlertTriangle,
    tone: 'border-amber-200 bg-amber-50 text-amber-900',
  },
  {
    code: 'suspected_mislabel_configuration',
    label: 'Mislabelled config',
    icon: AlertTriangle,
    tone: 'border-orange-200 bg-orange-50 text-orange-900',
  },
  {
    code: 'implausible_area_for_bhk',
    label: 'Impossible floor area',
    icon: AlertTriangle,
    tone: 'border-orange-200 bg-orange-50 text-orange-900',
  },
];

// Scannable chips: what junk the engine caught and kept out of the rate. The
// whole card is clickable and opens one modal listing every flagged listing
// (each row carries its own reason chips), consistent with the confidence card.
export function TrustSignals({
  rows,
}: {
  rows: EvidenceRow[];
}) {
  const [open, setOpen] = useState(false);
  const counts = new Map<string, number>();
  for (const row of rows)
    for (const reason of row.reasons)
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
  const present = FLAGS.map((flag) => ({
    ...flag,
    count: counts.get(flag.code) ?? 0,
  })).filter((flag) => flag.count > 0);
  const flaggedRows = rows.filter((r) =>
    r.reasons.some((code) => FLAGS.some((f) => f.code === code)),
  );
  const hasAny = flaggedRows.length > 0;

  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={`rounded-xl border bg-white p-5 ${hasAny ? 'cursor-pointer transition-shadow hover:shadow-sm' : ''}`}
      onClick={hasAny && !open ? () => setOpen(true) : undefined}
      role={hasAny ? 'button' : undefined}
      tabIndex={hasAny ? 0 : undefined}
      onKeyDown={
        hasAny
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') setOpen(true);
            }
          : undefined
      }
    >
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-[var(--flent-teal)]" />
        <p className="data-label">What we caught and kept out of the rate</p>
        <InfoHint label="The specific junk the engine detected and excluded from the rate: cross-post duplicates, suspected bait prices, aspirational asks, and mislabelled or impossible listings. Nothing is deleted — each stays in the review with its reason, and you can overrule any call." />
      </div>
      {!hasAny ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No duplicate or suspicious-price listings were found in the trusted set.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {present.map((flag) => (
            <span
              key={flag.code}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${flag.tone}`}
            >
              <flag.icon className="size-3.5" />
              {flag.count} {flag.label}
            </span>
          ))}
        </div>
      )}
      <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
        Nothing here is deleted — each flagged listing stays in the review with its
        reason, and you can overrule any call.{' '}
        {hasAny ? 'Click to see exactly which listings.' : ''}
      </p>

      <EvidenceModal
        open={open}
        onOpenChange={setOpen}
        title="What we caught and kept out of the rate"
        description="Every flagged listing, with the reason we flagged it. None is deleted — each stays reviewable."
        rows={flaggedRows}
      />
    </div>
  );
}

// Answers three questions users kept asking: where does Problem 1 end, what are
// the next steps, and how does it move to Problems 2 and 3. Problem 1 ends at a
// frozen, versioned market-evidence record. That record is then consumed by the
// decision (Problem 3), and — once the resulting deal's real outcome is known —
// feeds the calibration loop (Problem 2). It's a hand-off then a loop, not a
// linear march.
export function NextSteps({
  isComplete,
  onComplete,
  blockers,
}: {
  isComplete: boolean;
  onComplete: () => void;
  blockers: number;
}) {
  const steps = [
    {
      title: 'Market rate + confidence',
      caption: 'This tool — you are here',
      done: true,
    },
    {
      title: 'Freeze the evidence',
      caption: isComplete
        ? 'Done — versioned & locked'
        : 'Completes Problem 1',
      done: isComplete,
    },
    {
      title: 'Decision',
      caption: 'ACQUIRE / NEGOTIATE / HOLD / PASS · Problem 3',
      done: false,
    },
    {
      title: 'Outcome → calibration',
      caption: 'Real result improves future rates · Problem 2',
      done: false,
    },
  ];
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex items-center gap-1.5">
        <p className="data-label">Where this goes next</p>
        <InfoHint label="How this market review fits the wider BOSS flow: Problem 1 ends by freezing a trusted market-evidence packet. That packet feeds the acquisition decision (Problem 3), and once the real deal outcome is known it feeds the calibration loop (Problem 2). This tool never makes the decision itself." />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Problem 1 ends when you freeze this market evidence. From there it feeds
        the decision, and later the learning loop — it never decides on its own.
      </p>

      <ol className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        {steps.map((step, i) => (
          <li key={step.title} className="flex flex-1 items-stretch gap-2">
            <div
              className={`flex-1 rounded-lg border p-3 ${step.done ? 'border-teal-200 bg-teal-50/50' : 'bg-[var(--warm-canvas)]'}`}
            >
              <div className="flex items-center gap-1.5">
                {step.done ? (
                  <CheckCircle2 className="size-4 text-[var(--flent-teal)]" />
                ) : (
                  <span className="size-4 rounded-full border border-slate-300" />
                )}
                <p className="text-xs font-bold">{step.title}</p>
              </div>
              <p className="mt-1 text-[0.6875rem] leading-4 text-muted-foreground">
                {step.caption}
              </p>
            </div>
            {i < steps.length - 1 && (
              <ArrowRight className="hidden size-4 shrink-0 self-center text-muted-foreground sm:block" />
            )}
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
        {isComplete ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-900">
            <Lock className="size-4" /> Market evidence frozen — Problem 1
            complete
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={onComplete}
              disabled={blockers > 0}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Lock className="size-4" /> Freeze &amp; complete market review
            </button>
            {blockers > 0 && (
              <span className="text-xs text-muted-foreground">
                {blockers} open item{blockers === 1 ? '' : 's'} to resolve first
                (listings needing a call or evidence tasks).
              </span>
            )}
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs">
        <Link
          href="/decision"
          className="font-semibold text-[var(--flent-teal)] hover:underline"
        >
          Preview the decision (Problem 3) →
        </Link>
        <Link
          href="/calibration"
          className="font-semibold text-[var(--flent-teal)] hover:underline"
        >
          See the calibration loop (Problem 2) →
        </Link>
      </div>
    </div>
  );
}

// Honest scoping panel that replaces the empty deal-dimension tabs.
export function ScopeNote({ dimension }: { dimension: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-[var(--warm-canvas)] p-6">
      <div className="flex items-center gap-1.5">
        <p className="eyebrow">Not in this slice</p>
        <InfoHint label={`${dimension} is a real part of a BOSS acquisition decision, but it's owned by a different team and isn't scored from the listing data this tool has. Rather than invent a number from evidence we don't hold, we show it honestly as out of scope here.`} />
      </div>
      <h3 className="mt-2 text-lg font-bold tracking-[-0.03em]">
        {dimension} is a separate part of the BOSS decision
      </h3>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        This build deliberately goes deep on one problem — <strong>market
        trust</strong> — rather than shallow on all of them. {dimension} is
        captured as evidence elsewhere in BOSS and owned by a different team; we
        don&apos;t score it here from data we don&apos;t have, because a
        confident-looking number built on missing evidence is worse than an honest
        blank.
      </p>
      <p className="mt-3 text-sm font-semibold">
        Our approach for {dimension} is written up in the execution plan and
        approach note, not faked in this screen.
      </p>
    </div>
  );
}
