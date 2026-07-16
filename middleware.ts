import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/dashboard', '/cpv', '/qms', '/pqr', '/admin', '/training'];
const AUTH_ROUTES = ['/auth/login', '/auth/signup', '/login'];

const trainingRedirects: Record<string, string> = {
  '/training/job-description': '/training/jr-assignment',
  '/training/tni': '/training/jr-assignment',
  '/training/scheduling': '/training/jr-training-schedule',
  '/training/schedule': '/training/jr-training-schedule',
  '/training/assignments': '/training/jr-training-schedule',
  '/training/need-based': '/training/target-training',
  '/training/refresher': '/training/target-training',
  '/training/retraining': '/training/target-training',
  '/training/srd': '/training/target-training',
  '/training/new-employee': '/training/induction',
  '/training/planner': '/training/annual-plan',
  '/training/training-request': '/training/jr-training-schedule',
  '/training/competency': '/training/assessment',
  '/training/effectiveness': '/training/assessment',
  '/training/practical-assessment': '/training/assessment',
  '/training/questionnaire': '/training/content',
  '/training/certificates': '/training/history',
  '/training/certificate-management': '/training/history',
  '/training/certificate-registry': '/training/history',
  '/training/analytics': '/training/reports',
  '/training/report-center': '/training/reports',
  '/training/activity-log': '/training/audit-trail',
  '/training/audit': '/training/audit-trail',
  '/training/workflows': '/training/approval-workflow',
  '/training/approvals': '/training/approval-workflow',
  '/training/records': '/training/history',
  '/training/employee-history': '/training/history',
  '/training/lms': '/training/settings',
  '/training/lms-integration': '/training/settings',
  '/training/train-the-trainer': '/training/trainer',
  '/training/trainer-qualification': '/training/trainer',
  '/training/trainer-assessment': '/training/trainer',
  '/training/certified-trainers': '/training/trainer',
  '/training/trainer-certificate': '/training/trainer',
  '/training/trainer-renewal': '/training/trainer',
  '/training/company-program': '/training/induction',
  '/training/ojt-planner': '/training/ojt',
  '/training/attendance': '/training/completion',
  '/training/calendar': '/training/annual-plan',
  '/training/scheduler': '/training/sessions',
  '/training/events': '/training/sessions',
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/qms/training' || pathname.startsWith('/qms/training/')) {
    const newPath = pathname.replace(/^\/qms\/training/, '/training') || '/training';
    return NextResponse.redirect(new URL(newPath, request.url));
  }

  if (trainingRedirects[pathname]) {
    return NextResponse.redirect(new URL(trainingRedirects[pathname], request.url));
  }

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
  matcher: ['/dashboard/:path*', '/cpv/:path*', '/qms/:path*', '/pqr/:path*', '/admin/:path*', '/training/:path*', '/auth/:path*', '/login'],
};
