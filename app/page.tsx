'use client';
/* oxlint-disable react/react-compiler */

import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { AnonymousAnalysis } from '@/app/_components/anonymous-analysis';
import { DealsList } from '@/app/_components/deals-list';
import { MarketWorkbench } from '@/app/_components/market-workbench';
import { RunIntake } from '@/app/_components/run-intake';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { StoredRun } from '@/lib/storage';

type View = 'list' | 'intake' | 'run' | 'anonymous';

export default function Page() {
  const [view, setView] = useState<View>('list');
  const [run, setRun] = useState<StoredRun | null>(null);
  const [prefill, setPrefill] = useState<StoredRun['config'] | undefined>(
    undefined,
  );
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');

  async function openRun(runId: string) {
    setOpening(true);
    setError('');
    try {
      const detail = await fetch(`/api/runs?id=${runId}`, {
        cache: 'no-store',
      });
      const data = (await detail.json()) as { run?: StoredRun; error?: string };
      if (!detail.ok || !data.run)
        throw new Error(data.error ?? 'Could not open this run.');
      setRun(data.run);
      setView('run');
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Could not open run.',
      );
    } finally {
      setOpening(false);
    }
  }

  if (opening)
    return (
      <main
        className="workbench-grid grid min-h-screen place-items-center p-6"
        aria-busy="true"
      >
        <div className="flex items-center gap-3 rounded-xl border bg-white px-5 py-4 shadow-sm">
          <Loader2 className="size-5 animate-spin text-primary" />
          <p className="text-sm font-semibold">Opening the market review…</p>
        </div>
      </main>
    );

  if (error && view === 'list')
    return (
      <main className="workbench-grid grid min-h-screen place-items-center p-6">
        <div className="w-full max-w-xl">
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button className="mt-4" onClick={() => setError('')}>
            Back to deals
          </Button>
        </div>
      </main>
    );

  if (view === 'run' && run)
    return (
      <MarketWorkbench
        initialRun={run}
        onNew={() => {
          setPrefill(run.config);
          setRun(null);
          setView('intake');
        }}
        onDeals={() => {
          setRun(null);
          setView('list');
        }}
      />
    );

  if (view === 'intake')
    return (
      <RunIntake
        initialConfig={prefill}
        onCreated={(created) => {
          setPrefill(undefined);
          setRun(created);
          setView('run');
        }}
      />
    );

  if (view === 'anonymous')
    return <AnonymousAnalysis onExit={() => setView('list')} />;

  return (
    <DealsList
      onOpen={openRun}
      onNew={() => {
        setPrefill(undefined);
        setView('intake');
      }}
      onAnonymous={() => setView('anonymous')}
    />
  );
}
