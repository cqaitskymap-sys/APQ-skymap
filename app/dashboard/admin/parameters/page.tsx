'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { ADMIN_COLLECTIONS, RECORD_STATUSES, PARAMETER_TYPES, RESULT_TYPES } from '@/lib/admin/constants';
import { parameterSchema } from '@/lib/admin/schemas';

export default function ParametersPage() {
  return (
    <MasterCrudPage
      title="Parameter Master"
      description="Configure CPP and CQA parameters for Continued Process Verification"
      collection={ADMIN_COLLECTIONS.parameters}
      module="CPV"
      schema={parameterSchema}
      defaultValues={{
        parameterCode: '', parameterName: '', parameterType: 'CPP', product: '',
        processStage: '', lsl: '', usl: '', target: '', unit: '', frequency: '',
        criticality: '', resultType: 'Numeric', status: 'Active',
      }}
      uniqueFields={[{ field: 'parameterCode', label: 'Parameter Code' }]}
      fields={[
        { name: 'parameterCode', label: 'Parameter Code', required: true },
        { name: 'parameterName', label: 'Parameter Name', required: true },
        { name: 'parameterType', label: 'Parameter Type', type: 'select', required: true, options: PARAMETER_TYPES.map((t) => ({ label: t, value: t })) },
        { name: 'product', label: 'Product' },
        { name: 'processStage', label: 'Process Stage' },
        { name: 'lsl', label: 'LSL' },
        { name: 'usl', label: 'USL' },
        { name: 'target', label: 'Target' },
        { name: 'unit', label: 'Unit' },
        { name: 'frequency', label: 'Frequency' },
        { name: 'criticality', label: 'Criticality' },
        { name: 'resultType', label: 'Result Type', type: 'select', options: RESULT_TYPES.map((t) => ({ label: t, value: t })) },
        { name: 'status', label: 'Status', type: 'select', options: RECORD_STATUSES.map((s) => ({ label: s, value: s })) },
      ]}
      columns={[
        { key: 'parameterCode', header: 'Code' },
        { key: 'parameterName', header: 'Name' },
        { key: 'parameterType', header: 'Type' },
        { key: 'product', header: 'Product' },
        { key: 'processStage', header: 'Stage' },
        { key: 'unit', header: 'Unit' },
        { key: 'resultType', header: 'Result Type' },
        { key: 'status', header: 'Status' },
      ]}
    />
  );
}
