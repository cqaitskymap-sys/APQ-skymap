'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { EnterpriseTmsNav } from '@/components/training/enterprise/enterprise-tms-nav';

/** @deprecated Use EnterpriseTmsNav — kept for backward compatibility */
export function TmsSubNav() {
  return <EnterpriseTmsNav />;
}

export {
  TmsStatusBadge, EffectivenessBadge, ComplianceBadge,
  AttendanceBadge, CompletionBadge, ResultBadge,
} from '@/components/training/tms-sub-nav-badges';
