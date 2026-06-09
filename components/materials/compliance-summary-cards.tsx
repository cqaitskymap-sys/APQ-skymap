'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';

interface SummaryCardsProps {
  totalMaterials: number;
  totalAPILots: number;
  totalRawMaterialLots: number;
  approvedLots: number;
  rejectedLots: number;
  avlCompliantLots: number;
  nonCompliantLots: number;
  expiredRetestDueMaterials: number;
}

export function ComplianceSummaryCards({
  totalMaterials,
  totalAPILots,
  totalRawMaterialLots,
  approvedLots,
  rejectedLots,
  avlCompliantLots,
  nonCompliantLots,
  expiredRetestDueMaterials,
}: SummaryCardsProps) {
  const stats = [
    {
      title: 'Total Materials Reviewed',
      value: totalMaterials,
      change: null,
      icon: '📦',
      color: 'from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10',
    },
    {
      title: 'Total API Lots',
      value: totalAPILots,
      change: null,
      icon: '🧪',
      color: 'from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10',
    },
    {
      title: 'Total Raw Material Lots',
      value: totalRawMaterialLots,
      change: null,
      icon: '🏭',
      color: 'from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10',
    },
    {
      title: 'Approved Lots',
      value: approvedLots,
      percentage: totalMaterials > 0 ? ((approvedLots / totalMaterials) * 100).toFixed(1) : '0',
      icon: '✅',
      color: 'from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10',
      trend: 'up',
    },
    {
      title: 'Rejected Lots',
      value: rejectedLots,
      percentage: totalMaterials > 0 ? ((rejectedLots / totalMaterials) * 100).toFixed(1) : '0',
      icon: '❌',
      color: 'from-red-50 to-red-100/50 dark:from-red-950/20 dark:to-red-900/10',
      trend: 'down',
    },
    {
      title: 'AVL Compliant Lots',
      value: avlCompliantLots,
      percentage: totalMaterials > 0 ? ((avlCompliantLots / totalMaterials) * 100).toFixed(1) : '0',
      icon: '✓',
      color: 'from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10',
      trend: 'up',
    },
    {
      title: 'Non-Compliant Lots',
      value: nonCompliantLots,
      percentage: totalMaterials > 0 ? ((nonCompliantLots / totalMaterials) * 100).toFixed(1) : '0',
      icon: '⚠️',
      color: 'from-orange-50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/10',
      trend: 'down',
    },
    {
      title: 'Expired / Retest Due',
      value: expiredRetestDueMaterials,
      icon: '⏰',
      color: 'from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10',
      trend: 'alert',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.title} className={`bg-gradient-to-br ${stat.color} border-0`}>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <span className="text-2xl">{stat.icon}</span>
                {stat.trend === 'up' && (
                  <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                )}
                {stat.trend === 'down' && (
                  <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                )}
                {stat.trend === 'alert' && (
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">{stat.title}</p>
                <p className="text-2xl font-bold tracking-tight mt-1">{stat.value}</p>
                {stat.percentage && (
                  <p className="text-xs text-muted-foreground mt-1">{stat.percentage}% of total</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
