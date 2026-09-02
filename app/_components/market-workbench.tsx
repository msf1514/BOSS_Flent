'use client';
/* oxlint-disable react/react-compiler */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  FileCheck2,
  History,
  LockKeyhole,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { AuditRow } from '@/lib/evidence-engine';
import { assessMarketReview, requestPurpose } from '@/lib/market-review';
import type { AuditEvent, EvidenceRequest, StoredRun } from '@/lib/storage';
import { MobileHeader, ProductRail } from './boss-shell';
import {
  EvidenceFunnel,
  MarketAnswer,
  NextSteps,
  ProblemOneOrientation,
  ScopeNote,
  TrustSignals,
} from './problem-one-overview';
import { ConfidenceDerivation, ReasonChips, RemediationGuide } from './trust-vocabulary';

type Notice = { kind: 'error' | 'success'; text: string } | null;
type ReviewDecision = 'include' | 'exclude' | 'defer';

const money = (value: number | null) =>
  value === null
    ? 'Not available'
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
  include: 'Current comparable',
  exclude: 'Outside policy',
  duplicate_collapsed: 'Likely duplicate',
  needs_human_review: 'Needs judgment',
};

const reviewLabel: Record<ReviewDecision, string> = {
  include: 'Use as comparable',
  exclude: 'Remove from evidence set',
  defer: 'Await evidence',
};

export function MarketWorkbench({
  initialRun,
  onNew,
  onDeals,
}: {
  initialRun: StoredRun;
  onNew: () => void;
  onDeals?: () => void;
}) {
  const [run, setRun] = useState(initialRun);
  const [section, setSection] = useState('overview');
  const [marketTab, setMarketTab] = useState('summary');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('material');
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [reason, setReason] = useState('');
  const [decision, setDecision] = useState<ReviewDecision>('defer');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completionRationale, setCompletionRationale] = useState('');
  const rerunKey = useRef<string | null>(null);
  const busy = busyAction !== null;
  const pending =
    run.readiness.pendingReviewCount + run.readiness.deferredReviewCount;
  const unresolved = run.readiness.unresolvedRequestCount;
  const assessment = assessMarketReview({
    config: run.config,
    summary: run.summary,
    readiness: run.readiness,
    closure: run.reviewClosure,
    hasUnappliedReviews: run.reviews.length > 0,
  });

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

  useEffect(() => {
    if (!selected) {
      setDecision('defer');
      setReason('');
      return;
    }
    const existing = run.reviews.find(
      (item) => item.listingId === selected.listingId,
    );
    setDecision(existing?.decision ?? 'defer');
    setReason(existing?.reason ?? '');
  }, [selected, run.reviews]);

  async function action(body: Record<string, unknown>) {
    const operation =
      body.action === 'review'
        ? `review:${String(body.listingId)}`
        : body.action === 'request'
          ? `request:${String(body.requestId)}`
          : String(body.action);
    setBusyAction(operation);
    setNotice(null);
    try {
      const response = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: run.id, ...body }),
      });
      const payload = (await response.json()) as {
        run?: StoredRun;
        error?: string;
      };
      if (!response.ok || !payload.run)
        throw new Error(payload.error ?? 'Action failed.');
      setRun(payload.run);
      const messages: Record<string, string> = {
        rerun: `Evidence version ${payload.run.versionNumber} created. Recorded judgments now affect the estimate.`,
        complete_review:
          'Market review completed. The evidence packet is now frozen for the wider deal decision.',
      };
      setNotice({
        kind: 'success',
        text:
          messages[String(body.action)] ??
          (body.action === 'review'
            ? `${String(body.listingId)} saved as “${reviewLabel[String(body.decision) as ReviewDecision]}”.`
            : 'Evidence task updated.'),
      });
      return true;
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Action failed.',
      });
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  async function saveReview() {
    if (!selected) return;
    if (
      await action({
        action: 'review',
        listingId: selected.listingId,
        decision,
        reason,
      })
    ) {
      setSelected(null);
    }
  }

  async function raiseTaskForListing(title: string, note: string) {
    return action({
      action: 'create_request',
      title,
      owner: 'Unassigned',
      evidenceNote: note,
    });
  }

  async function createChildRun() {
    rerunKey.current ??= crypto.randomUUID();
    const completed = await action({
      action: 'rerun',
      operationKey: rerunKey.current,
    });
    if (completed) rerunKey.current = null;
  }

  async function completeReview() {
    if (
      await action({
        action: 'complete_review',
        disposition: assessment.completionDisposition,
        rationale: completionRationale,
      })
    ) {
      setCompletionOpen(false);
      setCompletionRationale('');
    }
  }

  function openNextAction() {
    setSection('market');
    setMarketTab(
      run.reviews.length > 0
        ? 'summary'
        : pending > 0
          ? 'review'
          : unresolved > 0
            ? 'tasks'
            : 'summary',
    );
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a href="#deal-main" className="skip-link">
        Skip to deal
      </a>
      <ProductRail current="deals" onNew={onNew} onDeals={onDeals} />
      <div className="min-w-0">
        <MobileHeader version={run.versionNumber} />
        <main
          id="deal-main"
          className="workbench-grid min-h-screen py-6 lg:py-8"
        >
          <div className="app-shell max-w-[1440px]">
            <header className="sticky top-0 z-30 -mx-4 border-b bg-[var(--warm-canvas)]/95 px-4 pt-2 pb-4 backdrop-blur supports-[backdrop-filter]:bg-[var(--warm-canvas)]/80 sm:-mx-6 sm:px-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      state={assessment.state}
                      label={assessment.statusLabel}
                    />
                    <span className="data-value text-[0.6875rem] text-muted-foreground">
                      Evidence v{run.versionNumber} · {dateTime(run.createdAt)}
                    </span>
                  </div>
                  <h1 className="mt-3 text-3xl font-bold tracking-[-0.045em] sm:text-[2rem]">
                    {run.dealName}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Market evidence from {run.filename} · Review owner:
                    Acquisition team
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={onNew}>
                    Add new evidence
                  </Button>
                  {assessment.state === 'ready_to_complete' ? (
                    <Button onClick={() => setCompletionOpen(true)}>
                      <ClipboardCheck /> Complete market review
                    </Button>
                  ) : assessment.state === 'complete' ? (
                    <Button
                      variant="outline"
                      onClick={() => setSection('overview')}
                    >
                      <CheckCircle2 /> View handoff
                    </Button>
                  ) : (
                    <Button onClick={openNextAction}>
                      Continue review <ArrowRight />
                    </Button>
                  )}
                </div>
              </div>
            </header>

            <Tabs value={section} onValueChange={setSection} className="mt-2">
              <div className="overflow-x-auto">
                <TabsList
                  variant="line"
                  aria-label="Deal sections"
                  className="min-w-max border-b px-0"
                >
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="market">Market</TabsTrigger>
                  <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
                  <TabsTrigger value="economics">Economics</TabsTrigger>
                  <TabsTrigger value="quality">Quality</TabsTrigger>
                  <TabsTrigger value="closing">Closing</TabsTrigger>
                </TabsList>
              </div>

              {notice && (
                <Alert
                  role={notice.kind === 'error' ? 'alert' : 'status'}
                  aria-live={notice.kind === 'error' ? 'assertive' : 'polite'}
                  className={`mt-4 ${notice.kind === 'error' ? 'border-red-200 bg-red-50' : 'border-teal-200 bg-teal-50'}`}
                >
                  {notice.kind === 'error' ? <AlertCircle /> : <CheckCircle2 />}
                  <AlertTitle>
                    {notice.kind === 'error'
                      ? 'Could not complete the action'
                      : 'Action completed'}
                  </AlertTitle>
                  <AlertDescription>{notice.text}</AlertDescription>
                </Alert>
              )}

              <TabsContent value="overview" className="pt-5">
                <DealOverview
                  run={run}
                  assessment={assessment}
                  pending={pending}
                  unresolved={unresolved}
                  onOpenMarket={() => setSection('market')}
                  isComplete={Boolean(run.reviewClosure)}
                  onComplete={() => setCompletionOpen(true)}
                />
              </TabsContent>
              <TabsContent value="market" className="pt-5">
                <MarketWorkspace
                  run={run}
                  assessment={assessment}
                  pending={pending}
                  unresolved={unresolved}
                  marketTab={marketTab}
                  setMarketTab={setMarketTab}
                  rows={rows}
                  query={query}
                  setQuery={setQuery}
                  filter={filter}
                  setFilter={setFilter}
                  setSelected={setSelected}
                  busyAction={busyAction}
                  action={action}
                  createChildRun={createChildRun}
                />
              </TabsContent>
              <TabsContent value="occupancy" className="pt-5">
                <ScopeNote dimension="Occupancy and demand" />
              </TabsContent>
              <TabsContent value="economics" className="pt-5">
                <ScopeNote dimension="Deal economics" />
              </TabsContent>
              <TabsContent value="quality" className="pt-5">
                <ScopeNote dimension="Property quality" />
              </TabsContent>
              <TabsContent value="closing" className="pt-5">
                <ScopeNote dimension="Closing and negotiation" />
              </TabsContent>
            </Tabs>
          </div>
        </main>

        <ReviewDialog
          row={selected}
          existing={
            selected
              ? run.reviews.find(
                  (item) => item.listingId === selected.listingId,
                )
              : undefined
          }
          decision={decision}
          setDecision={setDecision}
          reason={reason}
          setReason={setReason}
          busy={busy}
          onSave={saveReview}
          onClose={() => setSelected(null)}
          onRaiseTask={async (title) => {
            const listingRef = selected ? ` (${selected.listingId})` : '';
            if (await raiseTaskForListing(`${title}${listingRef}`, '')) {
              setSelected(null);
              setSection('tasks');
            }
          }}
          onReupload={() => {
            setSelected(null);
            onNew();
          }}
        />

        <Dialog open={completionOpen} onOpenChange={setCompletionOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Complete this market review</DialogTitle>
              <DialogDescription>
                This freezes evidence version {run.versionNumber}, its source
                hash, comparable decisions and limitations. It does not
                authorize acquisition or close the deal.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
              Outcome:{' '}
              <strong>
                {assessment.completionDisposition === 'insufficient_evidence'
                  ? 'Insufficient evidence'
                  : 'Usable with caveats'}
              </strong>
            </div>
            <div>
              <Label htmlFor="completion-rationale">Your rationale</Label>
              <Textarea
                id="completion-rationale"
                className="mt-2"
                value={completionRationale}
                onChange={(event) => setCompletionRationale(event.target.value)}
                placeholder="Say why this market evidence is ready to hand off, and what still needs checking."
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Required · 20 characters minimum
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCompletionOpen(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={busy || completionRationale.trim().length < 20}
                onClick={completeReview}
              >
                {busyAction === 'complete_review' ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <ClipboardCheck />
                )}
                {busyAction === 'complete_review'
                  ? 'Completing…'
                  : 'Complete market review'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function StatusBadge({ state, label }: { state: string; label: string }) {
  const tone =
    state === 'complete'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : state === 'ready_to_complete'
        ? 'border-teal-200 bg-teal-50 text-teal-900'
        : 'border-amber-200 bg-amber-50 text-amber-900';
  return (
    <Badge variant="outline" className={`rounded-full px-2.5 ${tone}`}>
      <span
        aria-hidden="true"
        className="mr-1 size-1.5 rounded-full bg-current"
      />
      {label}
    </Badge>
  );
}

function DealOverview({
  run,
  assessment,
  pending,
  unresolved,
  onOpenMarket,
  isComplete,
  onComplete,
}: {
  run: StoredRun;
  assessment: ReturnType<typeof assessMarketReview>;
  pending: number;
  unresolved: number;
  onOpenMarket: () => void;
  isComplete: boolean;
  onComplete: () => void;
}) {
  return (
    <div className="space-y-4">
      <ProblemOneOrientation run={run} />
      <MarketAnswer
        median={assessment.marketMedian ?? 0}
        confidence={run.summary.askingEvidenceConfidence}
        trustedCount={run.summary.baselines.B2.count}
        portals={run.summary.observedPortalLabelCount}
        looMovementPct={run.summary.maximumLeaveOneOutMovementPct}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <ConfidenceDerivation
          confidence={run.summary.askingEvidenceConfidence}
          trustedCount={run.summary.baselines.B2.count}
          portals={run.summary.observedPortalLabelCount}
          looMovementPct={run.summary.maximumLeaveOneOutMovementPct}
          rows={run.rows}
        />
        <EvidenceFunnel
          all={run.summary.baselines.B0.count}
          matched={run.summary.baselines.B1.count}
          trusted={run.summary.baselines.B2.count}
        />
      </div>
      <TrustSignals rows={run.rows} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Trusted comparables"
          value={String(run.summary.baselines.B2.count)}
          note="Listings that count toward the rate"
        />
        <Metric
          label="Middle 50% of asking rents"
          value={`${money(run.summary.band.p25)} – ${money(run.summary.band.p75)}`}
          note="Where most comparable asks sit"
        />
        <Metric
          label="Work remaining"
          value={`${pending + unresolved}`}
          note={`${pending} listing decisions · ${unresolved} evidence tasks`}
        />
      </div>
      <div>
        <Card
          className={
            assessment.state === 'complete'
              ? 'border-emerald-200'
              : 'border-amber-200'
          }
        >
          <CardContent className="flex h-full flex-col py-6">
            <p className="eyebrow">Current market posture</p>
            <h2 className="mt-3 text-2xl font-bold tracking-[-0.035em]">
              {assessment.headline}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {assessment.explanation}
            </p>
            <div className="mt-5 rounded-lg border bg-white p-4">
              <p className="data-label">Next action</p>
              <p className="mt-2 text-sm font-semibold leading-6">
                {assessment.nextAction}
              </p>
            </div>
            <Button
              className="mt-auto pt-0"
              variant="link"
              onClick={onOpenMarket}
            >
              Open market evidence <ChevronRight />
            </Button>
          </CardContent>
        </Card>
      </div>
      <NextSteps
        isComplete={isComplete}
        onComplete={onComplete}
        blockers={pending + unresolved}
      />
      <PendingByOwner
        requests={run.requests}
        pendingListings={pending}
        onOpenMarket={onOpenMarket}
      />
    </div>
  );
}

// Real cross-functional model for a market review: the open evidence tasks that
// still block this market evidence, grouped by who owns them. This replaces the
// generic 'people collaborate' blurb — it shows exactly what is pending, with
// whom, and that it must clear before the evidence can be frozen.
function PendingByOwner({
  requests,
  pendingListings,
  onOpenMarket,
}: {
  requests: StoredRun['requests'];
  pendingListings: number;
  onOpenMarket: () => void;
}) {
  const openTasks = requests.filter((r) => r.status !== 'resolved');
  const byOwner = new Map<string, typeof openTasks>();
  for (const task of openTasks) {
    const owner = task.owner || 'Unassigned';
    byOwner.set(owner, [...(byOwner.get(owner) ?? []), task]);
  }
  const nothingPending = openTasks.length === 0 && pendingListings === 0;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>What&apos;s pending, and with whom</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Collaboration on a market review is concrete: these items must clear
          before the evidence can be frozen. Each is owned by a role and tracked
          in the history.
        </p>
      </CardHeader>
      <CardContent className="py-5">
        {nothingPending ? (
          <p className="text-sm text-muted-foreground">
            Nothing is pending — every listing has been reviewed and no evidence
            task is open. This market evidence is ready to freeze.
          </p>
        ) : (
          <div className="space-y-4">
            {pendingListings > 0 && (
              <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                <div>
                  <p className="text-sm font-semibold">
                    Market reviewer · {pendingListings} listing
                    {pendingListings === 1 ? '' : 's'} need a call
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Flagged rows awaiting an include / exclude decision.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={onOpenMarket}>
                  Review
                </Button>
              </div>
            )}
            {Array.from(byOwner.entries()).map(([owner, tasks]) => (
              <div key={owner} className="rounded-lg border p-3">
                <p className="text-sm font-semibold">
                  {owner}
                  <span className="ml-2 font-normal text-muted-foreground">
                    · {tasks.length} pending
                  </span>
                </p>
                <ul className="mt-2 space-y-1.5">
                  {tasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span>{task.title}</span>
                      <Badge
                        variant="outline"
                        className={
                          task.status === 'blocked'
                            ? 'shrink-0 border-red-200 bg-red-50 text-red-800'
                            : 'shrink-0 border-amber-200 bg-amber-50 text-amber-900'
                        }
                      >
                        {task.owner && task.owner !== 'Unassigned'
                          ? `With ${task.owner}`
                          : 'Unassigned'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MarketWorkspace(props: {
  run: StoredRun;
  assessment: ReturnType<typeof assessMarketReview>;
  pending: number;
  unresolved: number;
  marketTab: string;
  setMarketTab: (value: string) => void;
  rows: AuditRow[];
  query: string;
  setQuery: (value: string) => void;
  filter: string;
  setFilter: (value: string) => void;
  setSelected: (row: AuditRow) => void;
  busyAction: string | null;
  action: (body: Record<string, unknown>) => Promise<boolean>;
  createChildRun: () => Promise<void>;
}) {
  return (
    <div>
      <MarketPipeline
        run={props.run}
        pending={props.pending}
        unresolved={props.unresolved}
      />
      <Tabs
        value={props.marketTab}
        onValueChange={props.setMarketTab}
        className="mt-5"
      >
        <div className="overflow-x-auto">
          <TabsList
            variant="line"
            className="min-w-max border-b px-0"
            aria-label="Market evidence sections"
          >
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="comparables">Comparables</TabsTrigger>
            <TabsTrigger value="review">
              Needs your call · {props.pending}
            </TabsTrigger>
            <TabsTrigger value="tasks">
              Evidence tasks · {props.unresolved}
            </TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="summary" className="pt-4">
          <MarketSummary
            run={props.run}
            assessment={props.assessment}
            createChildRun={props.createChildRun}
            busy={props.busyAction !== null}
          />
        </TabsContent>
        <TabsContent value="comparables" className="pt-4">
          <Comparables
            run={props.run}
            rows={props.rows}
            query={props.query}
            setQuery={props.setQuery}
            filter={props.filter}
            setFilter={props.setFilter}
            setSelected={props.setSelected}
          />
        </TabsContent>
        <TabsContent value="review" className="pt-4">
          <ComparableReview run={props.run} onSelect={props.setSelected} />
        </TabsContent>
        <TabsContent value="tasks" className="pt-4">
          <EvidenceTasks
            key={props.run.id}
            items={props.run.requests}
            locked={Boolean(props.run.reviewClosure)}
            busyId={
              props.busyAction?.startsWith('request:')
                ? props.busyAction.slice(8)
                : null
            }
            save={(item) =>
              props.action({
                action: 'request',
                requestId: item.id,
                status: item.status,
                owner: item.owner,
                evidenceNote: item.evidenceNote,
              })
            }
          />
        </TabsContent>
        <TabsContent value="history" className="pt-4">
          <AuditHistory events={props.run.audit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MarketPipeline({
  run,
  pending,
  unresolved,
}: {
  run: StoredRun;
  pending: number;
  unresolved: number;
}) {
  const steps = [
    ['Source captured', true],
    ['Analysis completed', true],
    ['Flagged rows resolved', pending === 0],
    ['Evidence tasks', unresolved === 0],
    ['Market review complete', Boolean(run.reviewClosure)],
  ] as const;
  return (
    <div
      aria-label="Market review workflow"
      className="grid overflow-hidden rounded-xl border bg-white sm:grid-cols-5"
    >
      {steps.map(([label, done], index) => (
        <div
          key={label}
          className={`relative flex min-h-14 items-center gap-2 border-b px-3 py-3 text-sm font-semibold last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0 ${done ? 'bg-teal-50/70 text-teal-950' : 'text-muted-foreground'}`}
        >
          {done ? (
            <CheckCircle2 className="size-4 shrink-0" />
          ) : (
            <CircleDot className="size-4 shrink-0" />
          )}
          <span>
            {index + 1}. {label}
          </span>
        </div>
      ))}
    </div>
  );
}

function MarketSummary({
  run,
  assessment,
  createChildRun,
  busy,
}: {
  run: StoredRun;
  assessment: ReturnType<typeof assessMarketReview>;
  createChildRun: () => Promise<void>;
  busy: boolean;
}) {
  const b = run.summary.baselines;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Current asking-rent median"
          value={money(b.B2.estimate)}
          note={`${b.B2.count} current comparables`}
        />
        <Metric
          label="Middle 50% of asking rents"
          value={`${money(run.summary.band.p25)} – ${money(run.summary.band.p75)}`}
          note="25th to 75th percentile"
        />
        <Metric
          label="Portals in the rate"
          value={String(run.summary.observedPortalLabelCount)}
          note="Different sources in the trusted set"
        />
        <Metric
          label="Reliance on one listing"
          value={
            run.summary.maximumLeaveOneOutMovementPct === null
              ? 'Not available'
              : `${run.summary.maximumLeaveOneOutMovementPct}%`
          }
          note="How much the rate moves if the most influential listing is dropped"
        />
      </div>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>How the evidence was narrowed</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            From every listing in the file down to the ones we trust for the
            rate.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 py-5 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
          <Stage
            label="Broad reference set"
            count={b.B0.count}
            estimate={b.B0.estimate}
            detail="Every valid listing that matches the home's BHK."
          />
          <ChevronRight className="hidden size-5 text-muted-foreground md:block" />
          <Stage
            label="Policy-matched comparables"
            count={b.B1.count}
            estimate={b.B1.estimate}
            detail="Subject society, size, furnishing and freshness rules applied; likely duplicates collapsed."
          />
          <ChevronRight className="hidden size-5 text-muted-foreground md:block" />
          <Stage
            label="Current evidence set"
            count={b.B2.count}
            estimate={b.B2.estimate}
            detail="Policy-matched listings after recorded human judgments are incorporated."
          />
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-amber-200">
          <CardHeader className="border-b border-amber-200">
            <CardTitle>What this estimate can&apos;t tell you</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 py-5">
            {run.summary.limitations.map((item) => (
              <p key={item} className="flex gap-2 text-sm leading-6">
                <AlertCircle className="mt-1 size-4 shrink-0 text-amber-700" />
                {item}
              </p>
            ))}
            <p className="flex gap-2 border-t pt-3 text-sm font-semibold leading-6">
              <ShieldCheck className="mt-1 size-4 shrink-0 text-teal-700" />
              {run.summary.decisionBoundary}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Version control</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 py-5">
            <p className="text-sm leading-6 text-muted-foreground">
              Human judgments never rewrite a completed result. Create a child
              version to apply them, then complete the market review from that
              exact version.
            </p>
            <div className="grid gap-2 text-xs sm:grid-cols-2">
              <Fact
                label="Current version"
                value={`Evidence v${run.versionNumber}`}
              />
              <Fact
                label="Recorded judgments"
                value={String(run.reviews.length)}
              />
            </div>
            <Button
              disabled={
                busy || run.reviews.length === 0 || Boolean(run.reviewClosure)
              }
              onClick={createChildRun}
            >
              <RefreshCw />
              {busy
                ? 'Creating version…'
                : `Apply judgments in version ${run.versionNumber + 1}`}
            </Button>
            {assessment.state === 'ready_to_complete' && (
              <p className="text-xs font-semibold text-teal-800">
                No unapplied judgments remain. This version is ready to
                complete.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stage({
  label,
  count,
  estimate,
  detail,
}: {
  label: string;
  count: number;
  estimate: number | null;
  detail: string;
}) {
  return (
    <div className="rounded-lg border bg-slate-50/60 p-4">
      <p className="data-label">{label}</p>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <strong className="data-value text-xl">{count} rows</strong>
        <span className="data-value text-sm">{money(estimate)}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

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
        <CardTitle>Listing-by-listing review</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Every accepted row stays inspectable. Select a row to see why it is or
          is not influencing the current set.
        </p>
      </CardHeader>
      <CardContent className="py-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
            <Input
              aria-label="Search comparable listings"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by ID, source, society or reason"
            />
          </div>
          <select
            aria-label="Filter comparable listings"
            className="control-select md:w-auto"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="material">Rows that matter</option>
            <option value="all">All rows</option>
            <option value="include">Counts toward the rate</option>
            <option value="needs_human_review">Needs your call</option>
            <option value="duplicate_collapsed">Likely duplicates</option>
            <option value="exclude">Filtered out</option>
          </select>
        </div>
        <div className="table-scroll rounded-md border bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b bg-slate-100/95 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <th className="p-3">Listing</th>
                <th className="p-3">What was listed</th>
                <th className="p-3">Asking rent</th>
                <th className="p-3">What we did with it</th>
                <th className="p-3">Counts toward rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.listingId}
                  tabIndex={0}
                  aria-label={`Inspect listing ${row.listingId}`}
                  className="cursor-pointer border-t transition-colors hover:bg-teal-50 focus-visible:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
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
                      {String(row.observed.areaSqft ?? 'area missing')} sq ft ·{' '}
                      {row.normalized.furnishing}
                    </span>
                  </td>
                  <td className="data-value p-3 font-medium">
                    {money(Number(row.observed.rent))}
                  </td>
                  <td className="p-3">
                    <RowStateBadge state={row.b2State} />
                    <div className="mt-1.5">
                      <ReasonChips reasons={row.reasons} limit={2} />
                    </div>
                  </td>
                  <td className="p-3 font-semibold">
                    {row.effectiveWeight === 1 ? 'Yes' : 'No'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {rows.length} of {run.rows.length} accepted rows shown.
        </p>
      </CardContent>
    </Card>
  );
}

function RowStateBadge({ state }: { state: string }) {
  const tone =
    state === 'include'
      ? 'border-teal-200 bg-teal-50 text-teal-900'
      : state === 'needs_human_review'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : state === 'duplicate_collapsed'
          ? 'border-sky-200 bg-sky-50 text-sky-800'
          : 'border-slate-200 bg-slate-50 text-slate-700';
  return (
    <Badge variant="outline" className={`rounded-full ${tone}`}>
      <span
        aria-hidden="true"
        className="mr-1 size-1.5 rounded-full bg-current"
      />
      {stateLabel[state] ?? state}
    </Badge>
  );
}

function ComparableReview({
  run,
  onSelect,
}: {
  run: StoredRun;
  onSelect: (row: AuditRow) => void;
}) {
  const reviewRows = run.rows.filter(
    (row) => row.b2State === 'needs_human_review',
  );
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Listings that need your call</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Decide whether flagged listings should influence the current evidence
          set. This is human judgment about ambiguous rows—not general task
          management.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 py-5">
        {reviewRows.length === 0 && (
          <EmptyState
            title="No listings need judgment"
            detail="The current version contains no unresolved comparable candidates."
          />
        )}
        {reviewRows.map((row) => {
          const review = run.reviews.find(
            (item) => item.listingId === row.listingId,
          );
          return (
            <button
              key={row.listingId}
              className="flex min-h-16 w-full cursor-pointer items-center justify-between gap-3 rounded-lg border bg-white p-4 text-left transition-colors hover:border-teal-300 hover:bg-teal-50 focus-visible:ring-3 focus-visible:ring-ring/25"
              onClick={() => onSelect(row)}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{row.listingId}</strong>
                  <RowStateBadge state={row.b2State} />
                  {review && (
                    <Badge
                      variant="outline"
                      className="border-violet-200 bg-violet-50 text-violet-800"
                    >
                      Recorded: {reviewLabel[review.decision]}
                    </Badge>
                  )}
                </div>
                <div className="mt-3">
                  <p className="data-label mb-1.5">Why we handled it this way</p>
                  <ReasonChips reasons={row.reasons} showMeaning />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Current median impact:{' '}
                  {row.effectiveWeight
                    ? 'included'
                    : 'not included until reviewed'}
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0" />
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function EvidenceTasks({
  items,
  busyId,
  locked,
  save,
}: {
  items: EvidenceRequest[];
  busyId: string | null;
  locked: boolean;
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
    <div className="space-y-4">
      <Alert className="border-sky-200 bg-sky-50">
        <FileCheck2 />
        <AlertTitle>Why these follow-ups exist</AlertTitle>
        <AlertDescription>
          They track missing facts that cannot be resolved from the uploaded
          listing fields. Each task names the decision impact, owner and
          resolution evidence.
        </AlertDescription>
      </Alert>
      {locked && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <LockKeyhole />
          <AlertTitle>Evidence packet frozen</AlertTitle>
          <AlertDescription>
            These task records are read-only because this market review has been
            completed.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {drafts.map((item) => {
          const purpose = requestPurpose(item);
          return (
            <Card key={item.id}>
              <CardHeader className="border-b">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{item.title}</CardTitle>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {purpose.why}
                    </p>
                  </div>
                  <TaskBadge status={item.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 py-5">
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                  <strong>Decision impact:</strong> {purpose.decisionImpact}
                </div>
                <div>
                  <Label htmlFor={`owner-${item.id}`}>Accountable role</Label>
                  <select
                    id={`owner-${item.id}`}
                    className="control-select mt-2"
                    value={item.owner}
                    disabled={locked}
                    onChange={(e) => change(item.id, 'owner', e.target.value)}
                  >
                    <option value="Unassigned">Unassigned</option>
                    <option value="Market analyst">Market analyst</option>
                    <option value="Acquisition lead">Acquisition lead</option>
                    <option value="Pricing / Revenue">Pricing / Revenue</option>
                    <option value="Property team">Property team</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor={`note-${item.id}`}>
                    Evidence reference and resolution
                  </Label>
                  <Textarea
                    id={`note-${item.id}`}
                    className="mt-2"
                    value={item.evidenceNote}
                    disabled={locked}
                    onChange={(e) =>
                      change(item.id, 'evidenceNote', e.target.value)
                    }
                    placeholder="Name the source, what it proves, and any remaining limitation."
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Required before resolution · 12 characters minimum
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    aria-label={`Status for ${item.title}`}
                    className="control-select sm:w-auto"
                    value={item.status}
                    disabled={locked}
                    onChange={(e) => change(item.id, 'status', e.target.value)}
                  >
                    <option value="open">To do</option>
                    <option value="blocked">Blocked</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  <Button
                    disabled={
                      locked || busyId !== null || Boolean(!item.owner.trim())
                    }
                    onClick={() => save(item)}
                  >
                    {busyId === item.id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Check />
                    )}{' '}
                    {busyId === item.id ? 'Saving…' : 'Save task'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Last updated {dateTime(item.updatedAt)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function TaskBadge({ status }: { status: EvidenceRequest['status'] }) {
  const meta =
    status === 'resolved'
      ? ['Resolved', 'border-emerald-200 bg-emerald-50 text-emerald-800']
      : status === 'blocked'
        ? ['Blocked', 'border-red-200 bg-red-50 text-red-800']
        : ['To do', 'border-amber-200 bg-amber-50 text-amber-900'];
  return (
    <Badge variant="outline" className={meta[1]}>
      {meta[0]}
    </Badge>
  );
}

function AuditHistory({ events }: { events: AuditEvent[] }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Evidence history</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Who changed what, when, and on which immutable version.
        </p>
      </CardHeader>
      <CardContent className="py-0">
        <ol>
          {events.map((event) => (
            <li
              key={event.id}
              className="flex gap-3 border-b py-4 last:border-0"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full border bg-slate-50 text-primary">
                <History className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {event.eventType.replaceAll('_', ' ')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {event.actor} · {dateTime(event.createdAt)}
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-teal-800">
                    View technical record
                  </summary>
                  <code className="mt-2 block max-w-3xl overflow-x-auto rounded-md border bg-slate-50 p-2.5 text-[0.6875rem] leading-5 text-slate-700">
                    {JSON.stringify(event.payload)}
                  </code>
                </details>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function ReviewDialog({
  row,
  existing,
  decision,
  setDecision,
  reason,
  setReason,
  busy,
  onSave,
  onClose,
  onRaiseTask,
  onReupload,
}: {
  row: AuditRow | null;
  existing?: StoredRun['reviews'][number];
  decision: ReviewDecision;
  setDecision: (decision: ReviewDecision) => void;
  reason: string;
  setReason: (reason: string) => void;
  busy: boolean;
  onSave: () => Promise<void>;
  onClose: () => void;
  onRaiseTask: (title: string) => void;
  onReupload: () => void;
}) {
  const reviewable = Boolean(row);
  return (
    <Dialog
      open={Boolean(row)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {row && (
        <DialogContent className="top-0 right-0 bottom-0 left-auto flex h-dvh w-full max-w-xl translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none border-y-0 border-r-0 bg-white p-0 sm:top-4 sm:right-4 sm:bottom-4 sm:h-[calc(100dvh-2rem)] sm:rounded-lg sm:border">
          <DialogHeader className="border-b px-5 py-5 pr-14 sm:px-6">
            <Badge
              variant="outline"
              className="mb-1 w-fit rounded-full border-slate-300 bg-slate-50"
            >
              Comparable evidence
            </Badge>
            <DialogTitle className="text-xl font-bold">
              {row.listingId}
            </DialogTitle>
            <DialogDescription>
              {row?.b2State === 'needs_human_review'
                ? 'This listing needs a human call. Include, exclude or defer it, and say why.'
                : "You can disagree with how this listing was handled. Include, exclude or defer it, and record your reason."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 px-5 py-5 sm:px-6">
            <Fact
              label="Asking rent"
              value={money(Number(row.observed.rent))}
            />
            <Fact label="Source" value={String(row.observed.source)} />
            <Fact
              label="Observed facts"
              value={`${row.observed.bhk} BHK · ${row.observed.areaSqft ?? 'area missing'} sq ft`}
            />
            <Fact
              label="Last seen age"
              value={`${row.normalized.lastSeenAgeDays} days`}
            />
          </div>
          <div className="mx-5 rounded-md border bg-slate-50 p-4 text-sm sm:mx-6">
            <p className="data-label">Why we handled it this way</p>
            <div className="mt-2">
              <ReasonChips reasons={row.reasons} showMeaning />
            </div>
          </div>
          <div className="mx-5 mt-4 sm:mx-6">
            <RemediationGuide
              reasons={row.reasons}
              onRaiseTask={onRaiseTask}
              onReupload={onReupload}
            />
          </div>
          {reviewable && (
            <div className="mt-5 space-y-5 border-t px-5 py-5 sm:px-6">
              <div>
                <Label>Human judgment</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {(['include', 'exclude', 'defer'] as const).map((item) => (
                    <Button
                      key={item}
                      aria-pressed={decision === item}
                      variant={decision === item ? 'default' : 'outline'}
                      className="min-h-12 h-auto whitespace-normal py-2 text-xs"
                      onClick={() => setDecision(item)}
                    >
                      {reviewLabel[item]}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="review-reason">Evidence and rationale</Label>
                <Textarea
                  id="review-reason"
                  className="mt-2"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Point to the evidence and say why your call is right."
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  This decision is appended to history and only changes the
                  estimate after a new evidence version is created.
                </p>
              </div>
              <Button
                size="lg"
                className="w-full"
                disabled={busy || reason.trim().length < 12}
                onClick={onSave}
              >
                {busy ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <UserRoundCheck />
                )}
                {busy
                  ? 'Saving…'
                  : existing
                    ? 'Update recorded judgment'
                    : 'Record judgment'}
              </Button>
            </div>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="data-value mt-2 text-2xl font-semibold">{value}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border bg-white p-3.5">
      <dt className="data-label">{label}</dt>
      <dd className="mt-1.5 break-words text-sm font-semibold leading-5">
        {value}
      </dd>
    </div>
  );
}
function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid min-h-48 place-items-center rounded-lg border border-dashed bg-slate-50/60 p-6 text-center">
      <div>
        <CheckCircle2 className="mx-auto size-6 text-emerald-700" />
        <p className="mt-3 font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
