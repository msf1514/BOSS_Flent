'use client';

import { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileSearch,
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
  dealName: '',
  evidenceCutoff: '',
  societyPrefix: '',
  bhk: 0,
  areaSqft: 0,
  furnishing: '',
  landlordBaseRent: 0,
  landlordMaintenance: -1,
  landlordDeposit: -1,
  improvementCapex: -1,
};

function Field({
  label,
  htmlFor,
  helper,
  children,
}: {
  label: string;
  htmlFor: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor} className="data-label mb-2 block">
        {label}
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

  const missingConfigCount = [
    config.dealName.trim().length > 0,
    config.evidenceCutoff.length > 0,
    config.societyPrefix.trim().length > 0,
    config.bhk >= 1,
    config.areaSqft >= 100,
    config.furnishing.length > 0,
    config.landlordBaseRent > 0,
    config.landlordMaintenance >= 0,
    config.landlordDeposit >= 0,
    config.improvementCapex >= 0,
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
                <p className="eyebrow">Market evidence</p>
                <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">
                  Add listing evidence
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Upload a raw listing pull, confirm the subject facts, and
                  create a reproducible market review.
                </p>
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
                    <CardTitle>1. Upload and inspect the source</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Required fields and raw bytes are checked before any
                      policy is applied.
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
                    Use anonymised case
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
                    CSV only, up to 2 MB. The case sample contains 86 anonymised
                    listings.
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
                  {sourceBusy ? 'Inspecting…' : 'Inspect source'}
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
                    label="Latest evidence"
                    value={inspection.dateRange.lastSeenTo ?? 'Missing'}
                  />
                  <SourceFact
                    label="Structure"
                    value={inspection.validStructure ? 'Valid' : 'Blocked'}
                  />
                </CardContent>
              )}
            </Card>

            <Card className={!inspection?.validStructure ? 'opacity-60' : ''}>
              <CardHeader className="border-b">
                <CardTitle>2. Confirm the subject and policy</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  These values define comparability. They come from the deal
                  record or policy—not from the listing CSV.
                </p>
              </CardHeader>
              <CardContent className="space-y-6 py-5">
                <fieldset disabled={!inspection?.validStructure || runBusy}>
                  <legend className="sr-only">Run configuration</legend>
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
                    <Field label="Society match" htmlFor="society">
                      <Input
                        id="society"
                        value={config.societyPrefix}
                        onChange={(e) =>
                          update('societyPrefix', e.target.value)
                        }
                      />
                    </Field>
                    <Field label="BHK" htmlFor="bhk">
                      <Input
                        id="bhk"
                        type="number"
                        min="1"
                        value={config.bhk || ''}
                        onChange={(e) => update('bhk', Number(e.target.value))}
                      />
                    </Field>
                    <Field label="Area (sq ft)" htmlFor="area">
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
                    <Field label="Furnishing" htmlFor="furnishing">
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
                    <Field
                      label="Area tolerance"
                      htmlFor="tolerance"
                      helper="Allowed difference from the subject area."
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
                      helper="Days from last seen to evidence cutoff."
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
                  <div className="mt-6 border-t pt-5">
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold">
                        Commercial context
                      </h2>
                      <Badge
                        variant="outline"
                        className="border-sky-200 bg-sky-50 text-sky-800"
                      >
                        Captured, not used to calculate the median
                      </Badge>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Field label="Landlord base rent" htmlFor="base-rent">
                        <Input
                          id="base-rent"
                          type="number"
                          min="1"
                          value={
                            config.landlordBaseRent > 0
                              ? config.landlordBaseRent
                              : ''
                          }
                          onChange={(e) =>
                            update('landlordBaseRent', Number(e.target.value))
                          }
                        />
                      </Field>
                      <Field label="Maintenance" htmlFor="maintenance">
                        <Input
                          id="maintenance"
                          type="number"
                          min="0"
                          value={
                            config.landlordMaintenance >= 0
                              ? config.landlordMaintenance
                              : ''
                          }
                          onChange={(e) =>
                            update(
                              'landlordMaintenance',
                              Number(e.target.value),
                            )
                          }
                        />
                      </Field>
                      <Field label="Security deposit" htmlFor="deposit">
                        <Input
                          id="deposit"
                          type="number"
                          min="0"
                          value={
                            config.landlordDeposit >= 0
                              ? config.landlordDeposit
                              : ''
                          }
                          onChange={(e) =>
                            update('landlordDeposit', Number(e.target.value))
                          }
                        />
                      </Field>
                      <Field label="Improvement capex" htmlFor="capex">
                        <Input
                          id="capex"
                          type="number"
                          min="0"
                          value={
                            config.improvementCapex >= 0
                              ? config.improvementCapex
                              : ''
                          }
                          onChange={(e) =>
                            update('improvementCapex', Number(e.target.value))
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
                    ? `${missingConfigCount} required ${missingConfigCount === 1 ? 'field remains' : 'fields remain'}. Subject and commercial facts must be confirmed before analysis.`
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
