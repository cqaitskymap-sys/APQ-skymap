'use client';

import { useParams } from 'next/navigation';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PqrSectionPage } from '@/components/pqr/pqr-section-page';

export default function PqrTrendsPage() {
  const pqrId = useParams().id as string;
  return (
    <PqrSectionPage pqrId={pqrId} title="Trend Analysis" description="Batch release, OOS, and yield trends during review period">
      {({ snapshot }) => (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Monthly Batch Release</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={snapshot?.trends.monthlyBatches ?? []}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend />
                  <Bar dataKey="released" fill="#2563eb" name="Released" /><Bar dataKey="rejected" fill="#dc2626" name="Rejected" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">OOS Trend</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={snapshot?.trends.oosTrend ?? []}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#d97706" strokeWidth={2} name="OOS Count" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Yield Trend</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={snapshot?.trends.yieldTrend ?? []}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis domain={[95, 100]} /><Tooltip />
                  <Line type="monotone" dataKey="yield" stroke="#059669" strokeWidth={2} name="Yield %" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </PqrSectionPage>
  );
}
