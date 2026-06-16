'use client';

import { useEffect, useState } from 'react';
import { Cloud, RefreshCw, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { checkFirebaseConnection } from '@/lib/admin/admin-service';
import { isFirebaseConfigured, getFirebaseSetupMessage } from '@/lib/firebase';
import { ADMIN_COLLECTIONS } from '@/lib/admin/constants';

interface FirebaseStatus {
  configured: boolean;
  connected: boolean;
  projectId: string;
  latencyMs: number;
  error?: string;
}

export default function FirebaseStatusPage() {
  const [status, setStatus] = useState<FirebaseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState('');

  const check = async () => {
    setLoading(true);
    const result = await checkFirebaseConnection();
    setStatus(result);
    setCheckedAt(new Date().toLocaleString());
    setLoading(false);
  };

  useEffect(() => { check(); }, []);

  const StatusIcon = status?.connected ? CheckCircle2 : status?.configured ? AlertCircle : XCircle;
  const statusColor = status?.connected ? 'text-green-600' : status?.configured ? 'text-amber-600' : 'text-red-600';

  return (
    <div>
      <AdminPageHeader
        title="Firebase Connection Status"
        description="Real-time Firebase connectivity and configuration diagnostics"
        actions={
          <Button variant="outline" onClick={check} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {loading && !status ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Cloud className="h-5 w-5" />Connection Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                {status && <StatusIcon className={`h-8 w-8 ${statusColor}`} />}
                <div>
                  <p className="font-semibold text-lg">
                    {status?.connected ? 'Connected' : status?.configured ? 'Degraded' : 'Not Configured'}
                  </p>
                  <p className="text-sm text-muted-foreground">Last checked: {checkedAt}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 border rounded-lg">
                  <p className="text-muted-foreground text-xs">Project ID</p>
                  <p className="font-mono">{status?.projectId || '—'}</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-muted-foreground text-xs">Latency</p>
                  <p>{status?.latencyMs ? `${status.latencyMs}ms` : '—'}</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-muted-foreground text-xs">Configured</p>
                  <Badge variant="outline">{status?.configured ? 'Yes' : 'No'}</Badge>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-muted-foreground text-xs">Firestore</p>
                  <Badge variant="outline" className={status?.connected ? 'text-green-700' : 'text-red-700'}>
                    {status?.connected ? 'Reachable' : 'Unreachable'}
                  </Badge>
                </div>
              </div>
              {status?.error && (
                <p className="text-sm text-red-600 p-3 bg-red-50 rounded-lg">{status.error}</p>
              )}
              {!isFirebaseConfigured() && (
                <p className="text-sm text-amber-700 p-3 bg-amber-50 rounded-lg">{getFirebaseSetupMessage()}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Admin Collections</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {Object.entries(ADMIN_COLLECTIONS).map(([key, path]) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b text-sm">
                    <span className="font-mono text-xs">{path}</span>
                    <Badge variant="outline" className="text-xs">{key}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
