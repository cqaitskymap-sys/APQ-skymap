'use client';

import type { EsignRecord } from '@/lib/admin/schemas';

interface ESignaturePdfBlockProps {
  signatures: EsignRecord[];
  title?: string;
}

export function ESignaturePdfBlock({ signatures, title = 'Electronic Signatures' }: ESignaturePdfBlockProps) {
  if (!signatures.length) return null;

  return (
    <div className="mt-6 border rounded-lg overflow-hidden">
      <div className="bg-slate-100 px-4 py-2 font-semibold text-sm text-slate-800 border-b">
        {title}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 border-b">
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">Role</th>
            <th className="p-2 text-left">Department</th>
            <th className="p-2 text-left">Meaning</th>
            <th className="p-2 text-left">Date Time</th>
            <th className="p-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {signatures.map((sig) => (
            <tr key={sig.id || sig.esignRecordId} className="border-b last:border-0">
              <td className="p-2">{sig.userName}</td>
              <td className="p-2">{sig.userRole}</td>
              <td className="p-2">{sig.department}</td>
              <td className="p-2">{sig.signatureMeaning}</td>
              <td className="p-2">{new Date(sig.signedDateTime).toLocaleString()}</td>
              <td className="p-2">{sig.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
