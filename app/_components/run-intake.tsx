'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileSearch,
  FileSpreadsheet,
  Home,
  Loader2,
  Play,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RunConfig, ValidationIssue } from '@/lib/evidence-engine';
import type { SourceInspection } from '@/lib/source-inspection';
import type { StoredRun } from '@/lib/storage';
import { MobileHeader, ProductRail } from './boss-shell';

type Notice = { kind: 'error' | 'success'; text: string } | null;

const sampleConfig: RunConfig = {
  dealName: 'Anonymised Lakeview deal',
  evidenceCutoff: '2026-08-18',
  societyPrefix: 'Lakeview',
  bhk: 2,
  areaSqft: 1175,
  furnishing: 'semi-furnished',
  landlordBaseRent: 56000,
  landlordMaintenance: 5000,
  landlordDeposit: 280000,
  improvementCapex: 160000,
  areaToleranceSqft: 100,
  maxLastSeenAgeDays: 30,
};

const blankConfig: RunConfig = {
  ...sampleConfig,
  dealName: 'Untitled market review',
  evidenceCutoff: new Date().toISOString().slice(0, 10),
  societyPrefix: '',
  bhk: 0,
  areaSqft: 0,
  furnishing: '',
  landlordBaseRent: 0,
  landlordMaintenance: -1,
  landlordDeposit: -1,
  improvementCapex: -1,
};

// Makes the two-source mental model explicit: the CSV carries market comparables
// (many other listings, which set the rate); the form carries this home and its
// deal terms (which are never mixed into the rate). This is the distinction
// users kept missing.
function TwoSourceExplainer() {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="size-4 text-[var(--flent-teal)]" />
          <p className="text-sm font-semibold">The listings file → the rate</p>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Many <strong>other</strong> homes nearby, pulled from portals. These set
          the market rate — after we clean out the untrustworthy ones.
        </p>
      </div>
      <div className="rounded-lg border bg-[var(--warm-canvas)] p-3">
        <div className="flex items-center gap-2">
          <Home className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">
            This home + its terms → never in the rate
          </p>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          The home you&apos;re pricing and its landlord terms come from the deal
          record. They&apos;re captured for context, but never mixed into the
          market median.
        </p>
      </div>
    </div>
  );
}

// Shown while the analysis runs. The stages describe the REAL categories of work
// the engine performs on every run — validate, match, de-duplicate, flag prices,
// score confidence — so the wait explains what "cleaning the evidence" means. The
// result screen then proves each stage with actual counts. Honest narration, not
// fake progress: the messages advance for feel, the numbers arrive with the run.
const ANALYSIS_STAGES = [
  'Checking the file — validating every row',
  'Matching listings to the home you’re pricing',
  'Collapsing cross-posted duplicates',
  'Flagging bait, aspirational and mislabelled prices',
  'Scoring how much to trust the rate',
];

function AnalysisPreloader() {
  const [stage, setStage] = useState(0);
  // Advance through the stages, holding on the last until the run returns.
  useEffect(() => {
    const timer = setInterval(() => {
      setStage((s) => Math.min(s + 1, ANALYSIS_STAGES.length - 1));
    }, 600);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--warm-canvas)]/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 animate-spin text-[var(--flent-teal)]" />
          <p className="text-sm font-bold">Cleaning the market evidence…</p>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          We don’t just average the listings — we work out which ones to trust
          first. Here’s what’s happening:
        </p>
        <ul className="mt-4 space-y-2.5">
          {ANALYSIS_STAGES.map((label, index) => {
            const done = index < stage;
            const active = index === stage;
            return (
              <li key={label} className="flex items-center gap-2.5 text-sm">
                {done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-[var(--flent-teal)]" />
                ) : active ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-[var(--flent-teal)]" />
                ) : (
                  <span className="size-4 shrink-0 rounded-full border border-slate-300" />
                )}
                <span
                  className={
                    done
                      ? 'text-muted-foreground line-through decoration-teal-300'
                      : active
                        ? 'font-semibold'
                        : 'text-muted-foreground'
                  }
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
          Every decision is kept with its reason — you’ll see them all on the next
          screen.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  helper,
  children,
  state,
}: {
  label: string;
  htmlFor: string;
  helper?: string;
  children: React.ReactNode;
  // Colour psychology: 'needs' = a required field still empty (amber, draws the
  // eye); 'set' = a required field now filled (teal tick, reassures); undefined
  // = a pre-filled default the user can ignore.
  state?: 'needs' | 'set';
}) {
  return (
    <div
      className={
        state === 'needs'
          ? 'rounded-lg border border-amber-200 bg-amber-50/40 p-3'
          : state === 'set'
            ? 'rounded-lg border border-teal-100 bg-teal-50/30 p-3'
            : ''
      }
    >
      <Label
        htmlFor={htmlFor}
        className="data-label mb-2 flex items-center gap-1.5"
      >
        {label}
        {state === 'needs' && (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[0.5625rem] font-bold tracking-normal text-amber-800">
            REQUIRED
          </span>
        )}
        {state === 'set' && (
          <CheckCircle2 className="size-3 text-[var(--flent-teal)]" />
        )}
      </Label>
      {children}
      {helper && (
        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
          {helper}
        </p>
      )}
    </div>
  );
}

export function RunIntake({
  onCreated,
}: {
  onCreated: (run: StoredRun) => void;
}) {
  const [config, setConfig] = useState(blankConfig);
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<SourceInspection | null>(null);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [runBusy, setRunBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Only the facts that define the comparable set gate analysis. Commercial
  // context (landlord ask, maintenance, deposit, capex) does NOT affect the
  // market median — it is a decision-layer concern (Problem 3) — so it never
  // blocks a Problem 1 run. The fields remain in the data model but are no
  // longer collected in this intake.
  const missingConfigCount = [
    config.dealName.trim().length > 0,
    config.evidenceCutoff.length > 0,
    config.societyPrefix.trim().length > 0,
    config.bhk >= 1,
    config.areaSqft >= 100,
    config.furnishing.length > 0,
    config.areaToleranceSqft >= 0,
    config.maxLastSeenAgeDays >= 1,
  ].filter((ready) => !ready).length;
  const canAnalyse =
    Boolean(inspection?.validStructure) && missingConfigCount === 0;

  const update = (key: keyof RunConfig, value: string | number) =>
    setConfig((current) => ({ ...current, [key]: value }));

  function chooseFile(selected: File | null) {
    setFile(selected);
    setInspection(null);
    setIssues([]);
    setConfig({ ...blankConfig });
    setNotice(
      selected
        ? {
            kind: 'success',
            text: `${selected.name} selected. Inspect it before analysis.`,
          }
        : null,
    );
  }

  async function inspectSource(selected = file, useSample = false) {
    if (!selected) {
      setNotice({ kind: 'error', text: 'Choose a CSV file first.' });
      return;
    }
    setSourceBusy(true);
    setNotice(null);
    try {
      const body = new FormData();
      body.set('file', selected);
      const response = await fetch('/api/intake', { method: 'POST', body });
      const payload = (await response.json()) as {
        inspection?: SourceInspection;
        error?: string;
      };
      if (!response.ok || !payload.inspection)
        throw new Error(payload.error ?? 'Source inspection failed.');
      setInspection(payload.inspection);
      setIssues(payload.inspection.issues);
      if (!payload.inspection.validStructure) {
        setNotice({
          kind: 'error',
          text: 'The CSV structure is blocked. Correct the listed issues and inspect it again.',
        });
        return;
      }
      setConfig((current) =>
        useSample
          ? { ...sampleConfig }
          : {
              ...current,
              evidenceCutoff:
                payload.inspection?.suggestions.evidenceCutoff ?? '',
              societyPrefix:
                payload.inspection?.suggestions.societyPrefix ?? '',
            },
      );
      setNotice({
        kind: 'success',
        text: `${payload.inspection.rowCount} rows inspected. Confirm the deal facts and comparison policy below.`,
      });
    } catch (error) {
      setInspection(null);
      setNotice({
        kind: 'error',
        text:
          error instanceof Error ? error.message : 'Source inspection failed.',
      });
    } finally {
      setSourceBusy(false);
    }
  }

  async function loadSample() {
    setSourceBusy(true);
    setNotice(null);
    try {
      const response = await fetch('/anonymised-deal-sample.csv');
      if (!response.ok)
        throw new Error('The anonymised sample is unavailable.');
      const selected = new File(
        [await response.blob()],
        'anonymised-deal-sample.csv',
        { type: 'text/csv' },
      );
      setFile(selected);
      setConfig({ ...sampleConfig });
      await inspectSource(selected, true);
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Sample load failed.',
      });
    } finally {
      setSourceBusy(false);
    }
  }

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !inspection?.validStructure) {
      setNotice({
        kind: 'error',
        text: 'Inspect a structurally valid CSV first.',
      });
      return;
    }
    setRunBusy(true);
    setNotice(null);
    setIssues([]);
    // The analysis often returns in well under a second. Hold the preloader for a
    // minimum window so its stages are actually visible — the point is to show
    // that we clean the evidence, not to hide a delay. Errors skip this wait.
    const startedAt = Date.now();
    const MIN_PRELOADER_MS = 3000;
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('config', JSON.stringify(config));
      body.set('expectedHash', inspection.inputHash);
      const response = await fetch('/api/runs', { method: 'POST', body });
      const payload = (await response.json()) as {
        run?: StoredRun;
        error?: string;
        validation?: { issues: ValidationIssue[] };
        issues?: Array<{ field: string; message: string }>;
      };
      if (!response.ok || !payload.run) {
        setIssues(
          payload.validation?.issues ??
            payload.issues?.map((item) => ({
              rowNumber: null,
              field: item.field,
              code: 'INVALID_CONFIGURATION',
              message: item.message,
              severity: 'error' as const,
            })) ??
            [],
        );
        throw new Error(payload.error ?? 'Analysis failed.');
      }
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_PRELOADER_MS)
        await new Promise((resolve) =>
          setTimeout(resolve, MIN_PRELOADER_MS - elapsed),
        );
      onCreated(payload.run);
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Analysis failed.',
      });
    } finally {
      setRunBusy(false);
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      {runBusy && <AnalysisPreloader />}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <ProductRail current="setup" />
      <div className="min-w-0">
        <MobileHeader />
        <main
          id="main-content"
          className="workbench-grid min-h-screen py-6 lg:py-8"
        >
          <form
            onSubmit={submit}
            className="app-shell max-w-[1180px] space-y-5"
          >
            <div className="flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="eyebrow">Problem 1 · Market trust</p>
                <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">
                  Add listing evidence
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Upload a raw listing export, confirm a few facts about the
                  home you&apos;re pricing, and get a market rate you can defend
                  line by line.
                </p>
                <TwoSourceExplainer />
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                {['1 Upload', '2 Inspect', '3 Analyse'].map((step, index) => {
                  const active =
                    index === 0 ||
                    (index === 1 && Boolean(file)) ||
                    (index === 2 && Boolean(inspection?.validStructure));
                  return (
                    <span
                      key={step}
                      className={`rounded-full border px-3 py-2 ${active ? 'border-teal-200 bg-teal-50 text-teal-900' : 'bg-white text-muted-foreground'}`}
                    >
                      {step}
                    </span>
                  );
                })}
              </div>
            </div>

            {notice && (
              <Alert
                role={notice.kind === 'error' ? 'alert' : 'status'}
                className={
                  notice.kind === 'error'
                    ? 'border-red-200 bg-red-50'
                    : 'border-teal-200 bg-teal-50'
                }
              >
                {notice.kind === 'error' ? <AlertCircle /> : <CheckCircle2 />}
                <AlertTitle>
                  {notice.kind === 'error' ? 'Action needed' : 'Ready'}
                </AlertTitle>
                <AlertDescription>{notice.text}</AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader className="border-b">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>1. Upload your listings</CardTitle>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-teal-200 bg-teal-50 text-teal-800"
                  >
                    Market comparables · sets the rate
                  </Badge>
                </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      We check the file&apos;s columns and rows before anything is
                      calculated.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={loadSample}
                    disabled={sourceBusy || runBusy}
                  >
                    {sourceBusy ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Play />
                    )}
                    Try the sample deal
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div>
                  <Label
                    htmlFor="source-file"
                    className="data-label mb-2 block"
                  >
                    Listing CSV
                  </Label>
                  <Input
                    ref={inputRef}
                    id="source-file"
                    type="file"
                    accept=".csv,text/csv"
                    className="cursor-pointer bg-white file:cursor-pointer"
                    onChange={(event) =>
                      chooseFile(event.target.files?.[0] ?? null)
                    }
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    CSV only, up to 2 MB. The sample is a real 86-listing pull,
                    anonymised.
                  </p>
                </div>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  disabled={!file || sourceBusy || runBusy}
                  onClick={() => inspectSource()}
                >
                  {sourceBusy ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <FileSearch />
                  )}
                  {sourceBusy ? 'Checking…' : 'Check file'}
                </Button>
              </CardContent>
              {inspection && (
                <CardContent className="grid gap-3 border-t bg-slate-50/60 py-4 sm:grid-cols-4">
                  <SourceFact
                    label="Rows"
                    value={String(inspection.rowCount)}
                  />
                  <SourceFact
                    label="Required columns"
                    value={`${inspection.headerCount}/${inspection.requiredColumnCount}`}
                  />
                  <SourceFact
                    label="Most recent listing"
                    value={inspection.dateRange.lastSeenTo ?? 'Missing'}
                  />
                  <SourceFact
                    label="File check"
                    value={inspection.validStructure ? 'Looks good' : 'Needs fixing'}
                  />
                </CardContent>
              )}
            </Card>

            <Card className={!inspection?.validStructure ? 'opacity-60' : ''}>
              <CardHeader className="border-b">
                <CardTitle>2. Confirm the home you&apos;re pricing</CardTitle>
                <div className="mt-1 mb-1 flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-slate-300 bg-slate-50 text-slate-700"
                  >
                    This home&apos;s facts · from the deal record
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  These describe the home you&apos;re comparing against. They come
                  from the deal record, not the listing file, so they&apos;re
                  yours to set.
                </p>
              </CardHeader>
              <CardContent className="space-y-6 py-5">
                <fieldset disabled={!inspection?.validStructure || runBusy}>
                  <legend className="sr-only">Run configuration</legend>

                  {/* Required group — specific to this home, can't be guessed. */}
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold">The home you&apos;re pricing</h3>
                    <span className="text-xs text-muted-foreground">
                      Sets which listings count as comparable — please fill these in.
                    </span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field
                      label="Society match"
                      htmlFor="society"
                      state={config.societyPrefix.trim() ? 'set' : 'needs'}
                    >
                      <Input
                        id="society"
                        value={config.societyPrefix}
                        onChange={(e) =>
                          update('societyPrefix', e.target.value)
                        }
                      />
                    </Field>
                    <Field
                      label="BHK"
                      htmlFor="bhk"
                      state={config.bhk >= 1 ? 'set' : 'needs'}
                    >
                      <Input
                        id="bhk"
                        type="number"
                        min="1"
                        value={config.bhk || ''}
                        onChange={(e) => update('bhk', Number(e.target.value))}
                      />
                    </Field>
                    <Field
                      label="Area (sq ft)"
                      htmlFor="area"
                      state={config.areaSqft >= 100 ? 'set' : 'needs'}
                    >
                      <Input
                        id="area"
                        type="number"
                        min="100"
                        value={config.areaSqft || ''}
                        onChange={(e) =>
                          update('areaSqft', Number(e.target.value))
                        }
                      />
                    </Field>
                    <Field
                      label="Furnishing"
                      htmlFor="furnishing"
                      state={config.furnishing ? 'set' : 'needs'}
                    >
                      <select
                        id="furnishing"
                        className="control-select"
                        value={config.furnishing}
                        onChange={(e) => update('furnishing', e.target.value)}
                      >
                        <option value="">Choose</option>
                        <option value="unfurnished">Unfurnished</option>
                        <option value="semi-furnished">Semi-furnished</option>
                        <option value="fully-furnished">Fully furnished</option>
                      </select>
                    </Field>
                  </div>

                  {/* Pre-filled defaults — sensible values, adjust only if needed. */}
                  <div className="mt-6 border-t pt-5">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold">
                        Matching rules &amp; label
                      </h3>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-slate-600">
                        Pre-filled · adjust if needed
                      </span>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Field label="Deal name" htmlFor="deal-name">
                        <Input
                          id="deal-name"
                          value={config.dealName}
                          onChange={(e) => update('dealName', e.target.value)}
                        />
                      </Field>
                      <Field label="Evidence cutoff" htmlFor="cutoff">
                        <Input
                          id="cutoff"
                          type="date"
                          value={config.evidenceCutoff}
                          onChange={(e) =>
                            update('evidenceCutoff', e.target.value)
                          }
                        />
                      </Field>
                      <Field
                        label="Area tolerance"
                        htmlFor="tolerance"
                        helper="Allowed +/- from the home's area."
                      >
                        <Input
                          id="tolerance"
                          type="number"
                          min="0"
                          value={config.areaToleranceSqft}
                          onChange={(e) =>
                            update('areaToleranceSqft', Number(e.target.value))
                          }
                        />
                      </Field>
                      <Field
                        label="Maximum listing age"
                        htmlFor="age"
                        helper="Days from last seen to cutoff."
                      >
                        <Input
                          id="age"
                          type="number"
                          min="1"
                          value={config.maxLastSeenAgeDays}
                          onChange={(e) =>
                            update('maxLastSeenAgeDays', Number(e.target.value))
                          }
                        />
                      </Field>
                    </div>
                  </div>
                </fieldset>
              </CardContent>
              <CardContent className="flex flex-col gap-3 border-t bg-slate-50/60 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-2xl text-xs leading-5 text-muted-foreground">
                  {missingConfigCount > 0
                    ? `Fill the ${missingConfigCount} highlighted ${missingConfigCount === 1 ? 'field' : 'fields'} about the home to run the analysis.`
                    : 'Ready. The analysis will preserve the uploaded source, validate every row, and record a versioned evidence result.'}
                </p>
                <Button
                  type="submit"
                  size="lg"
                  disabled={!canAnalyse || runBusy}
                >
                  {runBusy ? <Loader2 className="animate-spin" /> : <Play />}
                  {runBusy ? 'Analysing…' : 'Analyse market evidence'}
                </Button>
              </CardContent>
            </Card>

            {issues.length > 0 && (
              <Card className="border-amber-200">
                <CardHeader>
                  <CardTitle className="text-base">
                    Validation details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {issues.slice(0, 12).map((issue, index) => (
                    <div
                      key={`${issue.code}-${issue.rowNumber}-${index}`}
                      className="flex gap-3 rounded-md border bg-white p-3 text-sm"
                    >
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-700" />
                      <div>
                        <strong>{issue.code.replaceAll('_', ' ')}</strong>
                        <p className="mt-1 text-muted-foreground">
                          {issue.rowNumber ? `Row ${issue.rowNumber}: ` : ''}
                          {issue.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </form>
        </main>
      </div>
    </div>
  );
}

function SourceFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="data-label">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
