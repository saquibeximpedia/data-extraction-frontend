import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/config';

/** Open to anyone: sign-in, share links and their downloads */
const PUBLIC = ['/login', '/s/', '/api/public/'];

/**
 * Runs before every page and route: refreshes the Supabase session cookies before they expire,
 * and sends anyone without a session to the sign-in page. Pages still check the session themselves.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  if (!data?.claims && !PUBLIC.some((p) => path.startsWith(p))) {
    if (path.startsWith('/api/')) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return response;
}

export const config = {
  // Everything but Next's own files and static assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
