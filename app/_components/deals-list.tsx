'use client';
/* oxlint-disable react/react-compiler */

import { useEffect, useState } from 'react';
import {
  FilePlus2,
  FileText,
  Gauge,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileHeader, ProductRail } from './boss-shell';

// The home screen: every market review, complete or in progress, shown as a
// bento of deal cards. Each card carries the engine's own verdict at a glance,
// the confidence tier and the review status, so a reviewer can scan the whole
// workspace without opening anything. The demo history is seeded once on first
// load by running realistic noisy listing sets through the same engine an upload
// uses (see /api/seed), so nothing here is a hardcoded result.

type RunSummary = {
  id: string;
  dealName: string;
  versionNumber: number;
  createdAt: string;
  filename: string;
  status: 'complete' | 'in_progress';
  confidence: string;
  median: number | null;
  trustedCount: number;
  disposition: string | null;
};

const money = (v: number | null) =>
  v === null || v <= 0 ? null : `₹${Math.round(v).toLocaleString('en-IN')}`;

const CONFIDENCE: Record<
  string,
  { label: string; chip: string; text: string }
> = {
  HIGH: {
    label: 'High confidence',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    text: 'text-emerald-700',
  },
  MEDIUM: {
    label: 'Medium confidence',
    chip: 'border-amber-200 bg-amber-50 text-amber-900',
    text: 'text-amber-800',
  },
  LOW: {
    label: 'Low confidence',
    chip: 'border-orange-200 bg-orange-50 text-orange-900',
    text: 'text-orange-800',
  },
  INSUFFICIENT: {
    label: 'Insufficient evidence',
    chip: 'border-red-200 bg-red-50 text-red-800',
    text: 'text-red-700',
  },
};

function ConfidencePill({ confidence }: { confidence: string }) {
  const meta = CONFIDENCE[confidence];
  if (!meta) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.chip}`}
    >
      <Gauge className="size-3.5" />
      {meta.label}
    </span>
  );
}

function StatusPill({ run }: { run: RunSummary }) {
  if (run.status === 'complete') {
    const insufficient = run.disposition === 'insufficient_evidence';
    return (
      <span
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${insufficient ? 'border-red-200 bg-red-50 text-red-800' : 'border-teal-200 bg-teal-50 text-teal-900'}`}
      >
        <Lock className="size-3.5" />
        {insufficient ? 'Closed · insufficient' : 'Frozen · complete'}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
      <span className="size-1.5 rounded-full bg-amber-500" />
      In review
    </span>
  );
}

function DealCard({
  run,
  featured,
  onOpen,
}: {
  run: RunSummary;
  featured: boolean;
  onOpen: (id: string) => void;
}) {
  const conf = CONFIDENCE[run.confidence];
  const rate = money(run.median);
  return (
    <button
      type="button"
      onClick={() => onOpen(run.id)}
      className={`flex flex-col rounded-xl border bg-white p-5 text-left transition-shadow hover:shadow-sm ${featured ? 'md:col-span-2' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 font-semibold leading-5">{run.dealName}</p>
        <StatusPill run={run} />
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {run.filename || 'uploaded listings'} · v{run.versionNumber} ·{' '}
        {new Date(run.createdAt).toLocaleDateString()}
      </p>

      <div className="mt-4 flex items-end justify-between gap-3 border-t pt-4">
        <div>
          <p className="data-label">Market rate (asking median)</p>
          <p
            className={`mt-1 font-bold tracking-[-0.03em] ${featured ? 'text-3xl' : 'text-2xl'} ${conf?.text ?? 'text-foreground'}`}
          >
            {rate ?? 'No rate'}
            {rate && (
              <span className="text-sm font-semibold text-muted-foreground">
                {' '}
                / mo
              </span>
            )}
          </p>
        </div>
        <p className="text-right text-xs leading-4 text-muted-foreground">
          <span className="data-value text-foreground">{run.trustedCount}</span>{' '}
          trusted
          <br />
          comparables
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <ConfidencePill confidence={run.confidence} />
      </div>
    </button>
  );
}

export function DealsList({
  onOpen,
  onNew,
  onAnonymous,
}: {
  onOpen: (runId: string) => void;
  onNew: () => void;
  onAnonymous: () => void;
}) {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const res = await fetch('/api/runs', { cache: 'no-store' });
      const data = (await res.json()) as { runs?: RunSummary[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Could not load deals.');
      setRuns(data.runs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load deals.');
      setRuns([]);
    }
  }

  useEffect(() => {
    // Seed the demo workspace once (idempotent), then load. Seeding failures
    // never block the list.
    let active = true;
    void (async () => {
      try {
        await fetch('/api/seed', { method: 'POST' });
      } catch {
        // ignore; the list still loads whatever is there.
      }
      if (active) await load();
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <ProductRail current="deals" onNew={onNew} />
      <div className="min-w-0">
        <MobileHeader />
        <main className="workbench-grid min-h-screen py-6 lg:py-8">
          <div className="app-shell max-w-[1180px]">
            <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-5">
              <div>
                <p className="eyebrow">Problem 1 · Market trust</p>
                <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">
                  Deals
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Every market review, finished or still in progress, with the
                  confidence the engine landed on. Open one to see its evidence.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => load()}>
                  <RefreshCw /> Refresh
                </Button>
                <Button variant="outline" onClick={onAnonymous}>
                  <ShieldCheck /> Try anonymously
                </Button>
                <Button onClick={onNew}>
                  <FilePlus2 /> New market review
                </Button>
              </div>
            </header>

            {runs === null ? (
              <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading the
                workspace…
              </div>
            ) : runs.length === 0 ? (
              <div className="grid place-items-center py-20 text-center">
                <FileText className="size-8 text-muted-foreground" />
                <p className="mt-3 font-semibold">No market reviews yet</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Upload a listings CSV to run your first market review, or try
                  it anonymously with your own data.
                </p>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" onClick={onAnonymous}>
                    <ShieldCheck /> Try anonymously
                  </Button>
                  <Button onClick={onNew}>
                    <FilePlus2 /> New market review
                  </Button>
                </div>
                {error && <p className="mt-3 text-xs text-red-700">{error}</p>}
              </div>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {runs.map((run, i) => (
                  <DealCard
                    key={run.id}
                    run={run}
                    featured={i === 0}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
