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

// Problem 2 — feedback loop, static preview.
//
// Every figure below is taken verbatim from the exercise packet's real
// `outcomes.csv` (14 anonymised historical cases). Nothing is invented. The
// bias numbers are computed here from the observed cases only — censored
// records are excluded from the error stats, never treated as zero. This is an
// illustrative read, not a live model.

type Outcome = {
  id: string;
  micromarket: string;
  bhk: number;
  predRevenue: number;
  actRevenue: number | null;
  predFill: number;
  actFill: number | null;
  predPayback: number;
  actPayback: number | null;
  status:
    | 'observed'
    | 'still_filling'
    | 'partially_observed'
    | 'cancelled_before_launch'
    | 'not_mature';
  note: string;
};

const OUTCOMES: Outcome[] = [
  { id: 'HIST-001', micromarket: 'HSR', bhk: 2, predRevenue: 68000, actRevenue: 66000, predFill: 24, actFill: 31, predPayback: 13.3, actPayback: 16.3, status: 'observed', note: 'Second room needed a price cut after two weeks.' },
  { id: 'HIST-002', micromarket: 'Bellandur', bhk: 3, predRevenue: 112000, actRevenue: 114000, predFill: 39, actFill: 57, predPayback: 12.1, actPayback: 11.7, status: 'observed', note: 'Revenue beat plan; third room filled later than forecast.' },
  { id: 'HIST-003', micromarket: 'Whitefield', bhk: 2, predRevenue: 62000, actRevenue: 59000, predFill: 28, actFill: 46, predPayback: 13.1, actPayback: 17.7, status: 'observed', note: 'Prospects objected to commute; achieved rent was lower.' },
  { id: 'HIST-004', micromarket: 'Koramangala', bhk: 2, predRevenue: 78000, actRevenue: 79000, predFill: 18, actFill: 15, predPayback: 8.9, actPayback: 9.0, status: 'observed', note: 'Both rooms booked before furnishing was complete.' },
  { id: 'HIST-005', micromarket: 'Sarjapur Road', bhk: 2, predRevenue: 64000, actRevenue: 61000, predFill: 32, actFill: 69, predPayback: 15.9, actPayback: 23.6, status: 'observed', note: 'Repair work delayed launch by 12 days.' },
  { id: 'HIST-006', micromarket: 'Indiranagar', bhk: 3, predRevenue: 126000, actRevenue: 124000, predFill: 26, actFill: 29, predPayback: 10.8, actPayback: 12.2, status: 'observed', note: 'One room price reduced; all three occupied by day 29.' },
  { id: 'HIST-007', micromarket: 'Harlur', bhk: 2, predRevenue: 71000, actRevenue: 72000, predFill: 30, actFill: 22, predPayback: 15.1, actPayback: 14.0, status: 'observed', note: 'Owner completed two repair items before handover.' },
  { id: 'HIST-008', micromarket: 'Mahadevapura', bhk: 2, predRevenue: 65000, actRevenue: 63000, predFill: 35, actFill: 41, predPayback: 14.0, actPayback: 16.3, status: 'observed', note: 'Demand sample had combined two adjacent micromarkets.' },
  { id: 'HIST-009', micromarket: 'BTM', bhk: 2, predRevenue: 60000, actRevenue: 60000, predFill: 23, actFill: 27, predPayback: 12.8, actPayback: 13.5, status: 'observed', note: 'Forecast close; capex invoice arrived after launch.' },
  { id: 'HIST-010', micromarket: 'Bellandur', bhk: 3, predRevenue: 118000, actRevenue: 109000, predFill: 44, actFill: 83, predPayback: 12.0, actPayback: 19.4, status: 'observed', note: 'Third room had no attached bathroom; forecast used a three-room average.' },
  { id: 'HIST-011', micromarket: 'Whitefield', bhk: 2, predRevenue: 67000, actRevenue: 65000, predFill: 31, actFill: null, predPayback: 13.7, actPayback: null, status: 'still_filling', note: 'One room occupied at day 90; full-fill is right-censored.' },
  { id: 'HIST-012', micromarket: 'HSR', bhk: 2, predRevenue: 76000, actRevenue: null, predFill: 20, actFill: null, predPayback: 11.9, actPayback: null, status: 'cancelled_before_launch', note: 'Owner withdrew after signing; only inspection and legal costs incurred.' },
  { id: 'HIST-013', micromarket: 'Sarjapur Road', bhk: 3, predRevenue: 99000, actRevenue: 65000, predFill: 48, actFill: null, predPayback: 14.3, actPayback: null, status: 'partially_observed', note: 'Two of three rooms occupied; revenue collected, not stabilised.' },
  { id: 'HIST-014', micromarket: 'Harlur', bhk: 2, predRevenue: 73000, actRevenue: null, predFill: 29, actFill: null, predPayback: 14.4, actPayback: null, status: 'not_mature', note: 'Only 20 days observed; no day-90 comparison yet.' },
];

const STATUS_LABEL: Record<Outcome['status'], string> = {
  observed: 'Observed',
  still_filling: 'Still filling',
  partially_observed: 'Partially observed',
  cancelled_before_launch: 'Cancelled',
  not_mature: 'Not mature',
};

const inr = (v: number | null) =>
  v === null ? '—' : `₹${v.toLocaleString('en-IN')}`;
const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

export default function CalibrationPreview() {
  // Only fully observed cases carry a clean ground truth. Everything else is
  // censored and deliberately excluded from the error statistics.
  const scorable = OUTCOMES.filter((o) => o.status === 'observed');
  const censored = OUTCOMES.filter((o) => o.status !== 'observed');

  const fillBias = mean(
    scorable.map((o) => (o.actFill as number) - o.predFill),
  );
  const revenueBias = mean(
    scorable.map((o) => (o.actRevenue as number) - o.predRevenue),
  );
  const paybackWorse = scorable.filter(
    (o) => (o.actPayback as number) > o.predPayback,
  ).length;

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
          <p className="eyebrow">Problem 2 · Feedback loop</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">
            Did our predictions come true?
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Every home we sign makes predictions — rent, fill time, payback. This
            view puts what we forecast next to what actually happened by day 90,
            so we can see where we run high, where we run low, and where the
            comparison simply isn&apos;t possible yet.
          </p>
        </div>

        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle />
          <AlertTitle>Illustrative preview — approach, not a live model</AlertTitle>
          <AlertDescription>
            Built from the exercise packet&apos;s 14 real historical cases. The
            bias figures use the {scorable.length} fully observed cases only.
            Censored records (cancelled, still filling, not mature) are shown but
            excluded from the error stats — a blank outcome is not a zero.
          </AlertDescription>
        </Alert>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="py-5">
              <p className="data-label">Fill-time bias</p>
              <p className="data-value mt-2 text-2xl font-bold text-[var(--status-danger)]">
                +{fillBias.toFixed(1)} days
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                On average homes filled {fillBias.toFixed(1)} days slower than we
                forecast. Since vacant days come straight out of P&amp;L, this is
                the costliest place to be optimistic.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-5">
              <p className="data-label">Revenue bias</p>
              <p className="data-value mt-2 text-2xl font-bold">
                {revenueBias >= 0 ? '+' : '−'}
                {inr(Math.abs(Math.round(revenueBias))).replace('₹', '₹')}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Actual monthly revenue landed about{' '}
                {inr(Math.abs(Math.round(revenueBias)))} {revenueBias < 0
                  ? 'below'
                  : 'above'}{' '}
                forecast on average — a mild, not dominant, error.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-5">
              <p className="data-label">Payback direction</p>
              <p className="data-value mt-2 text-2xl font-bold">
                {paybackWorse} of {scorable.length}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Real payback came in worse than forecast in {paybackWorse} of the{' '}
                {scorable.length} scorable cases — consistent with the fill-time
                optimism above.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Prediction vs. day-90 outcome</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Censored rows are greyed — they have no clean ground truth to score
              against.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="data-label border-b text-left">
                  <tr>
                    <th className="p-3">Case</th>
                    <th className="p-3">Micromarket</th>
                    <th className="p-3">Revenue (pred → actual)</th>
                    <th className="p-3">Fill days (pred → actual)</th>
                    <th className="p-3">Payback (pred → actual)</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {OUTCOMES.map((o) => {
                    const censoredRow = o.status !== 'observed';
                    return (
                      <tr
                        key={o.id}
                        className={`border-b align-top ${censoredRow ? 'text-muted-foreground' : ''}`}
                      >
                        <td className="data-value p-3">{o.id}</td>
                        <td className="p-3">
                          {o.micromarket}
                          <span className="text-muted-foreground">
                            {' '}
                            · {o.bhk}BHK
                          </span>
                        </td>
                        <td className="data-value p-3">
                          {inr(o.predRevenue)} → {inr(o.actRevenue)}
                        </td>
                        <td className="data-value p-3">
                          {o.predFill} → {o.actFill ?? '—'}
                        </td>
                        <td className="data-value p-3">
                          {o.predPayback} → {o.actPayback ?? '—'}
                        </td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className={`rounded-full ${censoredRow ? 'border-slate-300 bg-slate-50' : 'border-teal-200 bg-teal-50 text-teal-900'}`}
                          >
                            {STATUS_LABEL[o.status]}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Where the comparison breaks</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              The brief asks for this explicitly: not every decision has a clean
              outcome. {censored.length} of {OUTCOMES.length} cases can&apos;t be
              scored.
            </p>
          </CardHeader>
          <CardContent className="divide-y py-0">
            {censored.map((o) => (
              <div key={o.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4">
                <span className="data-value w-24 shrink-0 text-sm">{o.id}</span>
                <span className="w-40 shrink-0 text-sm font-semibold">
                  {STATUS_LABEL[o.status]}
                </span>
                <span className="text-sm text-muted-foreground">{o.note}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
