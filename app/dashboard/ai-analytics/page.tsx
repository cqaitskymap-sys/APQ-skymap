'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Zap, TrendingUp, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { mockAiInsights } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

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
            <p className="text-3xl font-bold">847</p>
            <p className="text-xs text-green-600 mt-2">↑ 34% this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Avg Accuracy</p>
            <p className="text-3xl font-bold">94.2%</p>
            <p className="text-xs text-blue-600 mt-2">88-98% range</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Issues Prevented</p>
            <p className="text-3xl font-bold">12</p>
            <p className="text-xs text-green-600 mt-2">This month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">ROI Improvement</p>
            <p className="text-3xl font-bold">28%</p>
            <p className="text-xs text-green-600 mt-2">Cost reduction</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardContent className="p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              AI-Powered Insights
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mockAiInsights.map((insight) => (
                <div key={insight.id} className={cn(
                  'p-4 rounded-lg border-l-4 bg-muted/50',
                  insight.type === 'warning' ? 'border-l-amber-500' :
                  insight.type === 'error' ? 'border-l-red-500' :
                  insight.type === 'success' ? 'border-l-green-500' :
                  'border-l-blue-500'
                )}>
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      {insight.type === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                      {insight.type === 'success' && <TrendingUp className="h-4 w-4 text-green-500" />}
                      {insight.title}
                    </h4>
                    <Badge variant="outline" className="text-xs">{insight.confidence}%</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{insight.description}</p>
                  <Button variant="outline" size="sm" className="text-xs h-7">Take Action</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="font-semibold mb-4">Predictive Models</h2>
            <div className="space-y-3">
              {[
                { name: 'OOS Prediction', accuracy: 91, status: 'active' },
                { name: 'Batch Failure Prediction', accuracy: 87, status: 'active' },
                { name: 'Yield Anomaly Detection', accuracy: 94, status: 'active' },
                { name: 'Equipment Drift Detection', accuracy: 89, status: 'active' },
              ].map((model, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium text-sm">{model.name}</p>
                    <div className="w-40 h-2 bg-muted rounded-full mt-1.5">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${model.accuracy}%` }} />
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-xs mb-1">{model.accuracy}%</Badge>
                    <Badge variant="secondary" className="text-xs ml-1">{model.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
