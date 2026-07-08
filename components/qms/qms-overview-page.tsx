'use client';

import Link from 'next/link';
import {
  AlertTriangle, BookOpen, CheckSquare, ClipboardList, Factory, FileCheck,
  LineChart, MessageSquare, Monitor, PackageSearch, RefreshCw, RotateCcw,
  ShieldCheck, TestTube, Thermometer, TruckIcon, Wrench,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const QMS_MODULES = [
  { label: 'Deviation Management', href: '/qms/deviation', icon: AlertTriangle, description: 'Track and investigate process deviations' },
  { label: 'OOS Management', href: '/qms/oos', icon: TestTube, description: 'Out-of-specification investigation workflow' },
  { label: 'CAPA Management', href: '/qms/capa', icon: CheckSquare, description: 'Corrective and preventive action tracking' },
  { label: 'Change Control', href: '/qms/change-control', icon: RefreshCw, description: 'Controlled change request and approval' },
  { label: 'Stability Management', href: '/qms/stability', icon: LineChart, description: 'Stability study planning and monitoring' },
  { label: 'Complaint Management', href: '/qms/complaints', icon: MessageSquare, description: 'Customer complaint intake and resolution' },
  { label: 'Product Recall', href: '/qms/recall', icon: RotateCcw, description: 'Recall initiation and distribution tracking' },
  { label: 'Document Management', href: '/qms/documents/master', icon: BookOpen, description: 'Controlled documents, SOPs, and forms' },
  { label: 'Audit Management', href: '/qms/audit', icon: ClipboardList, description: 'Internal and external audit programs' },
  { label: 'Vendor Management', href: '/qms/vendors', icon: TruckIcon, description: 'Approved vendor list and qualification' },
  { label: 'Validation Management', href: '/qms/validation', icon: FileCheck, description: 'Equipment and process validation' },
  { label: 'CSV Management', href: '/qms/csv', icon: Monitor, description: 'Computer system validation lifecycle' },
  { label: 'Equipment Management', href: '/qms/equipment', icon: Wrench, description: 'Equipment qualification and maintenance' },
  { label: 'Environmental & Utility Monitoring', href: '/qms/monitoring', icon: Thermometer, description: 'Cleanroom and utility monitoring' },
  { label: 'Warehouse Management', href: '/qms/warehouse', icon: PackageSearch, description: 'Material receipt and traceability' },
  { label: 'eBMR', href: '/qms/ebmr', icon: Factory, description: 'Electronic batch manufacturing records' },
] as const;

export function QmsOverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <ShieldCheck className="h-4 w-4" />
          <span>Quality Management System</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">QMS Modules</h1>
        <p className="text-muted-foreground mt-1">
          Select a module to manage quality, compliance, and GMP operations.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {QMS_MODULES.map((mod) => (
          <Link key={mod.href} href={mod.href} className="group">
            <Card className="h-full transition-colors hover:border-blue-500/50 hover:bg-muted/30">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600 group-hover:bg-blue-600/20">
                    <mod.icon className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base leading-snug">{mod.label}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{mod.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
