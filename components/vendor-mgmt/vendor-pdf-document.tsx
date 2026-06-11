'use client';

import type { VendorRecord, AvlRecord, VendorQualification, SupplierAuditRecord, VendorPerformance } from '@/lib/vendor-mgmt-types';

export function VendorPdfDocument({
  vendor, avl, qualifications, audits, performance,
}: {
  vendor: VendorRecord;
  avl: AvlRecord[];
  qualifications: VendorQualification[];
  audits: SupplierAuditRecord[];
  performance: VendorPerformance[];
}) {
  return (
    <div className="max-w-4xl mx-auto bg-white text-black p-8 space-y-6 print:p-4" id="vendor-report">
      <header className="border-b pb-4">
        <h1 className="text-xl font-bold">Vendor Qualification Report</h1>
        <p className="text-sm text-gray-600">Generated {new Date().toLocaleDateString()}</p>
      </header>
      <section>
        <h2 className="font-semibold mb-2">Vendor Master</h2>
        <table className="w-full text-sm border-collapse">
          <tbody>
            {[['Code', vendor.vendor_code], ['Name', vendor.vendor_name], ['Type', vendor.vendor_type],
              ['Material/Service', vendor.material_service_supplied], ['Approval', vendor.approval_status],
              ['Risk', vendor.risk_category], ['Contact', vendor.contact_person], ['Email', vendor.email]].map(([k, v]) => (
              <tr key={k} className="border-b"><td className="py-1 pr-4 font-medium w-40">{k}</td><td>{v}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      {avl.length > 0 && (
        <section><h2 className="font-semibold mb-2">Approved Vendor List</h2>
          <table className="w-full text-xs border"><thead><tr className="bg-gray-100"><th className="p-1 border">AVL #</th><th className="p-1 border">Material</th><th className="p-1 border">Expiry</th><th className="p-1 border">Status</th></tr></thead>
            <tbody>{avl.map((a) => <tr key={a.id}><td className="p-1 border">{a.avl_number}</td><td className="p-1 border">{a.material_service}</td><td className="p-1 border">{a.approval_expiry_date}</td><td className="p-1 border">{a.status}</td></tr>)}</tbody></table>
        </section>
      )}
      {qualifications.length > 0 && (
        <section><h2 className="font-semibold mb-2">Qualifications</h2>
          <table className="w-full text-xs border"><thead><tr className="bg-gray-100"><th className="p-1 border">Number</th><th className="p-1 border">Type</th><th className="p-1 border">Decision</th></tr></thead>
            <tbody>{qualifications.map((q) => <tr key={q.id}><td className="p-1 border">{q.qualification_number}</td><td className="p-1 border">{q.qualification_type}</td><td className="p-1 border">{q.qualification_decision}</td></tr>)}</tbody></table>
        </section>
      )}
      {audits.length > 0 && (
        <section><h2 className="font-semibold mb-2">Supplier Audits</h2>
          <table className="w-full text-xs border"><thead><tr className="bg-gray-100"><th className="p-1 border">Audit #</th><th className="p-1 border">Date</th><th className="p-1 border">Rating</th></tr></thead>
            <tbody>{audits.map((a) => <tr key={a.id}><td className="p-1 border">{a.audit_number}</td><td className="p-1 border">{a.audit_date}</td><td className="p-1 border">{a.final_audit_rating}</td></tr>)}</tbody></table>
        </section>
      )}
      {performance.length > 0 && (
        <section><h2 className="font-semibold mb-2">Performance</h2>
          <table className="w-full text-xs border"><thead><tr className="bg-gray-100"><th className="p-1 border">Period</th><th className="p-1 border">Score</th><th className="p-1 border">Rating</th></tr></thead>
            <tbody>{performance.map((p) => <tr key={p.id}><td className="p-1 border">{p.review_period}</td><td className="p-1 border">{p.performance_score}%</td><td className="p-1 border">{p.performance_rating}</td></tr>)}</tbody></table>
        </section>
      )}
    </div>
  );
}
