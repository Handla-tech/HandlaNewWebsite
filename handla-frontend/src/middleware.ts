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

// ─── CSP origins (kept in sync with the regression test) ─────────────────────
// Derived the same way next.config.js used to derive them, so the per-request
// nonce-based CSP authorizes exactly the same origins the app needs.
const API_ORIGIN = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').origin; }
  catch { return 'http://localhost:3001'; }
})();
const SOCKET_ORIGIN = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001').origin; }
  catch { return 'http://localhost:3001'; }
})();
const S3_UPLOAD_ORIGIN = (() => {
  const bucket = process.env.NEXT_PUBLIC_AWS_S3_BUCKET || 'handla-uploads';
  const region = process.env.NEXT_PUBLIC_AWS_REGION || 'eu-north-1';
  return `https://${bucket}.s3.${region}.amazonaws.com`;
})();
const GOOGLE_FONTS_STYLESHEET = 'https://fonts.googleapis.com';
const GOOGLE_FONTS_FILES = 'https://fonts.gstatic.com';

/**
 * Build the per-request Content-Security-Policy.
 *
 * script-src is nonce-based (Phase 6): 'unsafe-inline' has been REMOVED. The
 * only trusted inline script (the anti-FOUC theme script in the root layout)
 * carries this same nonce via the `x-nonce` header the layout reads, and Next
 * automatically stamps its own bootstrap/hydration inline scripts with the
 * nonce it discovers on the incoming CSP header. 'strict-dynamic' lets those
 * nonce-trusted scripts load the chunked app scripts without an origin list.
 *
 * style-src intentionally KEEPS 'unsafe-inline': framer-motion injects
 * nonce-less <style> tags at runtime and Next inlines critical CSS, so a strict
 * style nonce would break rendering. Tightening style-src is tracked as a
 * separate future item.
 */
export function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline' ${GOOGLE_FONTS_STYLESHEET}`,
    `font-src 'self' data: ${GOOGLE_FONTS_FILES}`,
    `img-src 'self' data: blob: ${S3_UPLOAD_ORIGIN}`,
    `connect-src 'self' ${API_ORIGIN} ${SOCKET_ORIGIN} ${S3_UPLOAD_ORIGIN} ws: wss:`,
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ].join('; ');
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Per-request CSP nonce ────────────────────────────────────────────────
  // A fresh 128-bit base64 nonce per response. Exposed to the layout via the
  // `x-nonce` request header and set on the response CSP so script-src can drop
  // 'unsafe-inline'.
  const nonce = btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))),
  );

  // ── Expose the request pathname to Server Components ─────────────────────
  // The root layout (which owns the single <html>) reads this header to set
  // lang/dir server-side for the URL locale (/ar → rtl, /en → ltr), so the
  // FIRST server render already has the correct language & direction — no
  // client-side localStorage flip needed for public localized pages.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);
  requestHeaders.set('x-nonce', nonce);
  // Next reads the CSP off the REQUEST headers to know which nonce to stamp on
  // its own inline bootstrap scripts, so set it on both request and response.
  const csp = buildCsp(nonce);
  requestHeaders.set('content-security-policy', csp);
  const pass = () => {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set('content-security-policy', csp);
    return res;
  };

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
