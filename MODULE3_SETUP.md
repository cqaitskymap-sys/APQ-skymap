#!/bin/bash
# Module 3 Implementation Completion Script
# This script helps initialize the Pharma PQR Material Review Module

echo "=========================================="
echo "Module 3: API & Raw Material Review"
echo "Implementation Completion"
echo "=========================================="
echo ""

# Created files summary
echo "✓ Core Libraries Created:"
echo "  - lib/material-schemas.ts (Zod schemas for all entities)"
echo "  - lib/compliance-logic.ts (Auto-compliance calculation)"
echo "  - lib/material-service.ts (Supabase CRUD operations)"
echo ""

echo "✓ UI Components Created:"
echo "  - components/materials/compliance-summary-cards.tsx"
echo "  - components/materials/material-review-table.tsx"
echo ""

echo "✓ Pages Created/Updated:"
echo "  - app/dashboard/pqr/[id]/materials/page.tsx (List with summary)"
echo "  - app/dashboard/pqr/[id]/materials/create/page.tsx (Create/Edit)"
echo "  - app/dashboard/master/materials/page.tsx (Master list)"
echo ""

echo "=========================================="
echo "DATABASE TABLES NEEDED (Supabase)"
echo "=========================================="
echo ""

echo "SQL: Create material_master table"
cat << 'EOF'
create table material_master (
  id uuid primary key default uuid_generate_v4(),
  material_code text not null unique,
  material_name text not null,
  material_type text not null,
  grade text default '',
  specification_no text default '',
  stp_no text default '',
  approved_vendor_required boolean default true,
  storage_condition text default '',
  retest_period text default '',
  shelf_life text default '',
  status text default 'Active',
  remarks text default '',
  created_by text,
  created_at timestamp default now(),
  updated_by text,
  updated_at timestamp default now()
);
EOF

echo ""
echo "SQL: Create vendor_master table"
cat << 'EOF'
create table vendor_master (
  id uuid primary key default uuid_generate_v4(),
  vendor_code text not null unique,
  vendor_name text not null,
  vendor_type text not null,
  material_supplied text not null,
  manufacturer_name text default '',
  supplier_name text default '',
  address text default '',
  country text default '',
  avl_status text default 'Not Approved',
  approval_date date,
  approval_expiry_date date,
  last_audit_date date,
  next_audit_due_date date,
  risk_category text default 'Medium',
  status text default 'Active',
  remarks text default '',
  created_by text,
  created_at timestamp default now(),
  updated_by text,
  updated_at timestamp default now()
);
EOF

echo ""
echo "SQL: Create material_review table"
cat << 'EOF'
create table material_review (
  id uuid primary key default uuid_generate_v4(),
  pqr_id text not null,
  product_id text default '',
  product_name text default '',
  batch_id text default '',
  batch_no text not null,
  material_type text not null,
  material_id text not null,
  material_name text not null,
  material_code text default '',
  manufacturer_name text not null,
  supplier_name text not null,
  vendor_id text default '',
  avl_status text default 'Not Approved',
  ar_no text not null unique,
  grn_no text default '',
  received_quantity numeric default 0,
  issued_quantity numeric default 0,
  used_quantity numeric not null,
  unit text not null,
  lot_no text default '',
  mfg_date date,
  exp_date date,
  retest_date date,
  qc_status text not null,
  coa_available text not null,
  specification_no text default '',
  stp_no text default '',
  test_result_summary text default '',
  compliance_status text default 'Not Applicable',
  compliance_reasons text[] default '{}',
  remarks text default '',
  created_by text,
  created_at timestamp default now(),
  updated_by text,
  updated_at timestamp default now(),
  foreign key (pqr_id) references pqr_documents(id) on delete cascade
);
EOF

echo ""
echo "SQL: Create audit_logs_material table"
cat << 'EOF'
create table audit_logs_material (
  id uuid primary key default uuid_generate_v4(),
  module text not null,
  record_id text not null,
  field_name text not null,
  old_value text,
  new_value text,
  changed_by text not null,
  changed_at timestamp default now(),
  reason text default ''
);
EOF

echo ""
echo "=========================================="
echo "REMAINING IMPLEMENTATION TASKS"
echo "=========================================="
echo ""

echo "1. Create Material Master Edit Page"
echo "   Path: app/dashboard/master/materials/[id]/edit/page.tsx"
echo "   Use: material review create page as template"
echo ""

echo "2. Create Vendor Master Pages"
echo "   Path: app/dashboard/master/vendors/page.tsx"
echo "   Path: app/dashboard/master/vendors/[id]/edit/page.tsx"
echo ""

echo "3. Create Excel Import Page"
echo "   Path: app/dashboard/pqr/[id]/materials/import/page.tsx"
echo "   Features:"
echo "   - Parse Excel with validation"
echo "   - Preview before import"
echo "   - Detect duplicates, missing materials/vendors"
echo "   - Batch import with error handling"
echo ""

echo "4. Create PDF Export Functionality"
echo "   Features:"
echo "   - Export material review table as PQR-style PDF"
echo "   - Include compliance summary"
echo "   - Add PQR header from Module 1"
echo ""

echo "5. Create Analytics Dashboard"
echo "   Path: app/dashboard/pqr/[id]/materials/analytics/page.tsx"
echo "   Charts:"
echo "   - Material usage by batch (Recharts Bar)"
echo "   - Approved vs Rejected lots (Pie chart)"
echo "   - Vendor-wise material usage (Bar chart)"
echo "   - AVL compliance trend (Line chart)"
echo "   - Expiry timeline (Gantt-like chart)"
echo ""

echo "6. Create Audit Trail Viewer"
echo "   Component: components/materials/audit-trail-viewer.tsx"
echo "   Features:"
echo "   - Show all changes with timestamps"
echo "   - Filter by user, date, module"
echo "   - Track field-level changes"
echo ""

echo "7. Role-Based Access Control"
echo "   Update routes to check user roles:"
echo "   - Super Admin: Full access"
echo "   - QA: Create/Edit/Review/Approve"
echo "   - QC: Update QC Status only"
echo "   - Warehouse: Create/Edit quantities"
echo "   - Production: View only"
echo "   - Auditor: Read-only"
echo ""

echo "=========================================="
echo "API ROUTES TO CREATE"
echo "=========================================="
echo ""

echo "POST /api/materials/import - Excel import with validation"
echo "POST /api/materials/export-pdf - Generate PQR PDF"
echo "GET /api/materials/analytics - Dashboard analytics data"
echo "GET /api/materials/audit-log - Retrieve audit history"
echo ""

echo "=========================================="
echo "ENVIRONMENT VARIABLES NEEDED"
echo "=========================================="
echo ""

echo "Ensure these are in .env.local:"
echo "- NEXT_PUBLIC_SUPABASE_URL"
echo "- NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "- Database connection configured"
echo ""

echo "=========================================="
echo "DEFAULT MATERIALS AUTO-LOADED"
echo "=========================================="
echo ""

echo "The following materials are automatically initialized:"
echo "1. Amikacin Sulphate IP (API)"
echo "2. Methyl Paraben IP (Preservative)"
echo "3. Propyl Paraben IP (Preservative)"
echo "4. Sodium Metabisulphite IP (Preservative)"
echo "5. Trisodium Citrate IP (Buffer)"
echo "6. Sulphuric Acid IP (Solvent)"
echo "7. Water for Injection IP (Solvent)"
echo ""

echo "=========================================="
echo "TESTING CHECKLIST"
echo "=========================================="
echo ""

echo "□ Create material review"
echo "□ Auto-compliance calculation works"
echo "□ Edit material review"
echo "□ Delete material review with audit log"
echo "□ Material Master CRUD"
echo "□ Vendor Master CRUD"
echo "□ Data table with all filters working"
echo "□ Summary cards calculate correctly"
echo "□ Excel import validation"
echo "□ Role-based access control"
echo "□ Audit trail logging"
echo "□ PDF export generates correctly"
echo "□ Analytics charts render"
echo ""

echo "✓ Module 3 implementation is ready for testing!"
echo ""
