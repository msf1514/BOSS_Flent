'use client';
/* oxlint-disable react/react-compiler */

import { useState } from 'react';
import {
  ArrowLeft,
  FileSpreadsheet,
  Loader2,
  Lock,
  Play,
  ShieldCheck,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  runEvidenceEngine,
  type EngineResult,
  type RunConfig,
} from '@/lib/evidence-engine';
import { parseRunConfig } from '@/lib/run-config';
import { MobileHeader, ProductRail } from './boss-shell';
import { InfoHint } from './info-hint';
import { EvidenceFunnel, MarketAnswer, TrustSignals } from './problem-one-overview';
import { ConfidenceDerivation } from './trust-vocabulary';

// Anonymous, client-side market-trust check. The whole point: a reviewer can try
// the trust layer on THEIR OWN listing pull and see whether it behaves, without
// the data ever leaving their browser. The CSV is read with FileReader, the pure
// engine runs in the tab, and nothing is uploaded or written to D1/R2. This is
// the honest version of "try it with your own data": we can't leak what we never
// receive. Overrides / versioning / completion are deliberately absent here —
// those imply persistence; this is a read-only look at the evidence.

type Form = {
  societyPrefix: string;
  bhk: string;
  areaSqft: string;
  furnishing: string;
  areaToleranceSqft: string;
  maxLastSeenAgeDays: string;
};

const emptyForm: Form = {
  societyPrefix: '',
  bhk: '',
  areaSqft: '',
  furnishing: '',
  areaToleranceSqft: '100',
  maxLastSeenAgeDays: '30',
};

function PrivacyBanner() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50/70 p-4">
      <Lock className="mt-0.5 size-5 shrink-0 text-[var(--flent-teal)]" />
      <div>
        <p className="text-sm font-bold text-teal-950">
          Anonymous, your data never leaves this browser
        </p>
        <p className="mt-1 text-sm leading-6 text-teal-900">
          The CSV is read and analysed entirely on your device. It is{' '}
          <strong>never uploaded</strong>, never written to our database, and
          nothing about it is retained once you leave this page. We can&apos;t
          leak what we never receive.
        </p>
      </div>
    </div>
  );
}

export function AnonymousAnalysis({ onExit }: { onExit: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<EngineResult | null>(null);

  const set = (key: keyof Form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const ready =
    Boolean(file) &&
    form.societyPrefix.trim().length > 0 &&
    Number(form.bhk) >= 1 &&
    Number(form.areaSqft) >= 100 &&
    form.furnishing.length > 0;

  async function analyse() {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const config: RunConfig = {
        dealName: 'Anonymous check',
        evidenceCutoff: new Date().toISOString().slice(0, 10),
        societyPrefix: form.societyPrefix.trim(),
        furnishing: form.furnishing,
        bhk: Number(form.bhk),
        areaSqft: Number(form.areaSqft),
        landlordBaseRent: 0,
        landlordMaintenance: 0,
        landlordDeposit: 0,
        improvementCapex: 0,
        areaToleranceSqft: Number(form.areaToleranceSqft) || 0,
        maxLastSeenAgeDays: Number(form.maxLastSeenAgeDays) || 30,
      };
      const parsed = parseRunConfig(config);
      if (!parsed.ok) {
        setError(parsed.issues[0]?.message ?? 'Check the home details.');
        return;
      }
      // Read locally, no network. The engine is pure and runs in the tab.
      const csv = await file.text();
      const engineResult = await runEvidenceEngine(csv, parsed.value, [], {});
      if (!engineResult.rows.length && engineResult.validation.errorCount) {
        setError(
          engineResult.validation.issues[0]?.message ??
            'This file could not be read as a 13-column listings CSV.',
        );
        return;
      }
      setResult(engineResult);
    } catch {
      setError(
        'Could not analyse this file in the browser. Confirm it is a listings CSV.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <ProductRail current="setup" />
      <div className="min-w-0">
        <MobileHeader />
        <main className="workbench-grid min-h-screen py-6 lg:py-8">
          <div className="app-shell max-w-[1180px] space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-5">
              <div>
                <p className="eyebrow">Problem 1 · Try it with your own data</p>
                <h1 className="mt-2 flex items-center gap-2 text-3xl font-bold tracking-[-0.04em]">
                  <ShieldCheck className="size-7 text-[var(--flent-teal)]" />
                  Anonymous market-trust check
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Run your own listing pull through the trust layer and see the
                  rate, the confidence and every flagged listing, with nothing
                  saved on our side.
                </p>
              </div>
              <Button variant="outline" onClick={onExit}>
                <ArrowLeft /> Back to deals
              </Button>
            </div>

            <PrivacyBanner />

            {result === null ? (
              <Card>
                <CardHeader className="border-b">
                  <CardTitle>Your listings &amp; the home you&apos;re pricing</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    A 13-column listings CSV, plus the four facts that decide
                    which listings count as comparable.
                  </p>
                </CardHeader>
                <CardContent className="space-y-5 py-5">
                  <div>
                    <Label htmlFor="anon-file" className="data-label mb-2 block">
                      Listing CSV
                    </Label>
                    <Input
                      id="anon-file"
                      type="file"
                      accept=".csv,text/csv"
                      className="h-11 cursor-pointer bg-white file:cursor-pointer"
                      onChange={(e) => {
                        setFile(e.target.files?.[0] ?? null);
                        setError('');
                      }}
                    />
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FileSpreadsheet className="size-3.5" />
                      Read in your browser only · CSV up to 2 MB.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <AnonField
                      id="anon-society"
                      label="Society match"
                      info="The society/cluster name listings must belong to. Matched on the start of the name."
                      value={form.societyPrefix}
                      onChange={(v) => set('societyPrefix', v)}
                    />
                    <AnonField
                      id="anon-bhk"
                      label="BHK"
                      type="number"
                      info="Bedrooms of the home you're pricing. Only same-BHK listings enter the reference set."
                      value={form.bhk}
                      onChange={(v) => set('bhk', v)}
                    />
                    <AnonField
                      id="anon-area"
                      label="Area (sq ft)"
                      type="number"
                      info="Built-up area. Listings must be within this ± the tolerance to count as comparable."
                      value={form.areaSqft}
                      onChange={(v) => set('areaSqft', v)}
                    />
                    <div>
                      <Label
                        htmlFor="anon-furnishing"
                        className="data-label mb-2 flex items-center gap-1.5"
                      >
                        Furnishing
                        <InfoHint label="Furnishing level of the home. Only listings at the same level are directly comparable." />
                      </Label>
                      <select
                        id="anon-furnishing"
                        className="control-select"
                        value={form.furnishing}
                        onChange={(e) => set('furnishing', e.target.value)}
                      >
                        <option value="">Choose</option>
                        <option value="unfurnished">Unfurnished</option>
                        <option value="semi-furnished">Semi-furnished</option>
                        <option value="fully-furnished">Fully furnished</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <AnonField
                      id="anon-tol"
                      label="Area tolerance"
                      type="number"
                      info="How far a listing's area can differ from yours and still count, in sq ft."
                      value={form.areaToleranceSqft}
                      onChange={(v) => set('areaToleranceSqft', v)}
                    />
                    <AnonField
                      id="anon-age"
                      label="Max listing age (days)"
                      type="number"
                      info="Oldest a listing can be, measured from last-seen to today, before it's dropped as stale."
                      value={form.maxLastSeenAgeDays}
                      onChange={(v) => set('maxLastSeenAgeDays', v)}
                    />
                  </div>

                  {error && (
                    <Alert className="border-red-200 bg-red-50" role="alert">
                      <AlertTitle>Could not analyse</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
                <CardContent className="flex flex-col gap-3 border-t bg-slate-50/60 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-xl text-xs leading-5 text-muted-foreground">
                    {ready
                      ? 'Ready. This runs entirely in your browser, nothing is uploaded.'
                      : 'Add a CSV and the four home facts to run the check.'}
                  </p>
                  <Button size="lg" disabled={!ready || busy} onClick={analyse}>
                    {busy ? <Loader2 className="animate-spin" /> : <Play />}
                    {busy ? 'Analysing in your browser…' : 'Analyse in my browser'}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    Analysed <strong>{file?.name}</strong> in your browser ·{' '}
                    {result.rows.length} rows read · nothing saved.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setResult(null);
                      setFile(null);
                      setForm(emptyForm);
                    }}
                  >
                    Analyse another file
                  </Button>
                </div>

                <MarketAnswer
                  median={result.summary.baselines.B2.estimate ?? 0}
                  confidence={result.summary.askingEvidenceConfidence}
                  trustedCount={result.summary.baselines.B2.count}
                  portals={result.summary.observedPortalLabelCount}
                  looMovementPct={result.summary.maximumLeaveOneOutMovementPct}
                  rows={result.rows}
                />
                <div className="grid gap-4 lg:grid-cols-2">
                  <ConfidenceDerivation
                    confidence={result.summary.askingEvidenceConfidence}
                    trustedCount={result.summary.baselines.B2.count}
                    portals={result.summary.observedPortalLabelCount}
                    looMovementPct={result.summary.maximumLeaveOneOutMovementPct}
                    rows={result.rows}
                  />
                  <EvidenceFunnel
                    all={result.summary.baselines.B0.count}
                    matched={result.summary.baselines.B1.count}
                    trusted={result.summary.baselines.B2.count}
                    rows={result.rows}
                    baselines={result.summary.baselines}
                  />
                </div>
                <TrustSignals rows={result.rows} />

                <div className="rounded-xl border border-dashed bg-[var(--warm-canvas)] p-5">
                  <p className="text-sm leading-6 text-muted-foreground">
                    This is a read-only look, so you can see the trust layer work
                    on your own data. To record overrides, raise evidence tasks
                    and freeze a versioned market-evidence packet,{' '}
                    <button
                      type="button"
                      onClick={onExit}
                      className="font-semibold text-[var(--flent-teal)] underline underline-offset-2"
                    >
                      run a saved market review
                    </button>{' '}
                    instead.
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function AnonField({
  id,
  label,
  info,
  value,
  onChange,
  type = 'text',
}: {
  id: string;
  label: string;
  info: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="data-label mb-2 flex items-center gap-1.5">
        {label}
        <InfoHint label={info} />
      </Label>
      <Input
        id={id}
        type={type}
        min={type === 'number' ? '0' : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
