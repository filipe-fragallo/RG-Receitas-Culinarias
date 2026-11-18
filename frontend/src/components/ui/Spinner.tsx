import { Loader2 } from 'lucide-react';

import { cn } from '../../lib/cn';

export function Spinner({
  className,
  label = 'Carregando',
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex', className)}>
      <Loader2 size={20} className="animate-spin text-olive-600" aria-hidden />
    </span>
  );
}
