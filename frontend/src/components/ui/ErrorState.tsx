import { AlertCircle, RefreshCw } from 'lucide-react';

import { EmptyState } from './EmptyState';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Não foi possível carregar',
  description = 'Ocorreu um erro ao buscar as informações. Verifique sua conexão e tente novamente.',
  onRetry,
}: ErrorStateProps) {
  return (
    <EmptyState
      icon={<AlertCircle size={30} aria-hidden />}
      title={title}
      description={description}
      action={
        onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-xl border border-olive-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:bg-cream-50 focus-visible:ring-2 focus-visible:ring-olive-500"
          >
            <RefreshCw size={16} aria-hidden />
            Tentar novamente
          </button>
        ) : undefined
      }
    />
  );
}
