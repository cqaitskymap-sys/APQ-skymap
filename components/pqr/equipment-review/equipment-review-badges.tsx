'use client';

import {
  calibrationStatusColor, equipmentComplianceColor, pmStatusColor,
  qualificationStatusColor, riskLevelColor,
} from '@/lib/pqr-equipment-review-records';

export function QualificationBadge({ status }: { status: string }) {
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${qualificationStatusColor(status)}`}>{status}</span>;
}

export function CalibrationBadge({ status }: { status: string }) {
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${calibrationStatusColor(status)}`}>{status}</span>;
}

export function PmBadge({ status }: { status: string }) {
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${pmStatusColor(status)}`}>{status}</span>;
}

export function EquipmentComplianceBadge({ status }: { status: string }) {
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${equipmentComplianceColor(status)}`}>{status}</span>;
}

export function EquipmentRiskBadge({ level }: { level: string }) {
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${riskLevelColor(level)}`}>{level}</span>;
}
