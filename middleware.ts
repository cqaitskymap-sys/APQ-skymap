import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/dashboard', '/cpv', '/qms', '/pqr', '/admin'];
const AUTH_ROUTES = ['/auth/login', '/auth/signup', '/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  );
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  const session = request.cookies.get('firebase-auth-session')?.value
    || request.cookies.get('__session')?.value;

  if (isProtected && !session) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/cpv/:path*', '/qms/:path*', '/pqr/:path*', '/admin/:path*', '/auth/:path*', '/login'],
};
