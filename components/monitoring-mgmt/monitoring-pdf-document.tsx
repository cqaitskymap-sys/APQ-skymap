'use client';

import type { AreaRecord, EnvironmentalRecord, UtilityRecord, ExcursionRecord } from '@/lib/monitoring-mgmt-types';

export function MonitoringPdfDocument({
  areas, environmental, utility, excursions, reportTitle = 'Monitoring Report',
}: {
  areas: AreaRecord[]; environmental: EnvironmentalRecord[]; utility: UtilityRecord[];
  excursions: ExcursionRecord[]; reportTitle?: string;
}) {
  return (
    <div className="max-w-4xl mx-auto bg-white text-black p-8 space-y-6 print:p-4" id="monitoring-report">
      <header className="border-b pb-4">
        <h1 className="text-xl font-bold">{reportTitle}</h1>
        <p className="text-sm text-gray-600">Generated {new Date().toLocaleDateString()} — GMP Environmental & Utility Monitoring</p>
      </header>
      <section>
        <h2 className="font-semibold mb-2">Area Master Register</h2>
        <table className="w-full text-xs border"><thead><tr className="bg-gray-100">
          <th className="p-1 border">Code</th><th className="p-1 border">Name</th><th className="p-1 border">Grade</th>
          <th className="p-1 border">Dept</th><th className="p-1 border">Status</th>
        </tr></thead>
          <tbody>{areas.map((a) => (
            <tr key={a.id}><td className="p-1 border font-mono">{a.area_code}</td><td className="p-1 border">{a.area_name}</td>
              <td className="p-1 border">{a.cleanroom_grade}</td><td className="p-1 border">{a.department}</td><td className="p-1 border">{a.area_status}</td></tr>
          ))}</tbody></table>
      </section>
      {environmental.length > 0 && (
        <section><h2 className="font-semibold mb-2">Environmental Monitoring</h2>
          <table className="w-full text-xs border"><thead><tr className="bg-gray-100">
            <th className="p-1 border">No</th><th className="p-1 border">Date</th><th className="p-1 border">Area</th>
            <th className="p-1 border">Type</th><th className="p-1 border">Value</th><th className="p-1 border">Status</th>
          </tr></thead>
            <tbody>{environmental.map((e) => (
              <tr key={e.id}><td className="p-1 border">{e.monitoring_number}</td><td className="p-1 border">{e.monitoring_date}</td>
                <td className="p-1 border">{e.area_name}</td><td className="p-1 border">{e.monitoring_type}</td>
                <td className="p-1 border">{e.observed_value} {e.unit}</td><td className="p-1 border">{e.status}</td></tr>
            ))}</tbody></table>
        </section>
      )}
      {utility.length > 0 && (
        <section><h2 className="font-semibold mb-2">Utility Monitoring</h2>
          <table className="w-full text-xs border"><thead><tr className="bg-gray-100">
            <th className="p-1 border">No</th><th className="p-1 border">Date</th><th className="p-1 border">Type</th>
            <th className="p-1 border">Point</th><th className="p-1 border">Value</th><th className="p-1 border">Status</th>
          </tr></thead>
            <tbody>{utility.map((u) => (
              <tr key={u.id}><td className="p-1 border">{u.utility_record_no}</td><td className="p-1 border">{u.monitoring_date}</td>
                <td className="p-1 border">{u.utility_type}</td><td className="p-1 border">{u.sampling_point}</td>
                <td className="p-1 border">{u.observed_value} {u.unit}</td><td className="p-1 border">{u.status}</td></tr>
            ))}</tbody></table>
        </section>
      )}
      {excursions.length > 0 && (
        <section><h2 className="font-semibold mb-2">Excursions</h2>
          <table className="w-full text-xs border"><thead><tr className="bg-gray-100">
            <th className="p-1 border">No</th><th className="p-1 border">Date</th><th className="p-1 border">Area</th>
            <th className="p-1 border">Parameter</th><th className="p-1 border">Status</th>
          </tr></thead>
            <tbody>{excursions.map((x) => (
              <tr key={x.id}><td className="p-1 border">{x.excursion_number}</td><td className="p-1 border">{x.excursion_date}</td>
                <td className="p-1 border">{x.area_name}</td><td className="p-1 border">{x.parameter_name}</td><td className="p-1 border">{x.status}</td></tr>
            ))}</tbody></table>
        </section>
      )}
    </div>
  );
}
