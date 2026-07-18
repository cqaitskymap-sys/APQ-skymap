import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createRemoteJWKSet } from 'jose/jwks/remote';
import { jwtVerify } from 'jose/jwt/verify';

const PROTECTED_PREFIXES = ['/dashboard', '/cpv', '/qms', '/pqr', '/admin', '/training'];
const AUTH_ROUTES = ['/auth/login', '/auth/signup', '/login'];
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('__session')?.value;
  if (!token) return false;

  if (
    process.env.NODE_ENV !== 'production'
    && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true'
  ) {
    return true;
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return false;
  try {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
    });
    return payload.active !== false;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/qms/training' || pathname.startsWith('/qms/training/')) {
    const newPath = pathname.replace(/^\/qms\/training/, '/training') || '/training';
    return NextResponse.redirect(new URL(newPath, request.url));
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  );
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  const sessionIsValid = await hasValidSession(request);

  if (isProtected && !sessionIsValid) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('__session');
    response.cookies.delete('firebase-auth-session');
    return response;
  }

  if (isAuthRoute && sessionIsValid) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/cpv/:path*', '/qms/:path*', '/pqr/:path*', '/admin/:path*', '/training/:path*', '/auth/:path*', '/login'],
};
