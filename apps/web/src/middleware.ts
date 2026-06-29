import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

const publicPaths = ['/login'];

export async function middleware(request: NextRequest) {
  const intlResponse = intlMiddleware(request);

  const pathname = request.nextUrl.pathname;
  const locale = pathname.split('/')[1] || 'fr';
  const pathWithoutLocale = pathname.replace(`/${locale}`, '') || '/';

  const isPublic = publicPaths.some((p) => pathWithoutLocale.startsWith(p));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            intlResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic && pathWithoutLocale !== '/') {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Ne pas rediriger automatiquement login → orders ici :
  // un user peut être connecté sans profil (boucle infinie sinon).

  if (pathWithoutLocale === '/') {
    const target = user ? `/${locale}/orders/new` : `/${locale}/login`;
    return NextResponse.redirect(new URL(target, request.url));
  }

  return intlResponse;
}

export const config = {
  matcher: ['/', '/(fr|de)/:path*'],
};
