'use client';

import Link from 'next/link';
import { FileCheck2, FilePlus2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function BrandMark({ compact = false }: { compact?: boolean }) {
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

export function ProductRail({
  current,
  onNew,
  onDeals,
}: {
  current: 'setup' | 'deals';
  onNew?: () => void;
  onDeals?: () => void;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen flex-col border-r bg-white px-4 py-7 lg:flex">
      <div className="px-3">
        <BrandMark />
      </div>
      <nav aria-label="BOSS navigation" className="mt-10 space-y-2">
        {onDeals ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onDeals}
            className={`min-h-12 w-full cursor-pointer justify-start gap-3 rounded-xl px-4 text-sm font-semibold ${current === 'deals' ? 'rail-active' : 'text-muted-foreground'}`}
          >
            <FileCheck2 aria-hidden="true" className="size-5" /> Deals
          </Button>
        ) : (
          <div
            className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold ${current === 'deals' ? 'rail-active' : 'text-muted-foreground'}`}
          >
            <FileCheck2 aria-hidden="true" className="size-5" /> Deals
          </div>
        )}
        {onNew ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onNew}
            className="min-h-12 w-full cursor-pointer justify-start gap-3 rounded-xl px-4 text-sm font-semibold text-muted-foreground"
          >
            <FilePlus2 aria-hidden="true" className="size-5" /> New evidence
          </Button>
        ) : (
          <div
            className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold ${current === 'setup' ? 'rail-active' : 'text-muted-foreground'}`}
          >
            <Settings2 aria-hidden="true" className="size-5" /> New evidence
          </div>
        )}
      </nav>
      <div className="mt-auto rounded-xl border bg-[var(--warm-canvas)] p-4">
        <p className="data-label">Current product slice</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Upload and review market listings, then freeze a market evidence
          packet for the wider BOSS decision.
        </p>
        <div className="mt-3 space-y-1 border-t pt-3">
          <p className="data-label">Approach previews</p>
          <Link
            href="/calibration"
            className="block text-xs font-semibold text-[var(--flent-teal)] hover:underline"
          >
            Problem 2 · Feedback loop
          </Link>
          <Link
            href="/decision"
            className="block text-xs font-semibold text-[var(--flent-teal)] hover:underline"
          >
            Problem 3 · Decision page
          </Link>
        </div>
      </div>
    </aside>
  );
}

export function MobileHeader({ version }: { version?: number }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur-md lg:hidden">
      <div className="app-shell flex min-h-16 items-center justify-between gap-4">
        <BrandMark compact />
        {version ? (
          <span className="data-value rounded-full border bg-slate-50 px-3 py-1 text-xs">
            Evidence v{version}
          </span>
        ) : (
          <span className="rounded-full border bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            New evidence
          </span>
        )}
      </div>
    </header>
  );
}
