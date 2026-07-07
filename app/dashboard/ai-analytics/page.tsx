'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Zap } from 'lucide-react';

export default function AIAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Analytics Engine</h1>
          <p className="text-muted-foreground">Predictive analytics, anomaly detection, and intelligent insights</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-500 gap-2">
          <Zap className="h-4 w-4" />Run Analysis
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Insights Generated</p>
            <p className="text-3xl font-bold">0</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Avg Accuracy</p>
            <p className="text-3xl font-bold">—</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Issues Prevented</p>
            <p className="text-3xl font-bold">0</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">ROI Improvement</p>
            <p className="text-3xl font-bold">—</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            AI-Powered Insights
          </h2>
          <p className="text-sm text-muted-foreground text-center py-12">
            No insights available yet. Run an analysis to generate AI-powered recommendations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
