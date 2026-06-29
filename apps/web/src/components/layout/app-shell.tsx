'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Package, History, BarChart3, Settings, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { createBrowserClient } from '@/lib/supabase/client';
import type { Profile } from '@globus/core/types';

interface AppShellProps {
  children: React.ReactNode;
  locale: string;
  profile: Profile;
}

export function AppShell({ children, locale, profile }: AppShellProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: `/${locale}/orders/new`, label: t('nav.newOrder'), icon: Package },
    { href: `/${locale}/orders`, label: t('nav.history'), icon: History },
    { href: `/${locale}/stats`, label: t('nav.stats'), icon: BarChart3 },
    ...(profile.role === 'admin'
      ? [{ href: `/${locale}/admin`, label: t('nav.admin'), icon: Settings }]
      : []),
  ];

  async function handleLogout() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
    router.refresh();
  }

  function isNavActive(href: string) {
    if (href.endsWith('/orders/new')) {
      return pathname.startsWith(href);
    }
    if (href.endsWith('/orders')) {
      return (
        pathname === href ||
        (pathname.startsWith(`${href}/`) && !pathname.includes('/orders/new'))
      );
    }
    return pathname.startsWith(href);
  }

  function NavLink({
    item,
    onNavigate,
  }: {
    item: (typeof navItems)[0];
    onNavigate?: () => void;
  }) {
    const isActive = isNavActive(item.href);

    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200',
          isActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-foreground/80 hover:bg-muted hover:text-foreground',
        )}
      >
        <item.icon className={cn('h-4 w-4 transition-transform duration-200', isActive && 'scale-110')} />
        {item.label}
      </Link>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header mobile */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <span className="font-semibold tracking-tight">{t('common.appName')}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen((o) => !o)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            className="transition-transform active:scale-95"
          >
            <AnimatePresence mode="wait" initial={false}>
              {mobileOpen ? (
                <motion.span
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <X className="h-5 w-5" />
                </motion.span>
              ) : (
                <motion.span
                  key="menu"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Menu className="h-5 w-5" />
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden border-t"
            >
              <div className="space-y-1 p-4">
                {navItems.map((item, i) => (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.2 }}
                  >
                    <NavLink item={item} onNavigate={() => setMobileOpen(false)} />
                  </motion.div>
                ))}
                <motion.button
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: navItems.length * 0.05, duration: 0.2 }}
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                  {t('common.logout')}
                </motion.button>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <div className="flex">
        {/* Sidebar desktop */}
        <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r bg-background">
          <div className="flex h-14 items-center border-b px-6">
            <span className="font-semibold text-lg tracking-tight">{t('common.appName')}</span>
          </div>
          <nav className="flex-1 space-y-1 p-4">
            {navItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>
          <div className="border-t p-4">
            <p className="text-sm text-muted-foreground mb-2 truncate">{profile.full_name}</p>
            <Button
              variant="outline"
              size="sm"
              className="w-full transition-all hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t('common.logout')}
            </Button>
          </div>
        </aside>

        {/* Contenu principal */}
        <main className="flex-1 lg:pl-64">
          <div className="container max-w-5xl py-6 px-4 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
