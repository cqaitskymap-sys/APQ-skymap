'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  getPackagingReviews,
  getPackagingMaterials,
  getPackagingVendorReviews,
  getPackagingAnalytics,
  PackagingReview,
  PackagingMaterial,
  PackagingVendorReview,
} from '@/lib/packaging-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function PackagingAnalyticsPage() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<PackagingReview[]>([]);
  const [materials, setMaterials] = useState<PackagingMaterial[]>([]);
  const [vendors, setVendors] = useState<PackagingVendorReview[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [reviewsData, materialsData, vendorsData, analyticsData] = await Promise.all([
        getPackagingReviews(),
        getPackagingMaterials(),
        getPackagingVendorReviews(),
        getPackagingAnalytics(),
      ]);
      setReviews(reviewsData);
      setMaterials(materialsData);
      setVendors(vendorsData);
      setAnalytics(analyticsData);
      setError('');
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }

  // Prepare chart data
  const complianceData = [
    {
      name: 'Compliant',
      value: analytics?.compliantLots || 0,
      percentage: ((analytics?.compliantLots || 0) / (analytics?.totalLots || 1) * 100).toFixed(1),
    },
    {
      name: 'Non-Compliant',
      value: analytics?.nonCompliantLots || 0,
      percentage: ((analytics?.nonCompliantLots || 0) / (analytics?.totalLots || 1) * 100).toFixed(1),
    },
    {
      name: 'Pending',
      value: (analytics?.totalLots || 0) - (analytics?.compliantLots || 0) - (analytics?.nonCompliantLots || 0),
      percentage: (((analytics?.totalLots || 0) - (analytics?.compliantLots || 0) - (analytics?.nonCompliantLots || 0)) / (analytics?.totalLots || 1) * 100).toFixed(1),
    },
  ];

  const reconciliationData = [
    {
      name: 'Matched',
      value: analytics?.matchedReconciliation || 0,
      percentage: ((analytics?.matchedReconciliation || 0) / (analytics?.totalLots || 1) * 100).toFixed(1),
    },
    {
      name: 'Mismatch',
      value: analytics?.mismatchReconciliation || 0,
      percentage: ((analytics?.mismatchReconciliation || 0) / (analytics?.totalLots || 1) * 100).toFixed(1),
    },
  ];

  const materialTypeData = materials.reduce((acc: any, m) => {
    const existing = acc.find((a: any) => a.type === m.materialType);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ type: m.materialType, count: 1 });
    }
    return acc;
  }, []);

  // Material usage trend (by material type)
  const usageByMaterialType = materialTypeData.map((m: any) => ({
    name: m.type,
    usage: reviews.filter((r) => r.materialType === m.type).reduce((sum, r) => sum + r.quantityUsed, 0),
    received: reviews.filter((r) => r.materialType === m.type).reduce((sum, r) => sum + r.quantityReceived, 0),
  }));

  // Vendor performance trend
  const vendorPerformanceData = vendors.map((v) => ({
    name: v.vendorName.substring(0, 15),
    approvalRate: parseFloat(v.approvalPercentage.toFixed(1)),
    rejectionRate: parseFloat(v.rejectionPercentage.toFixed(1)),
  }));

  // Approval trend over time (simulated - you can enhance with date grouping)
  const approvalTrendData = reviews
    .slice(-10)
    .map((r, i) => ({
      batch: `Batch ${i + 1}`,
      compliant: r.complianceStatus === 'Compliant' ? 1 : 0,
      nonCompliant: r.complianceStatus === 'Non-Compliant' ? 1 : 0,
      pending: r.complianceStatus === 'Pending' ? 1 : 0,
    }));

  // Rejection trend
  const rejectionTrendData = reviews
    .slice(-15)
    .map((r, i) => ({
      batch: `Lot ${i + 1}`,
      rejections: r.quantityRejected,
    }));

  const COLORS = ['#10b981', '#ef4444', '#f59e0b'];
  const COMPLIANCE_COLORS = ['#10b981', '#ef4444', '#3b82f6'];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Packaging Analytics Dashboard</h1>
        <p className="text-gray-600 mt-1">Comprehensive analysis of packaging material usage, compliance, and trends</p>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading analytics...</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Packaging Lots</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{analytics?.totalLots || 0}</div>
                <p className="text-xs text-gray-500 mt-1">All materials tracked</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Approved Lots</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{analytics?.approvedLots || 0}</div>
                <p className="text-xs text-gray-500 mt-1">
                  {((analytics?.approvedLots || 0) / (analytics?.totalLots || 1) * 100).toFixed(1)}% approval rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Rejected Lots</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">{analytics?.rejectedLots || 0}</div>
                <p className="text-xs text-gray-500 mt-1">
                  {((analytics?.rejectedLots || 0) / (analytics?.totalLots || 1) * 100).toFixed(1)}% rejection rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Reconciliation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {analytics?.reconciliationComplianceRate?.toFixed(1)}%
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {analytics?.matchedReconciliation || 0} matched / {analytics?.totalLots || 0} total
                </p>
              </CardContent>
            </Card>
          </div>

          {/* More Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Vendor Count</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{analytics?.vendorCount || 0}</div>
                <p className="text-xs text-gray-500 mt-1">Active packaging vendors</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Material Count</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{analytics?.materialCount || 0}</div>
                <p className="text-xs text-gray-500 mt-1">Total materials in master</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Pending Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-600">{analytics?.pendingLots || 0}</div>
                <p className="text-xs text-gray-500 mt-1">Awaiting approval</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Compliance Status */}
            <Card>
              <CardHeader>
                <CardTitle>Compliance Status Distribution</CardTitle>
                <CardDescription>All packaging lots categorized by compliance</CardDescription>
              </CardHeader>
              <CardContent>
                {complianceData.some((d) => d.value > 0) ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={complianceData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percentage }) => `${name} (${percentage}%)`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {COMPLIANCE_COLORS.map((color, index) => (
                          <Cell key={`cell-${index}`} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center py-8 text-gray-500">No data available</p>
                )}
              </CardContent>
            </Card>

            {/* Reconciliation Status */}
            <Card>
              <CardHeader>
                <CardTitle>Reconciliation Status</CardTitle>
                <CardDescription>Matched vs Mismatch quantities</CardDescription>
              </CardHeader>
              <CardContent>
                {reconciliationData.some((d) => d.value > 0) ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={reconciliationData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percentage }) => `${name} (${percentage}%)`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center py-8 text-gray-500">No data available</p>
                )}
              </CardContent>
            </Card>

            {/* Material Usage by Type */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Material Usage Trend</CardTitle>
                <CardDescription>Quantity received vs used by material type</CardDescription>
              </CardHeader>
              <CardContent>
                {usageByMaterialType.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={usageByMaterialType}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="received" fill="#3b82f6" name="Received Qty" />
                      <Bar dataKey="usage" fill="#10b981" name="Used Qty" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center py-8 text-gray-500">No data available</p>
                )}
              </CardContent>
            </Card>

            {/* Vendor Performance */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Vendor Performance Analysis</CardTitle>
                <CardDescription>Approval vs Rejection rates by vendor</CardDescription>
              </CardHeader>
              <CardContent>
                {vendorPerformanceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={vendorPerformanceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="approvalRate" fill="#10b981" name="Approval %" />
                      <Bar dataKey="rejectionRate" fill="#ef4444" name="Rejection %" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center py-8 text-gray-500">No data available</p>
                )}
              </CardContent>
            </Card>

            {/* Approval Trend */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Approval Trend (Recent Lots)</CardTitle>
                <CardDescription>Compliance status progression</CardDescription>
              </CardHeader>
              <CardContent>
                {approvalTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={approvalTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="batch" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="compliant" stackId="1" fill="#10b981" name="Compliant" />
                      <Area type="monotone" dataKey="nonCompliant" stackId="1" fill="#ef4444" name="Non-Compliant" />
                      <Area type="monotone" dataKey="pending" stackId="1" fill="#3b82f6" name="Pending" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center py-8 text-gray-500">No data available</p>
                )}
              </CardContent>
            </Card>

            {/* Rejection Trend */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Rejection Quantity Trend</CardTitle>
                <CardDescription>Recent rejection history (last 15 lots)</CardDescription>
              </CardHeader>
              <CardContent>
                {rejectionTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={rejectionTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="batch" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="rejections"
                        stroke="#ef4444"
                        strokeWidth={2}
                        name="Rejected Qty"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center py-8 text-gray-500">No data available</p>
                )}
              </CardContent>
            </Card>

            {/* Material Type Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Material Type Distribution</CardTitle>
                <CardDescription>Count of materials by type</CardDescription>
              </CardHeader>
              <CardContent>
                {materialTypeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={materialTypeData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="type" type="category" width={120} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8b5cf6" name="Count" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center py-8 text-gray-500">No data available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
