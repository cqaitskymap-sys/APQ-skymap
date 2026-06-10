'use client';

import Image from 'next/image';
import type { PqrDocument, PqrApproval, PqrDataSnapshot } from '@/lib/pqr-types';

interface PqrPdfDocumentProps {
  document: PqrDocument;
  approvals: PqrApproval[];
  snapshot: PqrDataSnapshot | null;
}

export function PqrPdfDocument({ document: doc, approvals, snapshot }: PqrPdfDocumentProps) {
  const formatDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-GB') : '—';

  return (
    <article id="pqr-pdf-document" className="bg-white text-black p-8 max-w-[210mm] mx-auto text-[11px] leading-relaxed print:p-6">
      {/* Cover Header */}
      <header className="border-2 border-black mb-4">
        <div className="grid grid-cols-3 border-b border-black">
          <div className="p-3 border-r border-black flex items-center justify-center">
            {doc.company_logo_url ? (
              <Image src={doc.company_logo_url} alt="Logo" width={80} height={80} className="object-contain" unoptimized />
            ) : (
              <div className="text-center font-bold text-blue-800 text-sm">SKYMAP<br />PHARMACEUTICALS</div>
            )}
          </div>
          <div className="p-3 border-r border-black text-center col-span-1">
            <p className="font-bold text-sm uppercase">{doc.company_name}</p>
            <p className="text-[10px] mt-1">{doc.site_name || doc.address}</p>
          </div>
          <div className="p-3 text-[10px] space-y-1">
            <p><strong>Format No.:</strong> {doc.format_number || 'SOP/QA/055/F01-03'}</p>
            <p><strong>Rev. No.:</strong> {doc.revision_number}</p>
            <p><strong>Page:</strong> {doc.page_number} of ___</p>
          </div>
        </div>
        <div className="p-4 text-center bg-slate-50">
          <h1 className="text-lg font-bold uppercase tracking-wide">{doc.document_title}</h1>
          <p className="text-sm font-semibold mt-2">Product: {doc.product_name}</p>
          <p className="text-xs mt-1">PQR No.: <span className="font-mono font-bold">{doc.pqr_number}</span></p>
          <p className="text-xs mt-1">
            Review Period: {formatDate(doc.review_period_from)} to {formatDate(doc.review_period_to)}
          </p>
        </div>
      </header>

      {/* Section 1: Product Information */}
      <section className="mb-4 break-inside-avoid">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">1.0 Product Information</h2>
        <table className="w-full border border-black text-[10px]">
          <tbody>
            <tr><td className="border border-black p-1.5 w-1/3 font-semibold bg-slate-50">Product Name</td><td className="border border-black p-1.5">{doc.product_name}</td></tr>
            <tr><td className="border border-black p-1.5 font-semibold bg-slate-50">Generic Name</td><td className="border border-black p-1.5">{doc.generic_name || '—'}</td></tr>
            <tr><td className="border border-black p-1.5 font-semibold bg-slate-50">Strength / Dosage Form</td><td className="border border-black p-1.5">{doc.strength || '—'} / {doc.dosage_form || '—'}</td></tr>
            <tr><td className="border border-black p-1.5 font-semibold bg-slate-50">Product Code</td><td className="border border-black p-1.5">{doc.product_code}</td></tr>
            <tr><td className="border border-black p-1.5 font-semibold bg-slate-50">Review Year</td><td className="border border-black p-1.5">{doc.pqr_year}</td></tr>
          </tbody>
        </table>
      </section>

      {/* Section 2: Batch Manufacturing Summary */}
      <section className="mb-4 break-inside-avoid">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">2.0 Batch Manufacturing Summary</h2>
        <table className="w-full border border-black text-[10px]">
          <thead><tr className="bg-slate-100">
            {['Manufactured', 'Released', 'Rejected', 'Reworked', 'Reprocessed'].map((h) => (
              <th key={h} className="border border-black p-1.5 text-center">{h}</th>
            ))}
          </tr></thead>
          <tbody><tr>
            <td className="border border-black p-1.5 text-center font-bold">{snapshot?.batches.manufactured ?? doc.total_batches_manufactured}</td>
            <td className="border border-black p-1.5 text-center font-bold">{snapshot?.batches.released ?? doc.total_released_batches}</td>
            <td className="border border-black p-1.5 text-center font-bold">{snapshot?.batches.rejected ?? doc.total_rejected_batches}</td>
            <td className="border border-black p-1.5 text-center font-bold">{snapshot?.batches.reworked ?? doc.total_reworked_batches}</td>
            <td className="border border-black p-1.5 text-center font-bold">{snapshot?.batches.reprocessed ?? doc.total_reprocessed_batches}</td>
          </tr></tbody>
        </table>
        {snapshot?.batches.records.slice(0, 10).length ? (
          <table className="w-full border border-black text-[10px] mt-2">
            <thead><tr className="bg-slate-100">
              <th className="border border-black p-1">Batch No.</th>
              <th className="border border-black p-1">Mfg Date</th>
              <th className="border border-black p-1">Status</th>
            </tr></thead>
            <tbody>
              {snapshot.batches.records.slice(0, 10).map((b, i) => (
                <tr key={i}>
                  <td className="border border-black p-1 font-mono">{String(b.batch_number || b.batchNo || '—')}</td>
                  <td className="border border-black p-1">{formatDate(String(b.manufacturing_date || b.manufacturingDate || ''))}</td>
                  <td className="border border-black p-1">{String(b.status || b.batch_status || '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      {/* Section 3: CPP / CQA */}
      <section className="mb-4 break-inside-avoid">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">3.0 Process Performance (CPP) & Quality Attributes (CQA)</h2>
        <table className="w-full border border-black text-[10px]">
          <thead><tr className="bg-slate-100">
            <th className="border border-black p-1.5">Module</th>
            <th className="border border-black p-1.5 text-center">Total</th>
            <th className="border border-black p-1.5 text-center">Complies</th>
            <th className="border border-black p-1.5 text-center">OOT</th>
            <th className="border border-black p-1.5 text-center">OOS</th>
          </tr></thead>
          <tbody>
            <tr>
              <td className="border border-black p-1.5 font-semibold">CPP Monitoring</td>
              <td className="border border-black p-1.5 text-center">{snapshot?.cpp.total ?? 0}</td>
              <td className="border border-black p-1.5 text-center">{snapshot?.cpp.complies ?? 0}</td>
              <td className="border border-black p-1.5 text-center">{snapshot?.cpp.oot ?? 0}</td>
              <td className="border border-black p-1.5 text-center">{snapshot?.cpp.oos ?? 0}</td>
            </tr>
            <tr>
              <td className="border border-black p-1.5 font-semibold">CQA Monitoring</td>
              <td className="border border-black p-1.5 text-center">{snapshot?.cqa.total ?? 0}</td>
              <td className="border border-black p-1.5 text-center">{snapshot?.cqa.complies ?? 0}</td>
              <td className="border border-black p-1.5 text-center">{snapshot?.cqa.oot ?? 0}</td>
              <td className="border border-black p-1.5 text-center">{snapshot?.cqa.oos ?? 0}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Section 4: Quality Events */}
      <section className="mb-4 break-inside-avoid">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">4.0 Quality Events Summary</h2>
        <table className="w-full border border-black text-[10px]">
          <thead><tr className="bg-slate-100">
            <th className="border border-black p-1.5">Event Type</th>
            <th className="border border-black p-1.5 text-center">Total</th>
            <th className="border border-black p-1.5 text-center">Open</th>
            <th className="border border-black p-1.5">Summary</th>
          </tr></thead>
          <tbody>
            {[
              { label: 'Deviations', data: snapshot?.deviations },
              { label: 'OOS', data: snapshot?.oos },
              { label: 'CAPA', data: snapshot?.capa },
              { label: 'Change Control', data: snapshot?.changeControl },
            ].map((row) => (
              <tr key={row.label}>
                <td className="border border-black p-1.5 font-semibold">{row.label}</td>
                <td className="border border-black p-1.5 text-center">{row.data?.total ?? 0}</td>
                <td className="border border-black p-1.5 text-center">{row.data?.open ?? '—'}</td>
                <td className="border border-black p-1.5">{row.data?.summary ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Section 5: Stability & Materials */}
      <section className="mb-4 break-inside-avoid">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">5.0 Stability, Materials & Packaging</h2>
        <p className="border border-black p-2 mb-1"><strong>Stability:</strong> {snapshot?.stability.summary || doc.stability_status || '—'}</p>
        <p className="border border-black p-2 mb-1"><strong>Materials:</strong> {snapshot?.materials.summary || '—'}</p>
        <p className="border border-black p-2"><strong>Packaging:</strong> {snapshot?.packaging.summary || '—'}</p>
      </section>

      {/* Section 6: Observations, Conclusions, Recommendations */}
      <section className="mb-4 break-inside-avoid">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">6.0 Observations, Conclusions & Recommendations</h2>
        <div className="space-y-2">
          <div><p className="font-semibold underline mb-1">6.1 Observations</p><p className="border border-black p-2 min-h-[60px] text-justify">{doc.observations || snapshot?.autoGeneratedNarrative?.observations || '—'}</p></div>
          <div><p className="font-semibold underline mb-1">6.2 Conclusions</p><p className="border border-black p-2 min-h-[60px] text-justify">{doc.conclusions || snapshot?.autoGeneratedNarrative?.conclusions || '—'}</p></div>
          <div><p className="font-semibold underline mb-1">6.3 Recommendations</p><p className="border border-black p-2 min-h-[60px] text-justify">{doc.recommendations || snapshot?.autoGeneratedNarrative?.recommendations || '—'}</p></div>
          <p className="mt-2"><strong>Overall Compliance:</strong> {doc.overall_compliance?.replace(/_/g, ' ').toUpperCase()}</p>
        </div>
      </section>

      {/* Section 7: Approvals / E-Signatures */}
      <section className="break-inside-avoid">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">7.0 Approval Signatures</h2>
        <table className="w-full border border-black text-[10px]">
          <thead><tr className="bg-slate-100">
            <th className="border border-black p-1.5">Type</th>
            <th className="border border-black p-1.5">Designation</th>
            <th className="border border-black p-1.5">Name</th>
            <th className="border border-black p-1.5">Signature</th>
            <th className="border border-black p-1.5">Date</th>
          </tr></thead>
          <tbody>
            {approvals.map((a, i) => (
              <tr key={i}>
                <td className="border border-black p-1.5 capitalize">{a.approval_type}</td>
                <td className="border border-black p-1.5">{a.designation}</td>
                <td className="border border-black p-1.5">{a.name || '—'}</td>
                <td className="border border-black p-1.5 italic font-serif">{a.signature_text || a.esign_meaning || (a.status === 'approved' ? 'Signed electronically' : 'Pending')}</td>
                <td className="border border-black p-1.5">{formatDate(a.approval_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[9px] mt-3 text-center text-muted-foreground">
          This document is controlled. Uncontrolled when printed. Generated: {new Date().toLocaleString()} | Status: {doc.document_status.replace(/_/g, ' ').toUpperCase()}
        </p>
      </section>
    </article>
  );
}
