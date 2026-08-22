import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ─── Route protection rules ──────────────────────────────────────────────────

/** Routes that require the user to be authenticated (any role). */
const PROTECTED_ROUTES = ['/dashboard', '/erp', '/profile', '/settings'];

// /admin routes have been removed — testimonials and all admin features
// are now part of the /erp dashboard (ADMIN-only pages inside /erp).
const ADMIN_ROUTES: string[] = [];

/** Routes that logged-in users should be redirected away from. */
const AUTH_ROUTES = ['/auth/signin', '/auth/signup', '/auth'];

// ─── Middleware ───────────────────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Expose the request pathname to Server Components ─────────────────────
  // The root layout (which owns the single <html>) reads this header to set
  // lang/dir server-side for the URL locale (/ar → rtl, /en → ltr), so the
  // FIRST server render already has the correct language & direction — no
  // client-side localStorage flip needed for public localized pages.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);
  const pass = () => NextResponse.next({ request: { headers: requestHeaders } });

  // Presence of access_token cookie is our "is logged in" signal.
  // The actual JWT verification happens in the NestJS backend;
  // here we only gate navigation to avoid unnecessary page flashes.
  const accessToken  = request.cookies.get('access_token')?.value;
  const isLoggedIn   = Boolean(accessToken);

  // Check if the path starts with any protected route
  const isAdminRoute     = ADMIN_ROUTES.some((route) => pathname.startsWith(route));
  const isProtectedRoute = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  const isAuthRoute      = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  // ── Redirect unauthenticated users away from protected pages ─────────────
  if ((isProtectedRoute || isAdminRoute) && !isLoggedIn) {
    const url = request.nextUrl.clone();
    url.pathname    = '/auth';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  // NOTE: We intentionally do NOT redirect logged-in users away from /auth
  // here. The middleware only has the access_token cookie as a signal, but
  // that cookie may be expired. If we redirect to /dashboard and the token
  // is stale, the dashboard layout will call getMe() → 401 → Axios interceptor
  // tries refresh → on failure does window.location.href = '/auth' → middleware
  // sees the cookie again → /dashboard → infinite loop.
  //
  // Instead, the auth page itself handles the "already logged in" redirect
  // inside a useEffect that waits for isLoading to settle — by that point
  // the auth store has confirmed the session is genuinely valid.

  // NOTE: Role-based admin checks (ADMIN vs CLIENT) are enforced by:
  //   1. The NestJS API (RolesGuard on every endpoint)
  //   2. The /admin dashboard itself (useAuth().isAdmin check)
  // The middleware intentionally doesn't decode the JWT to keep it lightweight.

  return pass();
}

// ─── Matcher ─────────────────────────────────────────────────────────────────
//
// Runs on all routes EXCEPT static assets and Next internals, so that:
//   1. protected routes are auth-gated (as before), and
//   2. every rendered document carries the `x-pathname` header the root
//      layout uses to set <html lang/dir> from the URL locale.
export const config = {
  matcher: [
    // Everything except _next internals, the API proxy, and files with an
    // extension (og-image.png, analytics.js, favicon, sitemap.xml, etc.).
    '/((?!_next/static|_next/image|api|.*\\.[\\w]+$).*)',
  ],
};
