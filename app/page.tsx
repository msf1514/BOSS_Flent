'use client';
/* oxlint-disable react/react-compiler */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Download,
  FileCheck2,
  FilePlus2,
  FileUp,
  History,
  ListChecks,
  Loader2,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type {
  AuditRow,
  RunConfig,
  ValidationIssue,
} from '@/lib/evidence-engine';
import type { AuditEvent, EvidenceRequest, StoredRun } from '@/lib/storage';

type Notice = { kind: 'error' | 'success'; text: string } | null;
const money = (value: number | null) =>
  value === null
    ? '—'
    : new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(value);
const dateTime = (value: string) =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
const stateLabel: Record<string, string> = {
  include: 'Included',
  exclude: 'Excluded',
  duplicate_collapsed: 'Duplicate collapsed',
  needs_human_review: 'Needs review',
};
const defaults: RunConfig = {
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
const Field = ({
  label,
  wide,
  htmlFor,
  children,
}: {
  label: string;
  wide?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}) => (
  <div className={wide ? 'sm:col-span-2' : ''}>
    {htmlFor ? (
      <Label htmlFor={htmlFor} className="data-label mb-2 block">
        {label}
      </Label>
    ) : (
      <div className="data-label mb-2">{label}</div>
    )}
    {children}
  </div>
);
const Fact = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 rounded-md border bg-white p-3.5 shadow-[0_1px_1px_rgba(15,23,42,0.02)]">
    <dt className="data-label">{label}</dt>
    <dd className="mt-1.5 break-words font-medium leading-5">{value}</dd>
  </div>
);

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div aria-label="BOSS by Flent">
      <div className="flex items-end gap-2">
        <strong
          className={`${compact ? 'text-xl' : 'text-[1.7rem]'} brand-wordmark leading-none font-extrabold`}
        >
          BOSS
        </strong>
        <strong className="brand-accent pb-0.5 text-[0.68rem] font-bold tracking-[0.08em]">
          FLENT
        </strong>
      </div>
      <p className="mt-2 text-[0.62rem] font-semibold tracking-[0.13em] text-muted-foreground">
        SUPPLY ACQUISITION
      </p>
    </div>
  );
}

function ProductRail({
  current,
  onNew,
}: {
  current: 'setup' | 'evidence';
  onNew?: () => void;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen flex-col border-r bg-white px-4 py-7 lg:flex">
      <div className="px-3">
        <BrandMark />
      </div>
      <nav aria-label="BOSS module navigation" className="mt-10 space-y-2">
        <div
          className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold ${current === 'evidence' ? 'rail-active' : 'text-muted-foreground'}`}
        >
          <FileCheck2 aria-hidden="true" className="size-5" /> Market evidence
        </div>
        {onNew ? (
          <button
            type="button"
            onClick={onNew}
            className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-4 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <FilePlus2 aria-hidden="true" className="size-5" /> New evidence run
          </button>
        ) : (
          <div
            className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold ${current === 'setup' ? 'rail-active' : 'text-muted-foreground'}`}
          >
            <Settings2 aria-hidden="true" className="size-5" /> Run setup
          </div>
        )}
      </nav>
      <div className="mt-auto rounded-xl border bg-[var(--warm-canvas)] p-4">
        <p className="data-label">Pilot boundary</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Uploaded evidence only. No live scraping or capital decision.
        </p>
      </div>
    </aside>
  );
}

function StateBadge({ state }: { state: string }) {
  const tone =
    state === 'include'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : state === 'needs_human_review'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : state === 'duplicate_collapsed'
          ? 'border-sky-200 bg-sky-50 text-sky-800'
          : 'border-slate-200 bg-slate-50 text-slate-700';
  return (
    <Badge variant="outline" className={`gap-1.5 rounded-full px-2.5 ${tone}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {stateLabel[state] ?? state}
    </Badge>
  );
}

function Intake({ onCreated }: { onCreated: (run: StoredRun) => void }) {
  const [config, setConfig] = useState(defaults),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<Notice>(null),
    [issues, setIssues] = useState<ValidationIssue[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const update = (key: keyof RunConfig, value: string | number | boolean) =>
    setConfig((current) => ({ ...current, [key]: value }));
  async function sample() {
    const response = await fetch('/anonymised-deal-sample.csv');
    const blob = await response.blob();
    setFile(
      new File([blob], 'anonymised-deal-sample.csv', { type: 'text/csv' }),
    );
    setConfig({ ...defaults });
    setNotice({
      kind: 'success',
      text: 'Sample loaded. Packet annotations are applied only after the server verifies the exact source fingerprint.',
    });
  }
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setIssues([]);
    if (!file) {
      setNotice({
        kind: 'error',
        text: 'Select a CSV or load the anonymised sample.',
      });
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('config', JSON.stringify(config));
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
            payload.issues?.map((issue) => ({
              rowNumber: null,
              field: issue.field,
              code: 'INVALID_CONFIGURATION',
              message: issue.message,
              severity: 'error' as const,
            })) ??
            [],
        );
        throw new Error(payload.error ?? 'Run failed.');
      }
      onCreated(payload.run);
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Run failed.',
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <ProductRail current="setup" />
      <div className="min-w-0">
        <header className="border-b bg-white lg:hidden">
          <div className="app-shell flex min-h-16 items-center justify-between gap-4">
            <BrandMark compact />
            <Badge
              variant="outline"
              className="rounded-full border-slate-300 bg-slate-50 px-3 text-slate-700"
            >
              Controlled pilot
            </Badge>
          </div>
        </header>
        <main
          id="main-content"
          className="workbench-grid min-h-[calc(100vh-4rem)] py-8 lg:py-11"
        >
          <div className="app-shell">
            <div className="mb-8 grid gap-6 border-b border-slate-300/80 pb-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
              <div className="max-w-3xl">
                <p className="eyebrow mb-3">New evidence run</p>
                <h1 className="max-w-2xl text-3xl font-semibold leading-[1.12] tracking-[-0.035em] sm:text-[2.6rem]">
                  Build a defensible market view from source evidence.
                </h1>
                <p className="mt-4 max-w-2xl text-[1.0625rem] leading-7 text-muted-foreground">
                  Validate the source, preserve lineage, apply a declared
                  comparison policy and route exceptions to a human reviewer.
                </p>
              </div>
              <div className="rounded-xl border bg-white/90 p-4 shadow-[0_1px_2px_rgba(21,16,47,0.03)]">
                <p className="data-label">Decision boundary</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  This workbench evaluates evidence quality. It does not make
                  the investment decision.
                </p>
              </div>
            </div>
            <ol
              aria-label="Run creation steps"
              className="mb-5 grid overflow-hidden rounded-xl border bg-white shadow-[0_1px_2px_rgba(21,16,47,0.025)] sm:grid-cols-4"
            >
              {[
                ['1', 'Upload', 'Raw evidence'],
                ['2', 'Validate', 'Schema and rows'],
                ['3', 'Configure', 'Subject and policy'],
                ['4', 'Run', 'Versioned result'],
              ].map(([n, title, sub], i) => (
                <li
                  key={n}
                  className="relative flex items-center gap-3 border-b p-3.5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
                >
                  <span
                    className={`data-value grid size-7 place-items-center rounded-full text-xs font-semibold ${i === 0 ? 'bg-primary text-primary-foreground' : 'border bg-slate-50 text-muted-foreground'}`}
                  >
                    {n}
                  </span>
                  <span>
                    <strong className="block text-[0.8125rem] font-semibold">
                      {title}
                    </strong>
                    <span className="text-[0.6875rem] text-muted-foreground">
                      {sub}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            <form
              onSubmit={submit}
              className="grid gap-5 lg:grid-cols-[0.86fr_1.14fr]"
            >
              <Card className="self-start">
                <CardHeader className="border-b">
                  <p className="eyebrow">Source</p>
                  <CardTitle>1. Supply evidence</CardTitle>
                  <CardDescription>
                    CSV only, maximum 2 MB. Original bytes are retained with a
                    SHA-256 fingerprint.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="group flex min-h-52 w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-400 bg-[var(--warm-canvas)] p-6 text-center transition-colors hover:border-[var(--flent-teal)] hover:bg-[var(--flent-mint)] focus-visible:ring-3 focus-visible:ring-ring/30"
                  >
                    <span className="mb-4 grid size-11 place-items-center rounded-md border bg-white text-primary shadow-sm transition-colors group-hover:border-primary/40">
                      <FileUp aria-hidden="true" className="size-5" />
                    </span>
                    <span className="font-semibold tracking-[-0.01em]">
                      {file?.name ?? 'Choose a comparable-listings CSV'}
                    </span>
                    <span className="mt-1 text-sm text-muted-foreground">
                      {file
                        ? `${Math.ceil(file.size / 1024)} KB ready for validation`
                        : 'Required contract: 13 named columns'}
                    </span>
                  </button>
                  <input
                    ref={inputRef}
                    className="sr-only"
                    type="file"
                    accept=".csv,text/csv"
                    aria-label="Choose comparable-listings CSV"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] ?? null);
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={sample}
                    >
                      <FileCheck2 />
                      Use anonymised sample
                    </Button>
                    <a
                      href="/anonymised-deal-sample.csv"
                      download
                      className="inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Download className="size-4" />
                      Download sample
                    </a>
                  </div>
                  <div className="rounded-lg border bg-muted/35 p-3 text-xs leading-5 text-muted-foreground">
                    <strong className="text-foreground">
                      Required columns:
                    </strong>{' '}
                    listing_id, source, posted_date, last_seen_date, society,
                    locality, bhk, furnishing, area_sqft, rent, deposit,
                    photo_count, poster_type.
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="border-b">
                  <p className="eyebrow">Policy</p>
                  <CardTitle>2. Configure the run</CardTitle>
                  <CardDescription>
                    Explicit policy and deal inputs—not hidden defaults.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <Field label="Deal name" htmlFor="deal-name" wide>
                    <Input
                      id="deal-name"
                      value={config.dealName}
                      onChange={(e) => update('dealName', e.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Evidence cutoff" htmlFor="evidence-cutoff">
                    <Input
                      id="evidence-cutoff"
                      type="date"
                      value={config.evidenceCutoff}
                      onChange={(e) => update('evidenceCutoff', e.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Society match prefix" htmlFor="society-prefix">
                    <Input
                      id="society-prefix"
                      value={config.societyPrefix}
                      onChange={(e) => update('societyPrefix', e.target.value)}
                      required
                    />
                  </Field>
                  <Field label="BHK" htmlFor="subject-bhk">
                    <Input
                      id="subject-bhk"
                      type="number"
                      min="1"
                      value={config.bhk}
                      onChange={(e) => update('bhk', Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Subject area (sq ft)" htmlFor="subject-area">
                    <Input
                      id="subject-area"
                      type="number"
                      min="1"
                      value={config.areaSqft}
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
                      <option value="semi-furnished">Semi-furnished</option>
                      <option value="fully-furnished">Fully furnished</option>
                      <option value="unfurnished">Unfurnished</option>
                    </select>
                  </Field>
                  <Field label="Landlord base rent" htmlFor="base-rent">
                    <Input
                      id="base-rent"
                      type="number"
                      min="1"
                      value={config.landlordBaseRent}
                      onChange={(e) =>
                        update('landlordBaseRent', Number(e.target.value))
                      }
                    />
                  </Field>
                  <Field label="Monthly maintenance" htmlFor="maintenance">
                    <Input
                      id="maintenance"
                      type="number"
                      min="0"
                      value={config.landlordMaintenance}
                      onChange={(e) =>
                        update('landlordMaintenance', Number(e.target.value))
                      }
                    />
                  </Field>
                  <Field label="Security deposit" htmlFor="deposit">
                    <Input
                      id="deposit"
                      type="number"
                      min="0"
                      value={config.landlordDeposit}
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
                      value={config.improvementCapex}
                      onChange={(e) =>
                        update('improvementCapex', Number(e.target.value))
                      }
                    />
                  </Field>
                  <Field
                    label="Area tolerance (± sq ft)"
                    htmlFor="area-tolerance"
                  >
                    <Input
                      id="area-tolerance"
                      type="number"
                      min="0"
                      value={config.areaToleranceSqft}
                      onChange={(e) =>
                        update('areaToleranceSqft', Number(e.target.value))
                      }
                    />
                  </Field>
                  <Field label="Maximum age (days)" htmlFor="max-age">
                    <Input
                      id="max-age"
                      type="number"
                      min="1"
                      value={config.maxLastSeenAgeDays}
                      onChange={(e) =>
                        update('maxLastSeenAgeDays', Number(e.target.value))
                      }
                    />
                  </Field>
                  <div className="sm:col-span-2 rounded-xl border border-emerald-200 bg-[var(--flent-mint)] p-3.5 text-xs leading-5 text-emerald-950">
                    <strong className="font-semibold">
                      Calculation boundary:
                    </strong>{' '}
                    deposit and capex are versioned decision context. They do
                    not change the comparable-rent median.
                  </div>
                  <div className="sm:col-span-2 border-t pt-4">
                    <Button
                      disabled={busy}
                      size="lg"
                      className="w-full sm:w-auto"
                    >
                      {busy ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <ArrowRight />
                      )}
                      {busy
                        ? 'Validating and analysing…'
                        : 'Validate and create run'}
                    </Button>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Bad rows are rejected and disclosed. Missing schema blocks
                      the run.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </form>
            {notice && (
              <Alert
                className={`mt-5 ${notice.kind === 'error' ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}
              >
                <AlertCircle />
                <AlertTitle>
                  {notice.kind === 'error' ? 'Action required' : 'Ready'}
                </AlertTitle>
                <AlertDescription>{notice.text}</AlertDescription>
              </Alert>
            )}
            {issues.length > 0 && (
              <Card className="mt-5">
                <CardHeader>
                  <CardTitle>Validation report</CardTitle>
                  <CardDescription>
                    {issues.length} issues found.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {issues.slice(0, 30).map((issue, i) => (
                    <div
                      key={`${issue.code}-${i}`}
                      className="flex gap-3 rounded-lg border p-3 text-sm"
                    >
                      <Badge variant="outline">{issue.severity}</Badge>
                      <div>
                        <strong>{issue.code.replaceAll('_', ' ')}</strong>
                        <p className="text-muted-foreground">
                          {issue.rowNumber ? `Row ${issue.rowNumber}: ` : ''}
                          {issue.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function Workbench({
  initialRun,
  onNew,
}: {
  initialRun: StoredRun;
  onNew: () => void;
}) {
  const [run, setRun] = useState(initialRun),
    [tab, setTab] = useState('overview'),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('material'),
    [selected, setSelected] = useState<AuditRow | null>(null),
    [reason, setReason] = useState(''),
    [decision, setDecision] = useState<'include' | 'exclude' | 'defer'>(
      'defer',
    ),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<Notice>(null);
  const rerunKey = useRef<string | null>(null);
  const unresolved = run.readiness.unresolvedRequestCount,
    pending =
      run.readiness.pendingReviewCount + run.readiness.deferredReviewCount,
    ready = run.readiness.ready;
  const rows = useMemo(
    () =>
      run.rows.filter(
        (row) =>
          `${row.listingId} ${row.observed.source} ${row.observed.society} ${row.reasons.join(' ')}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (filter === 'all' ||
            (filter === 'material' && row.b2State !== 'exclude') ||
            row.b2State === filter),
      ),
    [run.rows, query, filter],
  );
  async function action(body: Record<string, unknown>) {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId: run.id,
          ...body,
        }),
      });
      const payload = (await response.json()) as {
        run?: StoredRun;
        error?: string;
      };
      if (!response.ok || !payload.run)
        throw new Error(payload.error ?? 'Action failed.');
      setRun(payload.run);
      setNotice({
        kind: 'success',
        text:
          body.action === 'rerun'
            ? `Version ${payload.run.versionNumber} created from the preserved source and recorded decisions.`
            : 'Change saved to audit history.',
      });
      return true;
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Action failed.',
      });
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function saveReview() {
    if (
      selected &&
      (await action({
        action: 'review',
        listingId: selected.listingId,
        decision,
        reason,
      }))
    ) {
      setSelected(null);
      setReason('');
    }
  }
  async function createChildRun() {
    rerunKey.current ??= crypto.randomUUID();
    const completed = await action({
      action: 'rerun',
      operationKey: rerunKey.current,
    });
    if (completed) rerunKey.current = null;
  }
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a href="#workbench-main" className="skip-link">
        Skip to workbench
      </a>
      <ProductRail current="evidence" onNew={onNew} />
      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur-md lg:hidden">
          <div className="app-shell flex min-h-16 items-center justify-between gap-4">
            <BrandMark compact />
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="data-value rounded-full border-slate-300 bg-slate-50"
              >
                v{run.versionNumber}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="min-h-10"
                onClick={onNew}
              >
                <FileUp />
                New upload
              </Button>
            </div>
          </div>
        </header>
        <main
          id="workbench-main"
          className="workbench-grid min-h-[calc(100vh-4rem)] py-6 lg:py-8"
        >
          <div className="app-shell">
            <div className="mb-5 flex flex-col gap-5 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`rounded-full px-2.5 ${
                      ready
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-amber-200 bg-amber-50 text-amber-900'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="mr-1 size-1.5 rounded-full bg-current"
                    />
                    {ready ? 'Decision-ready evidence' : 'Not decision-ready'}
                  </Badge>
                  <span className="data-value text-[0.6875rem] text-muted-foreground">
                    Run {run.id.slice(-8)} · {dateTime(run.createdAt)}
                  </span>
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] sm:text-[1.75rem]">
                  {run.dealName}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {unresolved} evidence requests unresolved ·{' '}
                  {run.readiness.pendingReviewCount} rows awaiting review ·{' '}
                  {run.readiness.deferredReviewCount} deferred · {run.filename}
                </p>
              </div>
              <Button
                size="lg"
                onClick={() => setTab(pending ? 'review' : 'evidence')}
              >
                {pending
                  ? 'Review highest-risk rows'
                  : 'Resolve evidence requests'}
                <ChevronRight />
              </Button>
            </div>
            <div
              aria-label="Evidence workflow status"
              className="grid overflow-hidden rounded-xl border bg-white shadow-[0_1px_2px_rgba(21,16,47,0.025)] sm:grid-cols-3 lg:grid-cols-6"
            >
              {[
                ['Captured', true],
                ['Validated', run.validation.errorCount === 0],
                ['Normalized', true],
                ['Analysed', true],
                ['Reviewed', pending === 0],
                ['Decision-ready', ready],
              ].map(([label, done]) => (
                <div
                  key={String(label)}
                  className={`flex min-h-12 items-center gap-2 border-b px-3 py-2.5 text-[0.8125rem] font-semibold last:border-b-0 sm:border-r sm:[&:nth-child(3)]:border-r-0 lg:border-b-0 lg:[&:nth-child(3)]:border-r lg:last:border-r-0 ${done ? 'bg-emerald-50/55 text-emerald-900' : 'bg-white text-muted-foreground'}`}
                >
                  {done ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <CircleDot className="size-4" />
                  )}
                  {label}
                </div>
              ))}
            </div>
            {notice && (
              <Alert
                className={`mt-4 ${notice.kind === 'error' ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}
              >
                <AlertCircle />
                <AlertTitle>
                  {notice.kind === 'error' ? 'Could not save' : 'Saved'}
                </AlertTitle>
                <AlertDescription>{notice.text}</AlertDescription>
              </Alert>
            )}
            <Tabs value={tab} onValueChange={setTab} className="mt-6">
              <div className="overflow-x-auto">
                <TabsList
                  variant="line"
                  aria-label="Workbench sections"
                  className="min-w-max border-b px-0"
                >
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="comparables">Comparables</TabsTrigger>
                  <TabsTrigger value="review">
                    Review queue · {pending}
                  </TabsTrigger>
                  <TabsTrigger value="evidence">
                    Evidence requests · {unresolved}
                  </TabsTrigger>
                  <TabsTrigger value="audit">Audit history</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="overview" className="pt-4">
                <Overview run={run} pending={pending} unresolved={unresolved} />
              </TabsContent>
              <TabsContent value="comparables" className="pt-4">
                <Comparables
                  run={run}
                  rows={rows}
                  query={query}
                  setQuery={setQuery}
                  filter={filter}
                  setFilter={setFilter}
                  setSelected={setSelected}
                />
              </TabsContent>
              <TabsContent value="review" className="pt-4">
                <Review run={run} onSelect={setSelected} />
              </TabsContent>
              <TabsContent value="evidence" className="pt-4">
                <Requests
                  key={run.id}
                  items={run.requests}
                  busy={busy}
                  save={(item) =>
                    action({
                      action: 'request',
                      requestId: item.id,
                      status: item.status,
                      owner: item.owner,
                      evidenceNote: item.evidenceNote,
                    })
                  }
                />
              </TabsContent>
              <TabsContent value="audit" className="pt-4">
                <Audit events={run.audit} />
              </TabsContent>
            </Tabs>
            <div className="my-6 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-[var(--flent-mint)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <strong className="text-sm text-emerald-950">
                  Completed versions are immutable.
                </strong>
                <p className="mt-1 text-xs text-emerald-900">
                  Decisions affect estimates only in a child run created from
                  the preserved raw source.
                </p>
              </div>
              <Button
                disabled={busy || run.reviews.length === 0}
                className="min-h-11"
                onClick={createChildRun}
              >
                {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Create version {run.versionNumber + 1}
              </Button>
            </div>
          </div>
        </main>
        <Dialog
          open={Boolean(selected)}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        >
          {selected && (
            <DialogContent className="top-0 right-0 bottom-0 left-auto flex h-dvh w-full max-w-xl translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none border-y-0 border-r-0 bg-white p-0 shadow-2xl sm:top-4 sm:right-4 sm:bottom-4 sm:h-[calc(100dvh-2rem)] sm:rounded-lg sm:border">
              <DialogHeader className="border-b px-5 py-5 pr-14 sm:px-6">
                <Badge
                  variant="outline"
                  className="mb-1 w-fit rounded-full border-slate-300 bg-slate-50"
                >
                  Human adjudication
                </Badge>
                <DialogTitle className="text-xl font-semibold tracking-[-0.025em]">
                  Review {selected.listingId}
                </DialogTitle>
                <DialogDescription className="leading-6">
                  System recommendation:{' '}
                  <strong className="text-foreground">
                    {stateLabel[selected.b2State]}
                  </strong>
                  . Human decisions are stored separately.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 px-5 py-5 text-sm sm:px-6">
                <Fact
                  label="Asking rent"
                  value={money(Number(selected.observed.rent))}
                />
                <Fact
                  label="Observed source"
                  value={String(selected.observed.source)}
                />
                <Fact
                  label="Attributes"
                  value={`${selected.observed.bhk} BHK · ${selected.observed.areaSqft ?? 'missing'} sq ft`}
                />
                <Fact
                  label="Last seen age"
                  value={`${selected.normalized.lastSeenAgeDays} days`}
                />
              </div>
              <div className="mx-5 rounded-md border bg-muted/30 p-3.5 text-sm sm:mx-6">
                <strong className="text-xs uppercase text-muted-foreground">
                  System reasons
                </strong>
                <p className="mt-2">
                  {selected.reasons.join(' · ').replaceAll('_', ' ') ||
                    'Meets policy'}
                </p>
              </div>
              <div className="mt-5 space-y-5 border-t px-5 py-5 sm:px-6">
                <Field label="Human decision">
                  <div className="grid grid-cols-3 gap-2">
                    {(['include', 'exclude', 'defer'] as const).map((item) => (
                      <Button
                        key={item}
                        variant={decision === item ? 'default' : 'outline'}
                        className="min-h-11 capitalize"
                        onClick={() => setDecision(item)}
                      >
                        {item}
                      </Button>
                    ))}
                  </div>
                </Field>
                <Field label="Reason required" htmlFor="review-reason">
                  <Textarea
                    id="review-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Record the evidence and rationale."
                  />
                </Field>
                <Button
                  size="lg"
                  className="w-full"
                  disabled={busy || reason.trim().length < 4}
                  onClick={saveReview}
                >
                  {busy ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <UserRoundCheck />
                  )}
                  Save review decision
                </Button>
              </div>
            </DialogContent>
          )}
        </Dialog>
      </div>
    </div>
  );
}

function Overview({
  run,
  pending,
  unresolved,
}: {
  run: StoredRun;
  pending: number;
  unresolved: number;
}) {
  const b2 = run.summary.baselines.B2,
    ask = run.config.landlordBaseRent + run.config.landlordMaintenance,
    deposit = run.config.landlordDeposit ?? 0,
    capex = run.config.improvementCapex ?? 0;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Defensible asking median"
          value={money(b2.estimate)}
          note={`${b2.count} effective comparables`}
        />
        <Metric
          label="Observed asking band"
          value={`${money(run.summary.band.p25)}–${money(run.summary.band.p75)}`}
          note="25th–75th percentile"
        />
        <Metric
          label="Owner monthly cost"
          value={money(ask)}
          note={`${money(run.config.landlordBaseRent)} rent + ${money(run.config.landlordMaintenance)} maintenance`}
        />
        <Metric
          label="Evidence confidence"
          value={run.summary.askingEvidenceConfidence}
          note={`Achievable rent remains ${run.summary.achievableBaseRentConfidence}`}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>What the evidence supports</CardTitle>
            <CardDescription>
              Bounded to this upload and policy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Line
              text={`B0: ${run.summary.baselines.B0.count} same-BHK rows → ${money(run.summary.baselines.B0.estimate)}`}
            />
            <Line
              text={`B1: ${run.summary.baselines.B1.count} policy-comparable rows → ${money(run.summary.baselines.B1.estimate)}`}
            />
            <Line
              text={`B2: ${b2.count} reviewed-weight rows → ${money(b2.estimate)}`}
            />
            <p className="flex gap-2 leading-6">
              <ShieldCheck className="mt-1 size-4 shrink-0 text-[var(--flent-teal)]" />
              {run.summary.decisionBoundary}
            </p>
          </CardContent>
        </Card>
        <Card className="border-amber-200">
          <CardHeader className="border-b border-amber-200/80">
            <CardTitle>Current blockers</CardTitle>
            <CardDescription>
              Readiness is a workflow state, not a confidence badge.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between rounded-md border bg-white p-3 text-sm">
              <span>Rows needing adjudication</span>
              <strong>{pending}</strong>
            </div>
            <div className="flex justify-between rounded-md border bg-white p-3 text-sm">
              <span>Evidence requests unresolved</span>
              <strong>{unresolved}</strong>
            </div>
            {run.summary.limitations.map((item) => (
              <p
                key={item}
                className="flex gap-2 text-xs leading-5 text-muted-foreground"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-700" />
                {item}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Deal economics context</CardTitle>
          <CardDescription>
            Captured and versioned, but intentionally excluded from the
            comparable-rent median.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <Fact label="Security deposit" value={money(deposit)} />
          <Fact label="Improvement capex" value={money(capex)} />
          <Fact
            label="Capital committed before operations"
            value={money(deposit + capex)}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="grid gap-3 py-4 text-xs sm:grid-cols-3">
          <Fact label="Input SHA-256" value={run.inputHash} />
          <Fact label="Engine" value={run.engineVersion} />
          <Fact
            label="Validation"
            value={`${run.validation.acceptedRows} accepted · ${run.validation.rejectedRows} rejected · ${run.validation.warningCount} warnings`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
const Metric = ({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) => (
  <Card>
    <CardContent className="py-5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="data-value mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </CardContent>
  </Card>
);
const Line = ({ text }: { text: string }) => (
  <p className="flex gap-2 leading-6">
    <Check className="mt-1 size-4 shrink-0 text-emerald-700" />
    {text}
  </p>
);

function Comparables({
  run,
  rows,
  query,
  setQuery,
  filter,
  setFilter,
  setSelected,
}: {
  run: StoredRun;
  rows: AuditRow[];
  query: string;
  setQuery: (v: string) => void;
  filter: string;
  setFilter: (v: string) => void;
  setSelected: (r: AuditRow) => void;
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Comparable ledger</CardTitle>
        <CardDescription>
          Every accepted row remains inspectable; effective weight controls the
          estimate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              aria-label="Search comparable listings"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ID, source, society or reason"
            />
          </div>
          <select
            aria-label="Filter comparable listings"
            className="control-select md:w-auto"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="material">Material rows</option>
            <option value="all">All rows</option>
            <option value="include">Included</option>
            <option value="needs_human_review">Needs review</option>
            <option value="duplicate_collapsed">Duplicate collapsed</option>
            <option value="exclude">Excluded</option>
          </select>
        </div>
        <div className="max-h-[620px] overflow-auto rounded-md border bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b bg-slate-100/95 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground backdrop-blur">
              <tr>
                <th className="p-3">Listing</th>
                <th className="p-3">Observed facts</th>
                <th className="p-3">Asking</th>
                <th className="p-3">System state</th>
                <th className="p-3">Weight</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.listingId}
                  tabIndex={0}
                  aria-label={`Inspect listing ${row.listingId}`}
                  className="cursor-pointer border-t transition-colors hover:bg-[var(--flent-mint)] focus-visible:bg-[var(--flent-mint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => setSelected(row)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelected(row);
                    }
                  }}
                >
                  <td className="p-3 font-semibold">
                    {row.listingId}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {String(row.observed.source)}
                    </span>
                  </td>
                  <td className="p-3">
                    {String(row.observed.society)}
                    <span className="block text-xs text-muted-foreground">
                      {String(row.observed.bhk)} BHK ·{' '}
                      {String(row.observed.areaSqft ?? '—')} sq ft ·{' '}
                      {row.normalized.furnishing}
                    </span>
                  </td>
                  <td className="data-value p-3 font-medium">
                    {money(Number(row.observed.rent))}
                  </td>
                  <td className="p-3">
                    <StateBadge state={row.b2State} />
                  </td>
                  <td className="data-value p-3">{row.effectiveWeight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {rows.length} of {run.rows.length} accepted rows shown. Select any row
          to inspect and adjudicate.
        </p>
      </CardContent>
    </Card>
  );
}
function Review({
  run,
  onSelect,
}: {
  run: StoredRun;
  onSelect: (r: AuditRow) => void;
}) {
  const rows = run.rows.filter((row) => row.b2State === 'needs_human_review');
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Human review queue</CardTitle>
        <CardDescription>
          System recommendations are never represented as reviewer decisions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && (
          <div className="grid min-h-48 place-items-center rounded-md border border-dashed bg-slate-50/60 p-6 text-center">
            <div>
              <ListChecks
                aria-hidden="true"
                className="mx-auto size-6 text-emerald-700"
              />
              <p className="mt-3 font-semibold">No rows require review</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The current run has no unresolved adjudication candidates.
              </p>
            </div>
          </div>
        )}
        {rows.map((row) => {
          const review = run.reviews.find(
            (item) => item.listingId === row.listingId,
          );
          return (
            <button
              key={row.listingId}
              className="flex min-h-16 w-full cursor-pointer items-center justify-between gap-3 rounded-md border bg-white p-3.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-3 focus-visible:ring-ring/25"
              onClick={() => onSelect(row)}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm">{row.listingId}</strong>
                  <StateBadge state={row.b2State} />
                  {review && (
                    <Badge
                      variant="outline"
                      className="border-violet-200 bg-violet-50 text-violet-800"
                    >
                      Human: {review.decision}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.reasons.join(' · ').replaceAll('_', ' ')}
                </p>
              </div>
              <ChevronRight className="size-4" />
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
function Requests({
  items,
  busy,
  save,
}: {
  items: EvidenceRequest[];
  busy: boolean;
  save: (item: EvidenceRequest) => Promise<unknown>;
}) {
  const [drafts, setDrafts] = useState(items);
  const change = (id: string, key: keyof EvidenceRequest, value: string) =>
    setDrafts((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [key]: value } : item,
      ),
    );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {drafts.map((item) => (
        <Card key={item.id}>
          <CardHeader className="border-b">
            <CardTitle className="text-base">{item.title}</CardTitle>
            <CardDescription>
              Evidence is never marked complete automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Owner" htmlFor={`owner-${item.id}`}>
              <Input
                id={`owner-${item.id}`}
                value={item.owner}
                onChange={(e) => change(item.id, 'owner', e.target.value)}
              />
            </Field>
            <Field label="Evidence note" htmlFor={`note-${item.id}`}>
              <Textarea
                id={`note-${item.id}`}
                value={item.evidenceNote}
                onChange={(e) =>
                  change(item.id, 'evidenceNote', e.target.value)
                }
                placeholder="Reference the document, source or blocker."
              />
            </Field>
            <div className="flex gap-2">
              <select
                aria-label={`Status for ${item.title}`}
                className="control-select w-auto"
                value={item.status}
                onChange={(e) => change(item.id, 'status', e.target.value)}
              >
                <option value="open">Open</option>
                <option value="blocked">Blocked</option>
                <option value="resolved">Resolved</option>
              </select>
              <Button
                disabled={busy}
                className="min-h-11"
                onClick={() => save(item)}
              >
                Save request
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
function Audit({ events }: { events: AuditEvent[] }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Audit history</CardTitle>
        <CardDescription>
          Append-only records reconstruct who changed what and when.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol>
          {events.map((event) => (
            <li
              key={event.id}
              className="flex gap-3 border-b py-4 last:border-0"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full border bg-slate-50 text-primary">
                <History className="size-3.5" />
              </span>
              <div>
                <p className="text-sm font-semibold">
                  {event.eventType.replaceAll('_', ' ')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {event.actor} · {dateTime(event.createdAt)}
                </p>
                <code className="mt-2 block max-w-3xl overflow-x-auto rounded-md border bg-slate-50 p-2.5 text-[0.6875rem] leading-5 text-slate-700">
                  {JSON.stringify(event.payload)}
                </code>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

export default function Page() {
  const [run, setRun] = useState<StoredRun | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/runs', { cache: 'no-store' }),
        payload = (await response.json()) as {
          runs?: Array<{ id: string }>;
          error?: string;
        };
      if (!response.ok) throw new Error(payload.error);
      if (payload.runs?.[0]) {
        const detail = await fetch(`/api/runs?id=${payload.runs[0].id}`, {
            cache: 'no-store',
          }),
          data = (await detail.json()) as { run?: StoredRun };
        if (detail.ok && data.run) setRun(data.run);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load workspace.');
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
        <div className="flex items-center gap-3 rounded-lg border bg-white px-5 py-4 shadow-sm">
          <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
            <Building2 aria-hidden="true" className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Opening evidence workspace</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Loading the latest versioned run
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
    <Workbench initialRun={run} onNew={() => setRun(null)} />
  ) : (
    <Intake onCreated={setRun} />
  );
}
