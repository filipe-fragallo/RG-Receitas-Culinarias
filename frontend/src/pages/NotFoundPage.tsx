import { ArrowLeft, SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Logo } from '../components/layout/Logo';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Página não encontrada');
  const { status } = useAuth();
  const destination = status === 'authenticated' ? '/' : '/login';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
      <Logo />
      <div className="mt-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-olive-100 text-olive-700">
        <SearchX size={30} aria-hidden />
      </div>
      <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.22em] text-terracotta-700">
        Erro 404
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold text-ink">
        Esta página saiu da receita
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
        O endereço que você tentou acessar não existe ou foi movido. Volte para o seu caderno para
        continuar.
      </p>
      <Link
        to={destination}
        className="mt-7 inline-flex items-center gap-2 rounded-xl bg-olive-800 px-5 py-3 text-sm font-semibold text-cream-50 shadow-sm transition hover:bg-olive-900 focus-visible:ring-2 focus-visible:ring-olive-500 focus-visible:ring-offset-2"
      >
        <ArrowLeft size={17} aria-hidden />
        {status === 'authenticated' ? 'Voltar para minhas receitas' : 'Ir para o login'}
      </Link>
    </div>
  );
}
