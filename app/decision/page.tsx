'use client';

import Link from 'next/link';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { BrandMark } from '@/app/_components/boss-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// Problem 3, decision page, static preview.
//
// Every value is taken verbatim from the exercise packet: the provisional
// assessment (`boss-assessment.md`), the deal record, and the internal comment
// thread. Nothing is invented and no verdict is computed here. Crucially, the
// prior assessment is shown as a reference to *explain*, it is never fed back
// as an input, which would make the system reproduce its own answer.

const SCENARIOS = [
  {
    name: 'Opening ask',
    rent: '₹56,000',
    contribution: '₹7,400 / mo',
    payback: '35.1 months',
    confirmed: false,
    note: 'Recorded terms, not signed. The dominant inputs are still estimates.',
  },
  {
    name: 'Verbal ₹54,000 alternative',
    rent: '₹54,000',
    contribution: '₹9,400 / mo',
    payback: '27.7 months',
    confirmed: false,
    note: 'Landlord mentioned this verbally; nothing received in writing.',
  },
  {
    name: 'Demand downside',
    rent: '₹56,000',
    contribution: '₹4,550 / mo',
    payback: '57.1 months',
    confirmed: false,
    note: 'If room 2 lands at ₹31k instead of ₹34k. Before first-fill cost.',
  },
];

const EVIDENCE = [
  { item: 'Opening landlord terms', status: 'Recorded', kind: 'assumed', effect: 'Used in the opening-ask scenario.' },
  { item: 'Verbal ₹54,000 alternative', status: 'Unconfirmed', kind: 'assumed', effect: 'Shown as a scenario only.' },
  { item: '₹72,000 tenant-revenue hypothesis', status: 'Estimate', kind: 'assumed', effect: 'Largest positive assumption in the economics.' },
  { item: '₹1,60,000 capex placeholder', status: 'No BOQ', kind: 'assumed', effect: 'Keeps capital employed and payback provisional.' },
  { item: 'Comparable listings (cleaned)', status: 'Market engine', kind: 'confirmed', effect: 'A defensible asking-rent benchmark with confidence.' },
  { item: 'Demand thread', status: '4 comparable enquiries', kind: 'assumed', effect: 'Directional only; sample is small.' },
  { item: 'Site-visit stills', status: 'Partial', kind: 'assumed', effect: 'Supports daylight/storage; technical checks open.' },
  { item: 'Landlord vs tenant deposits', status: '₹1,00,000 gap', kind: 'assumed', effect: 'Estimated cash exposure before capex.' },
];

// Comments routed to the domain that owns them, the point of capture is that a
// demand or property note never silently moves the market number.
const DISAGREEMENTS = [
  { domain: 'Supply / Terms', claim: 'Owner may accept ₹54,000 if we keep the full deposit and sign this week.', treatment: 'Unconfirmed negotiation scenario. Does not replace the recorded ask.' },
  { domain: 'Property', claim: 'Damp patch on the utility wall; weak master-bath exhaust.', treatment: 'Diligence items with an owner and a photo, not a quality score.' },
  { domain: 'Demand', claim: '11 enquiries in 14 days, only 4 for comparable sharing homes.', treatment: 'Directional demand evidence with an explicit sample limit.' },
  { domain: 'Pricing', claim: '₹38k + ₹34k room ladder = ₹72k; room 2 may land near ₹31k.', treatment: 'Achievable-rent hypothesis, not achieved revenue.' },
  { domain: 'Finance', claim: '₹1,00,000 of landlord deposit is uncovered before capex.', treatment: 'Capital-exposure claim shown separately from monthly margin.' },
  { domain: 'Market ops', claim: 'Maintenance is not captured reliably; do not quote a raw median.', treatment: 'Fed the market engine as a cleaning caveat, not a silent adjustment.' },
];

const FLIP_CONDITIONS = [
  ['Written lower rent + clean BOQ + tenant-price proof', 'Re-run as NEGOTIATE or ACQUIRE'],
  ['Clean comps show the home materially above market', 'Move toward NEGOTIATE or PASS'],
  ['Technical diligence reveals material extra work', 'Keep HOLD or move to PASS'],
  ['Demand validates both room prices and fill timing', 'Reduces the largest revenue and vacancy risk'],
  ['Society rules block working-professional sharing', 'PASS regardless of the headline arithmetic'],
];

export default function DecisionPreview() {
  return (
    <div className="workbench-grid min-h-screen">
      <header className="border-b bg-white">
        <div className="app-shell flex max-w-[1180px] items-center justify-between py-4">
          <BrandMark compact />
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back to market review
          </Link>
        </div>
      </header>

      <main className="app-shell max-w-[1180px] space-y-5 py-8">
        <div className="border-b pb-5">
          <p className="eyebrow">Problem 3 · Decision page</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">
            Why this call, and what would change it
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            One view for the person signing: what drove the recommendation, what
            is confirmed versus assumed, where teams disagree, and exactly what
            new evidence would flip the answer, without opening another
            spreadsheet.
          </p>
        </div>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>How the decision page works</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              The step right after Problem 1. It consumes the frozen market
              evidence and the deal terms, then presents the call for a human to
              sign. BOSS recommends, a person authorises.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 py-5 md:grid-cols-3">
            {[
              {
                title: '1 · Read, do not recompute',
                body: 'It reads the frozen Problem 1 benchmark and the confirmed deal terms. It never re-derives the rate, so the market number has one owner.',
              },
              {
                title: '2 · Route every claim',
                body: 'Each comment goes to the domain that owns it (Supply, Property, Demand, Pricing, Finance), so a demand note never silently moves the market number.',
              },
              {
                title: '3 · Separate fact from guess',
                body: 'Confirmed, assumed and missing are labelled, so a call built on three guesses cannot look like one built on five confirmed facts.',
              },
            ].map((s) => (
              <div key={s.title} className="rounded-lg border bg-white p-4">
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {s.body}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle />
          <AlertTitle>Illustrative preview for reference, not an engine output</AlertTitle>
          <AlertDescription>
            Assembled from the packet&apos;s provisional assessment, deal record
            and comment thread. The prior assessment is shown here to be
            explained; it is never fed back as an input, which would make the
            system reproduce its own answer.
          </AlertDescription>
        </Alert>

        <Card className="border-amber-200">
          <CardContent className="py-6">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="rounded-full bg-[var(--status-warning)] text-white">
                Provisional HOLD
              </Badge>
              <span className="text-sm text-muted-foreground">
                A named human owns this call.
              </span>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6">
              The home may work on better terms, but the current evidence
              isn&apos;t strong enough to authorise an acquisition.{' '}
              <strong>HOLD here means &ldquo;resolve the evidence&rdquo;, not
              &ldquo;reject the home&rdquo;</strong>. The inputs that dominate
              the answer are still estimates.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>What the answer is most sensitive to</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Same home, three sets of assumptions. Simple payback shown; none is
              a signed fact.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 py-5 md:grid-cols-3">
            {SCENARIOS.map((s) => (
              <div key={s.name} className="rounded-lg border bg-white p-4">
                <p className="text-sm font-semibold">{s.name}</p>
                <p className="data-value mt-2 text-xl font-bold">{s.payback}</p>
                <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <dt>Base rent</dt>
                    <dd className="data-value">{s.rent}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Contribution</dt>
                    <dd className="data-value">{s.contribution}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {s.note}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Confirmed vs. assumed</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                A recommendation on three guesses shouldn&apos;t look like one on
                five confirmed facts.
              </p>
            </CardHeader>
            <CardContent className="divide-y py-0">
              {EVIDENCE.map((e) => (
                <div key={e.item} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold">{e.item}</p>
                    <Badge
                      variant="outline"
                      className={`shrink-0 rounded-full ${e.kind === 'confirmed' ? 'border-teal-200 bg-teal-50 text-teal-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
                    >
                      {e.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {e.effect}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Where teams disagree</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Each comment routed to the domain that owns it, shown, not
                averaged away.
              </p>
            </CardHeader>
            <CardContent className="divide-y py-0">
              {DISAGREEMENTS.map((d) => (
                <div key={d.domain} className="py-3">
                  <p className="data-label">{d.domain}</p>
                  <p className="mt-1 text-sm leading-5">{d.claim}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {d.treatment}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>What would flip the call</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              The reviewer&apos;s real question: which parts are we least sure
              about, and what changes the answer?
            </p>
          </CardHeader>
          <CardContent className="divide-y py-0">
            {FLIP_CONDITIONS.map(([evidence, movement]) => (
              <div
                key={evidence}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="text-sm font-semibold sm:w-1/2">
                  {evidence}
                </span>
                <span className="text-sm text-muted-foreground sm:w-1/2">
                  → {movement}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
