import { cn } from '@/lib/utils';
import { Loader2Icon } from 'lucide-react';

function Spinner({ className, ...props }: React.ComponentProps<'output'>) {
  return (
    <output
      aria-label="Loading"
      data-slot="spinner"
      className={cn('inline-flex size-4', className)}
      {...props}
    >
      <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />
    </output>
  );
}

export { Spinner };
