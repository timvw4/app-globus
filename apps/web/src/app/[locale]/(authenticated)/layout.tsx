import { requireAuth } from '@/lib/auth';
import { AppShell } from '@/components/layout/app-shell';
import { PageContent } from '@/components/layout/page-content';

export default async function AuthenticatedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { profile } = await requireAuth(locale);

  return (
    <AppShell locale={locale} profile={profile}>
      <PageContent>{children}</PageContent>
    </AppShell>
  );
}
