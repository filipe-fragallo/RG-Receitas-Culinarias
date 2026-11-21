import { BookOpenText, LogOut, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { getFirstName, getInitials } from '../../lib/format';
import { cn } from '../../lib/cn';
import { Logo } from './Logo';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'group flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition',
    isActive
      ? 'bg-cream-100 text-olive-950 shadow-sm'
      : 'text-cream-200/80 hover:bg-white/5 hover:text-cream-50',
  );

export function AppShell() {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // O ProtectedRoute faz o redirecionamento quando o status muda para anônimo.
      await logout();
    } finally {
      // Em falha de rede a sessão permanece ativa para uma nova tentativa.
      setIsLoggingOut(false);
    }
  };

  const displayName = user?.name ?? user?.login ?? '';
  const firstName = getFirstName(displayName);

  return (
    <div className="min-h-screen lg:pl-72">
      <a href="#content" className="skip-link no-print">
        Pular para o conteúdo
      </a>

      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-72 flex-col overflow-hidden bg-olive-950 px-5 py-7 text-cream-100 lg:flex">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-olive-700/30 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-terracotta-700/20 blur-3xl"
          aria-hidden
        />

        <Link
          to="/"
          className="relative rounded-xl focus-visible:ring-cream-200 focus-visible:ring-offset-olive-950"
          aria-label="Meu Caderno de Receitas — ir para minhas receitas"
        >
          <Logo tone="light" />
        </Link>

        <nav className="relative mt-10 space-y-1.5" aria-label="Navegação principal">
          <NavLink to="/" end className={navLinkClass}>
            <BookOpenText size={19} aria-hidden />
            Minhas receitas
          </NavLink>
          <NavLink to="/recipes/new" className={navLinkClass}>
            <Plus size={19} aria-hidden />
            Nova receita
          </NavLink>
        </nav>

        <div className="relative mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start gap-2 text-cream-200/80">
            <Sparkles size={15} className="mt-0.5 shrink-0 text-terracotta-300" aria-hidden />
            <p className="text-xs leading-relaxed">
              Um bom prato começa com uma receita guardada com carinho.
            </p>
          </div>
        </div>

        <div className="relative mt-5 flex items-center gap-3 border-t border-white/10 pt-5">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terracotta-600 text-sm font-bold text-white"
            aria-hidden
          >
            {user ? getInitials(user.name, user.login) : '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-cream-50">{displayName}</p>
            <p className="truncate text-xs text-cream-300/70">@{user?.login}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
            className="rounded-lg p-2 text-cream-300/80 transition hover:bg-white/10 hover:text-cream-50 focus-visible:ring-cream-200 focus-visible:ring-offset-olive-950 disabled:opacity-50"
            aria-label="Sair da conta"
            title="Sair da conta"
          >
            <LogOut size={18} aria-hidden />
          </button>
        </div>
      </aside>

      <header className="no-print sticky top-0 z-30 border-b border-olive-100/80 bg-cream-100/90 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="rounded-lg" aria-label="Ir para minhas receitas">
            <Logo compact />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/recipes/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-olive-800 px-3 py-2 text-xs font-semibold text-cream-50 shadow-sm transition hover:bg-olive-900 focus-visible:ring-2 focus-visible:ring-olive-500"
            >
              <Plus size={15} aria-hidden />
              Nova
            </Link>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              className="rounded-lg border border-olive-200 bg-white p-2 text-ink-soft transition hover:bg-cream-50 focus-visible:ring-2 focus-visible:ring-olive-500 disabled:opacity-50"
              aria-label="Sair da conta"
              title="Sair da conta"
            >
              <LogOut size={16} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        {firstName && (
          <p className="no-print mb-6 hidden text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted lg:block">
            Olá, {firstName}
          </p>
        )}
        <main id="content" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="no-print mt-16 border-t border-olive-100 pt-6 text-center text-xs text-ink-muted">
          Meu Caderno de Receitas · suas receitas, do seu jeito.
        </footer>
      </div>
    </div>
  );
}
