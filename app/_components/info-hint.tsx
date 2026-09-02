'use client';

import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// A small, consistent "what is this?" affordance. An info icon that reveals a
// plain-language explanation on hover or focus. Used on intake fields and on every
// card, so a first-time reviewer can understand each number without leaving the
// screen. stopPropagation keeps it inert inside clickable cards (it explains, it
// never triggers the card's own click).
export function InfoHint({
  label,
  side = 'top',
  className,
}: {
  label: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}) {
  return (
    <TooltipProvider delay={120}>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label="More information"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
              }}
            />
          }
          className={`inline-flex shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--flent-teal)] ${className ?? ''}`}
        >
          <Info className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="max-w-xs text-left text-xs leading-5"
        >
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
