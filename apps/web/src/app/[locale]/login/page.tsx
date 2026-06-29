'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage({ params }: { params: { locale: string } }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const locale = params?.locale ?? 'fr';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = createBrowserClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(t('loginError'));
        return;
      }

      if (!data.user) {
        setError(t('loginError'));
        return;
      }

      // Vérifier que le profil existe (sinon l'app ne peut pas fonctionner)
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, active')
        .eq('id', data.user.id)
        .single();

      if (!profile?.active) {
        setError(
          'Compte connecté, mais profil manquant. Demandez à un admin de créer votre profil dans Supabase (table profiles).',
        );
        await supabase.auth.signOut();
        return;
      }

      router.push(`/${locale}/orders/new`);
      router.refresh();
    } catch {
      setError('Impossible de contacter Supabase. Vérifiez votre connexion internet et redémarrez le serveur (pnpm dev).');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Globus Livraison</CardTitle>
          <CardDescription>{t('login')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '...' : t('loginButton')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
