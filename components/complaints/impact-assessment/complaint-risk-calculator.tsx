'use client';

import { computeRiskLevel, computeRiskScore, riskLevelColor } from '@/lib/complaint-impact-records';
import { RiskBadge } from '@/components/complaints/complaint-sub-nav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ComplaintRiskCalculatorProps {
  severity: number;
  occurrence: number;
  detection: number;
  onChange: (field: 'severity' | 'occurrence' | 'detection', value: number) => void;
  disabled?: boolean;
}

export function ComplaintRiskCalculator({ severity, occurrence, detection, onChange, disabled }: ComplaintRiskCalculatorProps) {
  const score = computeRiskScore(severity, occurrence, detection);
  const level = computeRiskLevel(score);

  return (
    <Card className="border-blue-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Risk Score Calculator</CardTitle>
        <CardDescription>Severity × Occurrence × Detection (1–10 each)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {([
            ['severity', 'Severity (S)', severity],
            ['occurrence', 'Occurrence (O)', occurrence],
            ['detection', 'Detection (D)', detection],
          ] as const).map(([field, label, val]) => (
            <div key={field} className="space-y-1">
              <Label>{label}</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={val}
                disabled={disabled}
                onChange={(e) => onChange(field, Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4 rounded-lg bg-muted/50 p-4">
          <div>
            <p className="text-xs text-muted-foreground">Risk Score</p>
            <p className="text-2xl font-bold font-mono">{score}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Risk Level</p>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${riskLevelColor(level)}`}>
              {level}
            </span>
          </div>
          <RiskBadge level={level} />
        </div>
      </CardContent>
    </Card>
  );
}
