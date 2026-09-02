'use client';
/* oxlint-disable react/react-compiler */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
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
  Send,
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
import { InfoHint } from './info-hint';
import {
  EvidenceFunnel,
  MarketAnswer,
  NextSteps,
  ProblemOneOrientation,
  ScopeNote,
  TrustSignals,
} from './problem-one-overview';
import {
  ConfidenceDerivation,
  EvidenceModal,
  FunnelBreakdownModal,
  ReasonChips,
  RemediationGuide,
} from './trust-vocabulary';

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

  // Jump straight to the sub-tab that resolves a given milestone.
  function gotoMilestone(key: string) {
    setSection('market');
    if (key === 'flagged') setMarketTab('review');
    else if (key === 'tasks') setMarketTab('tasks');
    else setMarketTab('summary');
  }

  // The single review spine: the real workflow states, in order, with the first
  // unfinished one as "current". This is what the header tracker renders and what
  // the header's primary CTA advances — so the completion flow lives in one place
  // instead of being scattered across the overview, the pipeline and a buried
  // version-control button.
  const hasUnappliedReviews = run.reviews.length > 0;
  const milestones = [
    { key: 'analysed', label: 'Analysed', done: true },
    { key: 'flagged', label: 'Flagged rows', done: pending === 0, count: pending },
    {
      key: 'tasks',
      label: 'Evidence tasks',
      done: unresolved === 0,
      count: unresolved,
    },
    {
      key: 'apply',
      label: 'Apply judgments',
      done: !hasUnappliedReviews,
      count: run.reviews.length,
    },
    {
      key: 'complete',
      label: 'Freeze & complete',
      done: Boolean(run.reviewClosure),
    },
  ];
  const currentStep =
    milestones.find((step) => !step.done) ?? milestones[milestones.length - 1];
  const primaryAction = (() => {
    switch (currentStep.key) {
      case 'flagged':
        return {
          label: `Resolve ${pending} flagged row${pending === 1 ? '' : 's'}`,
          icon: ArrowRight,
          run: () => gotoMilestone('flagged'),
          busy: false,
        };
      case 'tasks':
        return {
          label: `Resolve ${unresolved} evidence task${unresolved === 1 ? '' : 's'}`,
          icon: ArrowRight,
          run: () => gotoMilestone('tasks'),
          busy: false,
        };
      case 'apply':
        return {
          label: `Apply judgments in v${run.versionNumber + 1}`,
          icon: RefreshCw,
          run: createChildRun,
          busy: busyAction === 'rerun',
        };
      default:
        return run.reviewClosure
          ? {
              label: 'View handoff',
              icon: CheckCircle2,
              run: () => setSection('overview'),
              busy: false,
            }
          : {
              label: 'Complete market review',
              icon: ClipboardCheck,
              run: () => setCompletionOpen(true),
              busy: false,
            };
    }
  })();
  const PrimaryIcon = primaryAction.icon;

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
                  <Button
                    onClick={primaryAction.run}
                    disabled={primaryAction.busy}
                  >
                    {primaryAction.busy ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <PrimaryIcon />
                    )}
                    {primaryAction.label}
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <MilestoneTracker
                  steps={milestones}
                  currentKey={currentStep.key}
                  onGoto={gotoMilestone}
                />
                <p className="text-xs text-muted-foreground">
                  {assessment.nextAction}
                </p>
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

// The single milestone spine for the whole review, rendered in the sticky header.
// Done steps are teal ticks, the current step is highlighted amber, future steps
// are muted. Flagged-rows and evidence-tasks steps are clickable to jump straight
// to the sub-tab that clears them.
function MilestoneTracker({
  steps,
  currentKey,
  onGoto,
}: {
  steps: { key: string; label: string; done: boolean; count?: number }[];
  currentKey: string;
  onGoto: (key: string) => void;
}) {
  return (
    <nav
      aria-label="Market review progress"
      className="flex flex-wrap items-center gap-x-1 gap-y-1.5"
    >
      {steps.map((step, index) => {
        const current = step.key === currentKey;
        const navigable =
          !step.done && (step.key === 'flagged' || step.key === 'tasks');
        const tone = step.done
          ? 'border-teal-200 bg-teal-50 text-teal-900'
          : current
            ? 'border-amber-300 bg-amber-50 text-amber-900 ring-1 ring-amber-300'
            : 'border-slate-200 bg-white text-muted-foreground';
        const content = (
          <>
            {step.done ? (
              <CheckCircle2 className="size-3.5 shrink-0" />
            ) : current ? (
              <CircleDot className="size-3.5 shrink-0" />
            ) : (
              <span className="size-3 shrink-0 rounded-full border border-current opacity-50" />
            )}
            {step.label}
            {typeof step.count === 'number' && step.count > 0 && !step.done
              ? ` · ${step.count}`
              : ''}
          </>
        );
        return (
          <Fragment key={step.key}>
            {index > 0 && (
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/40" />
            )}
            {navigable ? (
              <button
                type="button"
                onClick={() => onGoto(step.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-shadow hover:shadow-sm ${tone}`}
              >
                {content}
              </button>
            ) : (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}
              >
                {content}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
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
}: {
  run: StoredRun;
  assessment: ReturnType<typeof assessMarketReview>;
  pending: number;
  unresolved: number;
  onOpenMarket: () => void;
  isComplete: boolean;
}) {
  const [tileModal, setTileModal] = useState<null | 'trusted' | 'band'>(null);
  const trustedRows = run.rows.filter((r) => r.b2State === 'include');
  const bandRows = [...trustedRows].sort(
    (a, b) => Number(a.observed.rent) - Number(b.observed.rent),
  );
  return (
    <div className="space-y-4">
      <ProblemOneOrientation run={run} />
      <MarketAnswer
        median={assessment.marketMedian ?? 0}
        confidence={run.summary.askingEvidenceConfidence}
        trustedCount={run.summary.baselines.B2.count}
        portals={run.summary.observedPortalLabelCount}
        looMovementPct={run.summary.maximumLeaveOneOutMovementPct}
        rows={run.rows}
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
          rows={run.rows}
          baselines={run.summary.baselines}
        />
      </div>
      <TrustSignals rows={run.rows} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Trusted comparables"
          value={String(run.summary.baselines.B2.count)}
          note="Listings that count toward the rate"
          info="How many listings survived every cleaning stage and now set the rate. This is the sample the median is taken from — the higher it is, the steadier the rate."
          onClick={
            trustedRows.length > 0 ? () => setTileModal('trusted') : undefined
          }
          hint="See the listings"
        />
        <Metric
          label="Middle 50% of asking rents"
          value={`${money(run.summary.band.p25)} – ${money(run.summary.band.p75)}`}
          note="Where most comparable asks sit"
          info="The interquartile range (25th to 75th percentile) of the trusted asks — the band the middle half of comparable listings fall in. A tight band means the comps agree; a wide one means asks are scattered, so treat the single median with more caution."
          onClick={
            bandRows.length > 0 ? () => setTileModal('band') : undefined
          }
          hint="See the spread"
        />
        <Metric
          label="Work remaining"
          value={`${pending + unresolved}`}
          note={`${pending} listing decisions · ${unresolved} evidence tasks`}
          info="What still has to clear before this market evidence can be frozen: flagged listings awaiting an include/exclude call, plus open evidence tasks. It must reach zero to complete the review."
          onClick={onOpenMarket}
          hint="Open the review"
        />
      </div>
      <EvidenceModal
        open={tileModal !== null}
        onOpenChange={(o) => !o && setTileModal(null)}
        title={
          tileModal === 'band'
            ? 'Trusted listings, low to high asking rent'
            : `${trustedRows.length} trusted comparables`
        }
        description={
          tileModal === 'band'
            ? 'The middle 50% band is the interquartile range across these asks.'
            : 'The listings that count toward the market rate.'
        }
        rows={tileModal === 'band' ? bandRows : trustedRows}
      />
      <div>
        <Card
          className={
            assessment.state === 'complete'
              ? 'border-emerald-200'
              : 'border-amber-200'
          }
        >
          <CardContent className="flex h-full flex-col py-6">
            <div className="flex items-center gap-1.5">
              <p className="eyebrow">Current market posture</p>
              <InfoHint label="Where this review stands right now and the single next thing to do to move it forward — from resolving flagged rows and evidence tasks, to applying your judgments into a new version, to freezing the packet. It mirrors the milestone tracker in the header." />
            </div>
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
      <NextSteps isComplete={isComplete} />
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
        <div className="flex items-center gap-1.5">
          <CardTitle>What&apos;s pending, and with whom</CardTitle>
          <InfoHint label="Every open item blocking this review, grouped by who owns it: flagged listings needing a reviewer's call, and evidence tasks assigned to a named person. Nothing here is a generic 'people collaborate' note — each item must be resolved and is recorded in the history before the evidence can be frozen." />
        </div>
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
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={onOpenMarket}
                        className="flex w-full items-center justify-between gap-3 rounded-md px-1 py-1 text-left text-sm transition-colors hover:bg-slate-50"
                      >
                        <span>{task.title}</span>
                        <Badge
                          variant="outline"
                          className={
                            task.assignee && task.notifiedAt
                              ? 'shrink-0 border-teal-200 bg-teal-50 text-teal-900'
                              : task.status === 'blocked'
                                ? 'shrink-0 border-red-200 bg-red-50 text-red-800'
                                : 'shrink-0 border-amber-200 bg-amber-50 text-amber-900'
                          }
                        >
                          {task.assignee
                            ? `With ${task.assignee}${task.notifiedAt ? ' · notified' : ' · not notified'}`
                            : task.owner && task.owner !== 'Unassigned'
                              ? task.owner
                              : 'Unassigned'}
                        </Badge>
                      </button>
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
}) {
  return (
    <div>
      <Tabs value={props.marketTab} onValueChange={props.setMarketTab}>
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
          <MarketSummary run={props.run} assessment={props.assessment} />
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
                assignee: item.assignee,
                evidenceNote: item.evidenceNote,
              })
            }
            notify={(requestId) =>
              props.action({ action: 'notify_request', requestId })
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

function MarketSummary({
  run,
  assessment,
}: {
  run: StoredRun;
  assessment: ReturnType<typeof assessMarketReview>;
}) {
  const b = run.summary.baselines;
  const [narrowOpen, setNarrowOpen] = useState(false);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Current asking-rent median"
          value={money(b.B2.estimate)}
          note={`${b.B2.count} current comparables`}
          info="The middle asking rent of the trusted comparables — the market rate. Median, not average, so one very high or low listing can't skew it. This is an asking benchmark, not an achieved or signed rent."
        />
        <Metric
          label="Middle 50% of asking rents"
          value={`${money(run.summary.band.p25)} – ${money(run.summary.band.p75)}`}
          note="25th to 75th percentile"
          info="The band the middle half of trusted asks fall in (interquartile range). Tight means the comps agree; wide means asks are scattered and the single median deserves more caution."
        />
        <Metric
          label="Portals in the rate"
          value={String(run.summary.observedPortalLabelCount)}
          note="Different sources in the trusted set"
          info="How many independent listing sources the trusted comparables span. More sources means less chance the rate is skewed by one portal's particular mix of listings — it directly feeds the confidence tier."
        />
        <Metric
          label="Reliance on one listing"
          value={
            run.summary.maximumLeaveOneOutMovementPct === null
              ? 'Not available'
              : `${run.summary.maximumLeaveOneOutMovementPct}%`
          }
          note="How much the rate moves if the most influential listing is dropped"
          info="A stability check: we remove the single most influential listing and see how far the median shifts (leave-one-out). A small movement means no single listing is holding the rate up; a large one means the rate is fragile."
        />
      </div>
      <Card
        className="cursor-pointer transition-shadow hover:shadow-sm"
        onClick={run.rows.length > 0 ? () => setNarrowOpen(true) : undefined}
        role={run.rows.length > 0 ? 'button' : undefined}
        tabIndex={run.rows.length > 0 ? 0 : undefined}
        onKeyDown={
          run.rows.length > 0
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') setNarrowOpen(true);
              }
            : undefined
        }
      >
        <CardHeader className="border-b">
          <CardTitle>How the evidence was narrowed</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            From every listing in the file down to the ones we trust for the
            rate.{' '}
            {run.rows.length > 0 ? 'Click to see the full breakdown.' : ''}
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 py-5 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
          <Stage
            label="Broad reference set"
            count={b.B0.count}
            estimate={b.B0.estimate}
            detail="Every valid listing that matches the home's BHK."
            info="Baseline B0: all structurally valid listings that share your home's BHK, before any society, area, furnishing or freshness rules. The widest, least-filtered view."
          />
          <ChevronRight className="hidden size-5 text-muted-foreground md:block" />
          <Stage
            label="Policy-matched comparables"
            count={b.B1.count}
            estimate={b.B1.estimate}
            detail="Subject society, size, furnishing and freshness rules applied; likely duplicates collapsed."
            info="Baseline B1: B0 narrowed to listings that actually match this home — right society, area within tolerance, same furnishing, recent enough — with cross-post duplicates collapsed to one."
          />
          <ChevronRight className="hidden size-5 text-muted-foreground md:block" />
          <Stage
            label="Current evidence set"
            count={b.B2.count}
            estimate={b.B2.estimate}
            detail="Policy-matched listings after recorded human judgments are incorporated."
            info="Baseline B2: the trusted set that sets the rate — B1 with suspicious prices removed and your recorded include/exclude judgments applied. This is what the median is taken from."
          />
        </CardContent>
      </Card>
      <FunnelBreakdownModal
        open={narrowOpen}
        onOpenChange={setNarrowOpen}
        rows={run.rows}
        baselines={run.summary.baselines}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-amber-200">
          <CardHeader className="border-b border-amber-200">
            <div className="flex items-center gap-1.5">
              <CardTitle>What this estimate can&apos;t tell you</CardTitle>
              <InfoHint label="The honest limits of this number — what asking-rent listings can't establish (e.g. whether maintenance is included, or what rent was actually signed). These aren't excuses; they're the boundaries a reviewer must carry into the decision, so the rate isn't trusted for more than it proves." />
            </div>
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
            <div className="flex items-center gap-1.5">
              <CardTitle>Version control</CardTitle>
              <InfoHint label="Why your changes never silently rewrite the answer. Each run is immutable; recorded include/exclude judgments don't take effect until you apply them into a new child version. That keeps a full, auditable history of what the rate was before and after every human call." />
            </div>
          </CardHeader>
          <CardContent className="space-y-4 py-5">
            <p className="text-sm leading-6 text-muted-foreground">
              Human judgments never rewrite a completed result. Applying them
              creates a new immutable version, which the review is then completed
              from — you drive that from the tracker in the header.
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
            {run.reviews.length > 0 && !run.reviewClosure ? (
              <p className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                <RefreshCw className="size-3.5 shrink-0" />
                {run.reviews.length} recorded judgment
                {run.reviews.length === 1 ? '' : 's'} not yet applied — use
                &ldquo;Apply judgments in v{run.versionNumber + 1}&rdquo; in the
                header tracker.
              </p>
            ) : assessment.state === 'ready_to_complete' ? (
              <p className="text-xs font-semibold text-teal-800">
                No unapplied judgments remain. This version is ready to
                complete.
              </p>
            ) : null}
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
  info,
}: {
  label: string;
  count: number;
  estimate: number | null;
  detail: string;
  info?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-slate-50/60 p-4">
      <p className="flex items-center gap-1.5 data-label">
        {label}
        {info && <InfoHint label={info} />}
      </p>
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
        <div className="flex items-center gap-1.5">
          <CardTitle>Listing-by-listing review</CardTitle>
          <InfoHint label="Every listing the engine kept for inspection, with its state and the reasons behind it. Select any row to see why it counts, was collapsed as a duplicate, or was flagged — and to override that call with a recorded reason. This is where 'disagree with any single decision' happens." />
        </div>
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
  notify,
}: {
  items: EvidenceRequest[];
  busyId: string | null;
  locked: boolean;
  save: (item: EvidenceRequest) => Promise<unknown>;
  notify: (requestId: string) => Promise<unknown>;
}) {
  const [drafts, setDrafts] = useState(items);
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const change = (id: string, key: keyof EvidenceRequest, value: string) =>
    setDrafts((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [key]: value } : item,
      ),
    );
  async function runNotify(requestId: string) {
    setNotifyingId(requestId);
    try {
      await notify(requestId);
    } finally {
      setNotifyingId(null);
    }
  }
  return (
    <div className="space-y-4">
      <Alert className="border-sky-200 bg-sky-50">
        <FileCheck2 />
        <AlertTitle>Why these follow-ups exist</AlertTitle>
        <AlertDescription>
          They track missing facts that cannot be resolved from the uploaded
          listing fields. Each names the decision impact, an accountable role and
          the person it&apos;s assigned to — and every one must be resolved
          before the market evidence can be frozen.
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
      <ul className="space-y-3">
        {drafts.map((item) => {
          const purpose = requestPurpose(item);
          // Server truth for the notification stamp (notify is a separate action;
          // the draft only holds the editable fields).
          const saved = items.find((i) => i.id === item.id);
          const notifiedAt = saved?.notifiedAt ?? null;
          const savedAssignee = saved?.assignee ?? '';
          const assignee = item.assignee.trim();
          const assigneeChanged = assignee !== savedAssignee.trim();
          const saving = busyId === item.id;
          const notifying = notifyingId === item.id;
          return (
            <li key={item.id} className="rounded-lg border bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-5">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {purpose.why}
                  </p>
                </div>
                <TaskBadge status={item.status} />
              </div>

              <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-xs leading-5 text-amber-900">
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold">
                  Decision impact
                </span>
                {purpose.decisionImpact}
              </p>

              {/* Assignment cue — who owns it and whether they've been told. */}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {!assignee ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-600">
                    <UserRoundCheck className="size-3.5" /> Unassigned
                  </span>
                ) : notifiedAt && !assigneeChanged ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 font-semibold text-teal-900">
                    <CheckCircle2 className="size-3.5" /> Assigned to {assignee} ·
                    notified {dateTime(notifiedAt)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-900">
                    <Send className="size-3.5" /> Assigned to {assignee} ·{' '}
                    {assigneeChanged ? 'save, then notify' : 'not yet notified'}
                  </span>
                )}
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-[auto_1fr]">
                <div>
                  <Label
                    htmlFor={`owner-${item.id}`}
                    className="text-xs text-muted-foreground"
                  >
                    Accountable role
                  </Label>
                  <select
                    id={`owner-${item.id}`}
                    className="control-select mt-1.5"
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
                  <Label
                    htmlFor={`assignee-${item.id}`}
                    className="text-xs text-muted-foreground"
                  >
                    Assigned person
                  </Label>
                  <Input
                    id={`assignee-${item.id}`}
                    className="mt-1.5"
                    value={item.assignee}
                    disabled={locked}
                    onChange={(e) =>
                      change(item.id, 'assignee', e.target.value)
                    }
                    placeholder="Name the person accountable, e.g. Priya Nair"
                  />
                </div>
              </div>

              <div className="mt-3">
                <Label
                  htmlFor={`note-${item.id}`}
                  className="text-xs text-muted-foreground"
                >
                  Evidence reference and resolution
                </Label>
                <Textarea
                  id={`note-${item.id}`}
                  className="mt-1.5"
                  rows={2}
                  value={item.evidenceNote}
                  disabled={locked}
                  onChange={(e) =>
                    change(item.id, 'evidenceNote', e.target.value)
                  }
                  placeholder="Name the source, what it proves, and any remaining limitation."
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Required before resolution · 12 characters minimum
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
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
                  variant="outline"
                  disabled={locked || saving || busyId !== null || !item.owner.trim()}
                  onClick={() => save(item)}
                >
                  {saving ? <Loader2 className="animate-spin" /> : <Check />}
                  {saving ? 'Saving…' : 'Save task'}
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    locked ||
                    notifying ||
                    !assignee ||
                    assigneeChanged ||
                    Boolean(notifiedAt)
                  }
                  onClick={() => runNotify(item.id)}
                  title={
                    assigneeChanged
                      ? 'Save the new assignee before notifying'
                      : notifiedAt
                        ? 'Already notified'
                        : 'Notify the assignee in BOSS'
                  }
                >
                  {notifying ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Send />
                  )}
                  {notifiedAt && !assigneeChanged
                    ? 'Notified'
                    : notifying
                      ? 'Notifying…'
                      : 'Notify'}
                </Button>
                <span className="ml-auto text-xs text-muted-foreground">
                  Updated {dateTime(item.updatedAt)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
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
  onClick,
  hint,
  info,
}: {
  label: string;
  value: string;
  note: string;
  onClick?: () => void;
  hint?: string;
  info?: React.ReactNode;
}) {
  const clickable = Boolean(onClick);
  return (
    <Card
      className={
        clickable ? 'cursor-pointer transition-shadow hover:shadow-sm' : ''
      }
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick?.();
            }
          : undefined
      }
    >
      <CardContent className="py-5">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          {label}
          {info && <InfoHint label={info} />}
        </p>
        <p className="data-value mt-2 text-2xl font-semibold">{value}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{note}</p>
        {clickable && hint && (
          <p className="mt-2 text-xs font-semibold text-[var(--flent-teal)]">
            {hint} →
          </p>
        )}
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
