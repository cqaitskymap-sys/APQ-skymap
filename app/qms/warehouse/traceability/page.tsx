'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { TraceabilityReport } from '@/components/warehouse-mgmt/warehouse-pdf-document';
import { getTraceabilityForRecall } from '@/lib/warehouse-mgmt-service';
import type { TraceabilityRecord } from '@/lib/warehouse-mgmt-types';

export default function TraceabilityPage() {
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<TraceabilityRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    const results = await getTraceabilityForRecall(query.trim());
    setRecords(results);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Material Traceability</h1>
        <p className="text-muted-foreground text-sm">Trace from API/RM/PM lot → production batch → finished goods → dispatch. Supports recall investigations.</p>
      </div>
      <Card><CardContent className="pt-6">
        <div className="flex gap-2">
          <Input placeholder="Enter AR number, lot, batch, or FG batch…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="max-w-md" />
          <Button className="bg-blue-600 hover:bg-blue-700 gap-2" onClick={handleSearch}><Search className="h-4 w-4" />Trace</Button>
        </div>
      </CardContent></Card>
      {loading ? <LoadingSpinner /> : searched && (
        records.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No traceability chain found for &quot;{query}&quot;</CardContent></Card>
        ) : (
          <>
            <TraceabilityReport records={records} />
            <Link href="/qms/recall"><Button variant="outline">Open Recall Module for investigation →</Button></Link>
          </>
        )
      )}
      {!searched && (
        <Card><CardHeader><CardTitle>Traceability Flow</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>1. Material Receipt (GRN) → Quarantine → QC Sampling → Release</p>
            <p>2. Dispensing to Production Batch</p>
            <p>3. Finished Goods creation linked to source batch</p>
            <p>4. Dispatch (future link to distribution records)</p>
            <p className="text-amber-600">Use this module with Recall Management for lot/batch investigations.</p>
          </CardContent></Card>
      )}
    </div>
  );
}
