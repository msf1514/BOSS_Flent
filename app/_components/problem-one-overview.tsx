'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Copy,
  FileSpreadsheet,
  Gauge,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import type { StoredRun } from '@/lib/storage';
import {
  EvidenceModal,
  REASON_META,
  type EvidenceRow,
} from './trust-vocabulary';

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
    <section className="rounded-xl border bg-white p-5">
      <p className="eyebrow">Problem 1 · Market trust</p>
      <h2 className="mt-2 text-lg font-bold tracking-[-0.03em]">
        Is the landlord&apos;s ask in line with the market — and can we prove it?
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
        BOSS turns a messy acquisition into structured, sourced evidence. This is
        the <strong>market slice</strong>: it takes a raw listing pull and returns
        a rent benchmark you can trust and defend, listing by listing — because on
        a dashboard a bad market rate looks exactly as precise as a good one.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-[var(--warm-canvas)] px-2.5 py-1 font-semibold">
          <FileSpreadsheet className="size-3.5" /> Evidence in: {run.filename}
        </span>
        <span>
          A portal listings export (comparable homes nearby). No live scraping, no
          invented numbers — only what was uploaded, cleaned and shown with its
          reason.
        </span>
      </div>
    </section>
  );
}

// The answer: rent benchmark + confidence as the dominant colour cue.
export function MarketAnswer({
  median,
  confidence,
  trustedCount,
  portals,
  looMovementPct,
}: {
  median: number;
  confidence: Confidence;
  trustedCount: number;
  portals: number;
  looMovementPct: number | null;
}) {
  const ui = CONFIDENCE_UI[confidence];
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="data-label">Market rate for this home (asking median)</p>
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
    </div>
  );
}

// The funnel: how many listings survived each honest cleaning stage.
export function EvidenceFunnel({
  all,
  matched,
  trusted,
}: {
  all: number;
  matched: number;
  trusted: number;
}) {
  const rows = [
    {
      label: 'All uploaded listings',
      count: all,
      tone: 'bg-slate-200',
      note: 'Everything in the file',
    },
    {
      label: 'Match this home',
      count: matched,
      tone: 'bg-teal-300',
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
  return (
    <div className="rounded-xl border bg-white p-5">
      <p className="data-label">How many listings survived cleaning</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The number that matters isn&apos;t how many listings exist — it&apos;s how
        many you can actually trust.
      </p>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold">{row.label}</span>
              <span className="data-value">{row.count}</span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${row.tone}`}
                style={{ width: `${Math.max((row.count / max) * 100, 2)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{row.note}</p>
          </div>
        ))}
      </div>
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

// Scannable chips: what junk the engine caught and kept out of the rate. Each
// chip is clickable to reveal exactly which listings triggered that flag.
export function TrustSignals({
  rows,
}: {
  rows: EvidenceRow[];
}) {
  const [openFlag, setOpenFlag] = useState<string | null>(null);
  const counts = new Map<string, number>();
  for (const row of rows)
    for (const reason of row.reasons)
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
  const present = FLAGS.map((flag) => ({
    ...flag,
    count: counts.get(flag.code) ?? 0,
  })).filter((flag) => flag.count > 0);

  const flaggedRows = (code: string) =>
    rows.filter((r) => r.reasons.includes(code));
  const active = FLAGS.find((f) => f.code === openFlag);

  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-[var(--flent-teal)]" />
        <p className="data-label">What we caught and kept out of the rate</p>
      </div>
      {present.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No duplicate or suspicious-price listings were found in the trusted set.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {present.map((flag) => (
            <button
              key={flag.code}
              type="button"
              onClick={() => setOpenFlag(flag.code)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-shadow hover:shadow-sm ${flag.tone}`}
            >
              <flag.icon className="size-3.5" />
              {flag.count} {flag.label}
            </button>
          ))}
        </div>
      )}
      <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
        Nothing here is deleted — each flagged listing stays in the review with its
        reason, and you can overrule any call. Tap a tag to see which listings.
      </p>

      <EvidenceModal
        open={openFlag !== null}
        onOpenChange={(o) => !o && setOpenFlag(null)}
        title={active ? `${flaggedRows(active.code).length} · ${active.label}` : ''}
        description={
          active ? REASON_META[active.code]?.meaning : undefined
        }
        rows={openFlag ? flaggedRows(openFlag) : []}
      />
    </div>
  );
}

// Honest scoping panel that replaces the empty deal-dimension tabs.
export function ScopeNote({ dimension }: { dimension: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-[var(--warm-canvas)] p-6">
      <p className="eyebrow">Not in this slice</p>
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
