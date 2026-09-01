'use client';
/* oxlint-disable react/react-compiler */

import { useEffect, useState } from 'react';
import { AlertCircle, Building2, Loader2 } from 'lucide-react';
import { MarketWorkbench } from '@/app/_components/market-workbench';
import { RunIntake } from '@/app/_components/run-intake';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { StoredRun } from '@/lib/storage';

export default function Page() {
  const [run, setRun] = useState<StoredRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/runs', { cache: 'no-store' });
      const payload = (await response.json()) as {
        runs?: Array<{ id: string }>;
        error?: string;
      };
      if (!response.ok)
        throw new Error(payload.error ?? 'Could not load workspace.');
      if (!payload.runs?.[0]) {
        setRun(null);
        return;
      }
      const detail = await fetch(`/api/runs?id=${payload.runs[0].id}`, {
        cache: 'no-store',
      });
      const data = (await detail.json()) as {
        run?: StoredRun;
        error?: string;
      };
      if (!detail.ok || !data.run)
        throw new Error(
          data.error ?? 'Could not load the latest evidence run.',
        );
      setRun(data.run);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load workspace.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading)
    return (
      <main
        className="workbench-grid grid min-h-screen place-items-center p-6"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="flex items-center gap-3 rounded-xl border bg-white px-5 py-4 shadow-sm">
          <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
            <Building2 aria-hidden="true" className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Opening BOSS</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Loading the latest deal evidence
            </p>
          </div>
          <Loader2
            aria-hidden="true"
            className="ml-3 size-5 animate-spin text-primary"
          />
        </div>
      </main>
    );

  if (error && !run)
    return (
      <main className="workbench-grid grid min-h-screen place-items-center p-6">
        <div className="w-full max-w-xl">
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle />
            <AlertTitle>Workspace unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button className="mt-4" onClick={load}>
            Retry
          </Button>
        </div>
      </main>
    );

  return run ? (
    <MarketWorkbench initialRun={run} onNew={() => setRun(null)} />
  ) : (
    <RunIntake onCreated={setRun} />
  );
}
