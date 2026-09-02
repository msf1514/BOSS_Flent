'use client';
/* oxlint-disable react/react-compiler */

import { useEffect, useState } from 'react';
import {
  FilePlus2,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MobileHeader, ProductRail } from './boss-shell';

// Every run persists — complete or not — and every one is listed here and
// reopenable. This is the home screen: the record of market reviews, not just
// the latest one.

type RunSummary = {
  id: string;
  dealName: string;
  versionNumber: number;
  createdAt: string;
  filename: string;
  status: 'complete' | 'in_progress';
};

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
    void load();
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
                  Every market review you&apos;ve run — finished or still in
                  progress. Open one to see its evidence.
                </p>
              </div>
              <div className="flex gap-2">
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
                <Loader2 className="size-4 animate-spin" /> Loading deals…
              </div>
            ) : runs.length === 0 ? (
              <div className="grid place-items-center py-20 text-center">
                <FileText className="size-8 text-muted-foreground" />
                <p className="mt-3 font-semibold">No market reviews yet</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Upload a listings CSV to run your first market review. It will
                  be saved here — complete or not — so you can return to it.
                </p>
                <Button className="mt-4" onClick={onNew}>
                  <FilePlus2 /> New market review
                </Button>
                {error && (
                  <p className="mt-3 text-xs text-red-700">{error}</p>
                )}
              </div>
            ) : (
              <ul className="mt-5 space-y-2">
                {runs.map((run) => (
                  <li key={run.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(run.id)}
                      className="flex w-full items-center justify-between gap-4 rounded-xl border bg-white p-4 text-left transition-shadow hover:shadow-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {run.dealName}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {run.filename || 'uploaded listings'} · v
                          {run.versionNumber} ·{' '}
                          {new Date(run.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          run.status === 'complete'
                            ? 'shrink-0 border-teal-200 bg-teal-50 text-teal-800'
                            : 'shrink-0 border-amber-200 bg-amber-50 text-amber-900'
                        }
                      >
                        {run.status === 'complete'
                          ? 'Complete'
                          : 'In progress'}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
