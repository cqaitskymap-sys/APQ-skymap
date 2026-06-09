'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Package,
  ClipboardList,
  TrendingUp,
  Users,
  BarChart3,
  FileText,
} from 'lucide-react';

export default function PackagingDashboardPage() {
  const modules = [
    {
      id: 'material-master',
      title: 'Packaging Material Master',
      description: 'Manage primary, secondary, and tertiary packaging materials with specifications',
      icon: Package,
      href: '/dashboard/packaging/material-master',
      color: 'bg-blue-100 text-blue-600',
      stats: {
        label: 'Materials',
        value: 'View Master',
      },
    },
    {
      id: 'reviews',
      title: 'Packaging Reviews',
      description: 'Track and manage packaging material lots with auto-reconciliation engine',
      icon: ClipboardList,
      href: '/dashboard/packaging/reviews',
      color: 'bg-purple-100 text-purple-600',
      stats: {
        label: 'Reviews',
        value: 'Track Lots',
      },
    },
    {
      id: 'vendor-review',
      title: 'Vendor Performance',
      description: 'Monitor vendor compliance, approval rates, and risk categorization',
      icon: Users,
      href: '/dashboard/packaging/vendor-review',
      color: 'bg-green-100 text-green-600',
      stats: {
        label: 'Vendors',
        value: 'View Metrics',
      },
    },
    {
      id: 'analytics',
      title: 'Analytics Dashboard',
      description: 'Comprehensive analysis of packaging usage, trends, and compliance',
      icon: BarChart3,
      href: '/dashboard/packaging/analytics',
      color: 'bg-orange-100 text-orange-600',
      stats: {
        label: 'Analytics',
        value: 'View Charts',
      },
    },
  ];

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900">Packaging Material Review Module</h1>
        <p className="text-gray-600 mt-2 text-lg">
          Complete management of primary, secondary, and tertiary packaging materials for pharmaceutical manufacturing
        </p>
      </div>

      {/* Key Features */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
        <CardHeader>
          <CardTitle>Key Features</CardTitle>
          <CardDescription>Comprehensive packaging material management system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex gap-3">
              <div className="text-2xl">✓</div>
              <div>
                <p className="font-semibold text-gray-900">Auto-Reconciliation</p>
                <p className="text-sm text-gray-600">Automatic balance calculation and mismatch detection</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="text-2xl">✓</div>
              <div>
                <p className="font-semibold text-gray-900">Compliance Engine</p>
                <p className="text-sm text-gray-600">Auto-check vendor, QC, COA, expiry, and reconciliation</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="text-2xl">✓</div>
              <div>
                <p className="font-semibold text-gray-900">Vendor Performance</p>
                <p className="text-sm text-gray-600">Track approval %, rejection %, and risk categorization</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="text-2xl">✓</div>
              <div>
                <p className="font-semibold text-gray-900">Analytics Dashboard</p>
                <p className="text-sm text-gray-600">Trends, usage patterns, and performance analysis</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="text-2xl">✓</div>
              <div>
                <p className="font-semibold text-gray-900">Audit Trail</p>
                <p className="text-sm text-gray-600">Track all changes, approvals, and compliance updates</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="text-2xl">✓</div>
              <div>
                <p className="font-semibold text-gray-900">Role-Based Access</p>
                <p className="text-sm text-gray-600">QA, QC, Warehouse, Production, Auditor roles</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Module Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Link key={module.id} href={module.href}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <div className={`p-2 rounded ${module.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        {module.title}
                      </CardTitle>
                      <CardDescription className="mt-2">{module.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-gray-500">{module.stats.label}</p>
                      <p className="text-sm font-semibold text-gray-900">{module.stats.value}</p>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2">
                      Open <span className="text-lg">→</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Documentation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" /> Documentation
          </CardTitle>
          <CardDescription>Complete guides and instructions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Getting Started</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Initialize default packaging materials</li>
                <li>• Create packaging review entries</li>
                <li>• Auto-reconciliation explanation</li>
                <li>• Compliance rules overview</li>
              </ul>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Operations</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Material Master CRUD</li>
                <li>• Batch review tracking</li>
                <li>• Vendor performance analysis</li>
                <li>• Export reports</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Material Types Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Primary Packaging</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-2">
            <p>Direct contact with product</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Glass Vials</li>
              <li>Rubber Stoppers</li>
              <li>Flip-Off Seals</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Secondary Packaging</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-2">
            <p>Holds primary packaging</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Labels</li>
              <li>Cartons</li>
              <li>Package Inserts</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tertiary Packaging</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-2">
            <p>Distribution packaging</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Shipper Boxes</li>
              <li>PVC Films</li>
              <li>Tapes</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Rules Engine</CardTitle>
          <CardDescription>Automatic compliance determination</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 p-4 rounded-lg space-y-2 text-sm">
            <p className="font-semibold text-gray-900">Material is Compliant if ALL conditions are met:</p>
            <ul className="space-y-1 text-gray-700">
              <li>✓ Vendor is Approved on AVL</li>
              <li>✓ QC Status is Approved</li>
              <li>✓ COA is Available</li>
              <li>✓ Material has not Expired</li>
              <li>✓ Reconciliation is Matched (Balance = 0)</li>
            </ul>
            <div className="mt-4 p-3 bg-red-50 rounded border border-red-200">
              <p className="text-red-700">
                ✗ If ANY condition fails, material is marked as Non-Compliant
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reconciliation Logic */}
      <Card>
        <CardHeader>
          <CardTitle>Auto-Reconciliation Logic</CardTitle>
          <CardDescription>Automatic balance calculation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="font-semibold text-gray-900 mb-2">Balance Calculation:</p>
              <div className="space-y-1 text-sm font-mono bg-white p-3 rounded border">
                <p>Balance Qty = Received Qty</p>
                <p>            - Used Qty</p>
                <p>            - Rejected Qty</p>
                <p>            - Returned Qty</p>
                <p className="mt-2 pt-2 border-t">
                  If Balance = 0 → <span className="text-green-600 font-bold">MATCHED ✓</span>
                </p>
                <p>
                  If Balance ≠ 0 → <span className="text-red-600 font-bold">MISMATCH ⚠️</span>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Categorization */}
      <Card>
        <CardHeader>
          <CardTitle>Vendor Risk Categorization</CardTitle>
          <CardDescription>Based on rejection percentage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded">
              <div className="w-3 h-3 rounded-full bg-green-600"></div>
              <div>
                <p className="font-semibold text-gray-900">Low Risk: 0-2% rejection</p>
                <p className="text-sm text-gray-600">Reliable vendor, continue ordering</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded">
              <div className="w-3 h-3 rounded-full bg-yellow-600"></div>
              <div>
                <p className="font-semibold text-gray-900">Medium Risk: 2-5% rejection</p>
                <p className="text-sm text-gray-600">Monitor closely, discuss improvement</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded">
              <div className="w-3 h-3 rounded-full bg-red-600"></div>
              <div>
                <p className="font-semibold text-gray-900">High Risk: &gt;5% rejection</p>
                <p className="text-sm text-gray-600">Review relationship, consider alternatives</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Module Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold text-blue-600">9</p>
              <p className="text-sm text-gray-600">Default Materials</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-purple-600">3</p>
              <p className="text-sm text-gray-600">Material Types</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-green-600">∞</p>
              <p className="text-sm text-gray-600">Custom Materials</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-orange-600">5</p>
              <p className="text-sm text-gray-600">Compliance Checks</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
