'use client';

import type {
  MaterialReceipt, InventoryStock, MaterialDispensing, FinishedGoods, TraceabilityRecord,
} from '@/lib/warehouse-mgmt-types';

export function WarehousePdfDocument({
  receipts, inventory, dispensing, finishedGoods, reportTitle = 'Warehouse Report',
}: {
  receipts: MaterialReceipt[]; inventory: InventoryStock[];
  dispensing: MaterialDispensing[]; finishedGoods: FinishedGoods[];
  reportTitle?: string;
}) {
  return (
    <div className="max-w-4xl mx-auto bg-white text-black p-8 space-y-6 print:p-4" id="warehouse-report">
      <header className="border-b pb-4">
        <h1 className="text-xl font-bold">{reportTitle}</h1>
        <p className="text-sm text-gray-600">Generated {new Date().toLocaleDateString()} — GMP Warehouse & Traceability</p>
      </header>
      {receipts.length > 0 && (
        <section><h2 className="font-semibold mb-2">Material Receipt Register</h2>
          <table className="w-full text-xs border"><thead><tr className="bg-gray-100">
            <th className="p-1 border">GRN</th><th className="p-1 border">Date</th><th className="p-1 border">Material</th>
            <th className="p-1 border">Vendor</th><th className="p-1 border">AR No</th><th className="p-1 border">Status</th>
          </tr></thead>
            <tbody>{receipts.map((r) => (
              <tr key={r.id}><td className="p-1 border">{r.grn_number}</td><td className="p-1 border">{r.receipt_date}</td>
                <td className="p-1 border">{r.material_name}</td><td className="p-1 border">{r.vendor_name}</td>
                <td className="p-1 border">{r.ar_number}</td><td className="p-1 border">{r.status}</td></tr>
            ))}</tbody></table>
        </section>
      )}
      {inventory.length > 0 && (
        <section><h2 className="font-semibold mb-2">Inventory Report</h2>
          <table className="w-full text-xs border"><thead><tr className="bg-gray-100">
            <th className="p-1 border">Material</th><th className="p-1 border">AR</th><th className="p-1 border">Available</th>
            <th className="p-1 border">Location</th><th className="p-1 border">Expiry</th>
          </tr></thead>
            <tbody>{inventory.map((i) => (
              <tr key={i.id}><td className="p-1 border">{i.material_name}</td><td className="p-1 border">{i.ar_number}</td>
                <td className="p-1 border">{i.available_quantity}</td><td className="p-1 border">{i.storage_location}</td>
                <td className="p-1 border">{i.expiry_status}</td></tr>
            ))}</tbody></table>
        </section>
      )}
      {dispensing.length > 0 && (
        <section><h2 className="font-semibold mb-2">Dispensing Sheet</h2>
          <table className="w-full text-xs border"><thead><tr className="bg-gray-100">
            <th className="p-1 border">No</th><th className="p-1 border">Product</th><th className="p-1 border">Batch</th>
            <th className="p-1 border">Material</th><th className="p-1 border">Qty</th>
          </tr></thead>
            <tbody>{dispensing.map((d) => (
              <tr key={d.id}><td className="p-1 border">{d.dispensing_number}</td><td className="p-1 border">{d.product_name}</td>
                <td className="p-1 border">{d.batch_number}</td><td className="p-1 border">{d.material_name}</td>
                <td className="p-1 border">{d.dispensed_quantity}</td></tr>
            ))}</tbody></table>
        </section>
      )}
    </div>
  );
}

export function TraceabilityReport({ records }: { records: TraceabilityRecord[] }) {
  return (
    <div className="space-y-4">
      {records.map((t) => (
        <div key={t.id} className="border rounded-lg p-4">
          <h3 className="font-semibold">{t.material_name} — AR {t.ar_number} / Lot {t.lot_number}</h3>
          <p className="text-sm text-muted-foreground">GRN: {t.grn_number} | Vendor: {t.vendor_name}</p>
          {t.production_batch && <p className="text-sm">Production Batch: {t.production_batch}</p>}
          {t.fg_batch_number && <p className="text-sm">FG Batch: {t.fg_batch_number}</p>}
          {t.dispatch_ref && <p className="text-sm">Dispatch: {t.dispatch_ref}</p>}
          <table className="w-full text-xs border mt-2"><thead><tr className="bg-gray-100">
            <th className="p-1 border">Step</th><th className="p-1 border">Ref</th><th className="p-1 border">Date</th><th className="p-1 border">Qty</th>
          </tr></thead>
            <tbody>{(t.chain || []).map((c, i) => (
              <tr key={i}><td className="p-1 border">{c.step}</td><td className="p-1 border">{c.ref_no}</td>
                <td className="p-1 border">{c.date}</td><td className="p-1 border">{c.quantity}</td></tr>
            ))}</tbody></table>
        </div>
      ))}
    </div>
  );
}
