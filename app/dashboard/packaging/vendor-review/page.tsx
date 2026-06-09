'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import {
  getPackagingVendorReviews,
  getPackagingReviews,
  calculateVendorMetrics,
  updatePackagingVendorReview,
  PackagingVendorReview,
  PackagingReview,
  syncPackagingVendorReviews,
} from '@/lib/packaging-service';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function VendorReviewPage() {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<PackagingVendorReview[]>([]);
  const [reviews, setReviews] = useState<PackagingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      if (user?.uid) {
        await syncPackagingVendorReviews(user.uid);
      }
      const [vendorsData, reviewsData] = await Promise.all([
        getPackagingVendorReviews(),
        getPackagingReviews(),
      ]);
      setVendors(vendorsData);
      setReviews(reviewsData);
      setError('');
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load vendor reviews');
    } finally {
      setLoading(false);
    }
  }

  async function handleRecalculate(vendorName: string) {
    try {
      if (!user?.uid) throw new Error('User not authenticated');
      const metrics = await calculateVendorMetrics(vendorName);
      const vendor = vendors.find((v) => v.vendorName === vendorName);
      if (vendor) {
        await updatePackagingVendorReview(
          vendor.id,
          metrics,
          user.uid
        );
        await fetchData();
      }
    } catch (err) {
      console.error('Error recalculating metrics:', err);
      setError('Failed to recalculate metrics');
    }
  }

  // Prepare chart data
  const vendorPerformanceData = vendors.map((v) => ({
    name: v.vendorName,
    approval: v.approvalPercentage,
    rejection: v.rejectionPercentage,
  }));

  const complaintData = vendors.map((v) => ({
    name: v.vendorName,
    complaints: v.complaintCount,
  }));

  const riskDistribution = [
    { name: 'Low Risk', value: vendors.filter((v) => v.riskCategory === 'Low').length },
    { name: 'Medium Risk', value: vendors.filter((v) => v.riskCategory === 'Medium').length },
    { name: 'High Risk', value: vendors.filter((v) => v.riskCategory === 'High').length },
  ];

  const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

  const lotsData = vendors.map((v) => ({
    name: v.vendorName,
    received: v.totalLotsReceived,
    approved: v.totalLotsApproved,
    rejected: v.totalLotsRejected,
  }));

  const rejectionTrendData = vendors
    .sort((a, b) => a.rejectionPercentage - b.rejectionPercentage)
    .map((v) => ({
      name: v.vendorName.substring(0, 10),
      rejectionRate: parseFloat(v.rejectionPercentage.toFixed(2)),
    }));

  // Statistics
  const totalVendors = vendors.length;
  const avgApprovalRate =
    vendors.length > 0
      ? vendors.reduce((sum, v) => sum + v.approvalPercentage, 0) / vendors.length
      : 0;
  const avgRejectionRate =
    vendors.length > 0
      ? vendors.reduce((sum, v) => sum + v.rejectionPercentage, 0) / vendors.length
      : 0;
  const totalComplaints = vendors.reduce((sum, v) => sum + v.complaintCount, 0);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Packaging Vendor Review</h1>
        <p className="text-gray-600 mt-1">Monitor vendor performance, compliance, and risk metrics</p>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Vendors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalVendors}</div>
            <p className="text-xs text-gray-500 mt-1">Active packaging vendors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Approval Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {avgApprovalRate.toFixed(1)}%
            </div>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Industry standard
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Rejection Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {avgRejectionRate.toFixed(1)}%
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {avgRejectionRate > 5 ? '⚠️ Above threshold' : '✓ Within limits'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Complaints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{totalComplaints}</div>
            <p className="text-xs text-gray-500 mt-1">Across all vendors</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vendor Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Vendor Performance Rate</CardTitle>
            <CardDescription>Approval vs Rejection % by vendor</CardDescription>
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
                  <Bar dataKey="approval" fill="#10b981" name="Approval %" />
                  <Bar dataKey="rejection" fill="#ef4444" name="Rejection %" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center py-8 text-gray-500">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* Risk Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Vendor Risk Distribution</CardTitle>
            <CardDescription>Categorization by risk level</CardDescription>
          </CardHeader>
          <CardContent>
            {riskDistribution.some((d) => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={riskDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name} (${value})`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {COLORS.map((color, index) => (
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

        {/* Lots Received, Approved, Rejected */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Lots Summary by Vendor</CardTitle>
            <CardDescription>Received, Approved, and Rejected lots</CardDescription>
          </CardHeader>
          <CardContent>
            {lotsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={lotsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="received" fill="#3b82f6" name="Received" />
                  <Bar dataKey="approved" fill="#10b981" name="Approved" />
                  <Bar dataKey="rejected" fill="#ef4444" name="Rejected" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center py-8 text-gray-500">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* Rejection Trend */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Rejection Rate Trend</CardTitle>
            <CardDescription>Vendors ranked by rejection rate</CardDescription>
          </CardHeader>
          <CardContent>
            {rejectionTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={rejectionTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="rejectionRate"
                    stroke="#ef4444"
                    name="Rejection Rate %"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center py-8 text-gray-500">No data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Vendors Table */}
      <Card>
        <CardHeader>
          <CardTitle>Vendor Details</CardTitle>
          <CardDescription>Complete vendor performance metrics and risk assessment</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading vendors...</div>
          ) : vendors.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No vendors found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor Name</TableHead>
                    <TableHead>Materials Supplied</TableHead>
                    <TableHead className="text-center">Total Lots</TableHead>
                    <TableHead className="text-center">Approved</TableHead>
                    <TableHead className="text-center">Rejected</TableHead>
                    <TableHead>Approval %</TableHead>
                    <TableHead>Rejection %</TableHead>
                    <TableHead className="text-center">Complaints</TableHead>
                    <TableHead>Risk Category</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell className="font-medium">{vendor.vendorName}</TableCell>
                      <TableCell className="text-sm">
                        {vendor.materialSupplied.slice(0, 2).join(', ')}
                        {vendor.materialSupplied.length > 2 && ` +${vendor.materialSupplied.length - 2}`}
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {vendor.totalLotsReceived}
                      </TableCell>
                      <TableCell className="text-center text-green-600 font-semibold">
                        {vendor.totalLotsApproved}
                      </TableCell>
                      <TableCell className="text-center text-red-600 font-semibold">
                        {vendor.totalLotsRejected}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded h-2">
                            <div
                              className="bg-green-600 h-2 rounded"
                              style={{ width: `${vendor.approvalPercentage}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold">
                            {vendor.approvalPercentage.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded h-2">
                            <div
                              className="bg-red-600 h-2 rounded"
                              style={{ width: `${vendor.rejectionPercentage}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold">
                            {vendor.rejectionPercentage.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={vendor.complaintCount > 0 ? 'destructive' : 'secondary'}>
                          {vendor.complaintCount}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            vendor.riskCategory === 'Low'
                              ? 'default'
                              : vendor.riskCategory === 'Medium'
                              ? 'secondary'
                              : 'destructive'
                          }
                        >
                          {vendor.riskCategory} Risk
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRecalculate(vendor.vendorName)}
                        >
                          Recalculate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risk Logic Info */}
      <Card className="bg-blue-50">
        <CardHeader>
          <CardTitle className="text-sm">Risk Categorization Logic</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            <Badge className="mr-2">Low Risk</Badge>0-2% rejection rate
          </p>
          <p>
            <Badge className="mr-2" variant="secondary">Medium Risk</Badge>2-5% rejection rate
          </p>
          <p>
            <Badge className="mr-2" variant="destructive">High Risk</Badge>&gt;5% rejection rate
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
