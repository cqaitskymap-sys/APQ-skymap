'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ComplianceGauge({ percent, label = 'Department Compliance' }: { percent: number; label?: string }) {
  const color = percent >= 90 ? '#16a34a' : percent >= 70 ? '#ea580c' : '#dc2626';
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center py-4">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="45" fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="45" fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" transform="rotate(-90 60 60)"
          />
          <text x="60" y="58" textAnchor="middle" fontSize="22" fontWeight="bold" fill={color}>{percent}%</text>
          <text x="60" y="76" textAnchor="middle" fontSize="10" fill="#64748b">Compliant</text>
        </svg>
      </CardContent>
    </Card>
  );
}
