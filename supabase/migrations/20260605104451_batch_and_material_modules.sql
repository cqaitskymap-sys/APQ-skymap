/*
# Module 2 & 3: Batch Manufacturing + API/Raw Material Review

## Overview
Creates tables for:
- PQR-linked batch manufacturing records (Module 2)
- Material master (API, Raw Material, Excipient, etc.)
- Vendor master (AVL tracking)
- API/Raw Material review entries (Module 3)

All tables link back to pqr_documents and product_master from Module 1.

## New Tables
- `pqr_batches` — batch manufacturing details linked to PQR
- `material_master` — material catalog (API, raw material, excipient, etc.)
- `vendor_master` — vendor/supplier with AVL status tracking
- `material_review` — API/Raw Material review entries per batch per PQR

## Security
- RLS enabled on all tables
- authenticated CRUD access
*/

-- ============================================================
-- PQR BATCHES — batch manufacturing records linked to PQR
-- ============================================================
CREATE TABLE IF NOT EXISTS pqr_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pqr_id uuid NOT NULL REFERENCES pqr_documents(id) ON DELETE CASCADE,
  product_id uuid REFERENCES product_master(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  generic_name text DEFAULT '',
  strength text DEFAULT '',
  batch_no text NOT NULL,
  semi_finish_batch_no text DEFAULT '',
  finished_product_batch_no text DEFAULT '',
  mfg_date date NOT NULL,
  exp_date date NOT NULL,
  batch_size text NOT NULL DEFAULT '',
  manufactured_for text DEFAULT '',
  customer_name text DEFAULT '',
  market text DEFAULT '',
  batch_status text NOT NULL DEFAULT 'manufactured' CHECK (batch_status IN ('manufactured','released','rejected','hold','reprocessed','reworked','cancelled')),
  release_date date,
  remarks text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(batch_no, pqr_id)
);

ALTER TABLE pqr_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_pqr_batches" ON pqr_batches;
CREATE POLICY "select_pqr_batches" ON pqr_batches FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_pqr_batches" ON pqr_batches;
CREATE POLICY "insert_pqr_batches" ON pqr_batches FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_pqr_batches" ON pqr_batches;
CREATE POLICY "update_pqr_batches" ON pqr_batches FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_pqr_batches" ON pqr_batches;
CREATE POLICY "delete_pqr_batches" ON pqr_batches FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- MATERIAL MASTER — API, raw material, excipient catalog
-- ============================================================
CREATE TABLE IF NOT EXISTS material_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_code text NOT NULL UNIQUE,
  material_name text NOT NULL,
  material_type text NOT NULL DEFAULT 'raw_material' CHECK (material_type IN ('api','raw_material','excipient','solvent','preservative','buffer','ph_adjuster','other')),
  grade text DEFAULT '',
  specification_no text DEFAULT '',
  stp_no text DEFAULT '',
  approved_vendor_required boolean DEFAULT true,
  storage_condition text DEFAULT '',
  retest_period text DEFAULT '',
  shelf_life text DEFAULT '',
  status text DEFAULT 'active' CHECK (status IN ('active','inactive','blocked')),
  remarks text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE material_master ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_material_master" ON material_master;
CREATE POLICY "select_material_master" ON material_master FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_material_master" ON material_master;
CREATE POLICY "insert_material_master" ON material_master FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_material_master" ON material_master;
CREATE POLICY "update_material_master" ON material_master FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_material_master" ON material_master;
CREATE POLICY "delete_material_master" ON material_master FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- VENDOR MASTER — supplier/manufacturer with AVL tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS vendor_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_code text NOT NULL UNIQUE,
  vendor_name text NOT NULL,
  vendor_type text NOT NULL DEFAULT 'manufacturer' CHECK (vendor_type IN ('manufacturer','supplier','manufacturer_supplier')),
  material_supplied text DEFAULT '',
  manufacturer_name text DEFAULT '',
  supplier_name text DEFAULT '',
  address text DEFAULT '',
  country text DEFAULT '',
  avl_status text NOT NULL DEFAULT 'not_approved' CHECK (avl_status IN ('approved','not_approved','conditional_approved','blocked')),
  approval_date date,
  approval_expiry_date date,
  last_audit_date date,
  next_audit_due_date date,
  risk_category text DEFAULT 'low' CHECK (risk_category IN ('low','medium','high')),
  status text DEFAULT 'active' CHECK (status IN ('active','inactive','blocked')),
  remarks text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vendor_master ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_vendor_master" ON vendor_master;
CREATE POLICY "select_vendor_master" ON vendor_master FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_vendor_master" ON vendor_master;
CREATE POLICY "insert_vendor_master" ON vendor_master FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_vendor_master" ON vendor_master;
CREATE POLICY "update_vendor_master" ON vendor_master FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_vendor_master" ON vendor_master;
CREATE POLICY "delete_vendor_master" ON vendor_master FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- MATERIAL REVIEW — API/Raw Material review per batch
-- ============================================================
CREATE TABLE IF NOT EXISTS material_review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pqr_id uuid NOT NULL REFERENCES pqr_documents(id) ON DELETE CASCADE,
  product_id uuid REFERENCES product_master(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES pqr_batches(id) ON DELETE SET NULL,
  batch_no text NOT NULL DEFAULT '',
  material_type text NOT NULL DEFAULT 'raw_material' CHECK (material_type IN ('api','raw_material','excipient','solvent','preservative','buffer','ph_adjuster','other')),
  material_id uuid REFERENCES material_master(id) ON DELETE SET NULL,
  material_name text NOT NULL DEFAULT '',
  material_code text DEFAULT '',
  manufacturer_name text DEFAULT '',
  supplier_name text DEFAULT '',
  vendor_id uuid REFERENCES vendor_master(id) ON DELETE SET NULL,
  avl_status text DEFAULT 'not_approved' CHECK (avl_status IN ('approved','not_approved','conditional_approved','blocked')),
  ar_no text DEFAULT '',
  grn_no text DEFAULT '',
  received_quantity text DEFAULT '',
  issued_quantity text DEFAULT '',
  used_quantity text DEFAULT '',
  unit text DEFAULT '',
  lot_no text DEFAULT '',
  mfg_date date,
  exp_date date,
  retest_date date,
  qc_status text DEFAULT 'under_test' CHECK (qc_status IN ('approved','rejected','under_test','quarantine','retest_required')),
  coa_available text DEFAULT 'no' CHECK (coa_available IN ('yes','no')),
  specification_no text DEFAULT '',
  stp_no text DEFAULT '',
  test_result_summary text DEFAULT '',
  compliance_status text DEFAULT 'not_applicable' CHECK (compliance_status IN ('complies','does_not_comply','not_applicable')),
  compliance_reasons text[] DEFAULT '{}',
  remarks text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(ar_no, material_id)
);

ALTER TABLE material_review ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_material_review" ON material_review;
CREATE POLICY "select_material_review" ON material_review FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_material_review" ON material_review;
CREATE POLICY "insert_material_review" ON material_review FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_material_review" ON material_review;
CREATE POLICY "update_material_review" ON material_review FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_material_review" ON material_review;
CREATE POLICY "delete_material_review" ON material_review FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- Seed default materials for Amikacin Injection IP
-- ============================================================
INSERT INTO material_master (material_code, material_name, material_type, grade, specification_no, stp_no, storage_condition, retest_period, shelf_life) VALUES
  ('MAT-API-001', 'Amikacin Sulphate IP', 'api', 'IP', 'SPEC-API-001', 'STP-API-001', 'Room Temperature', '24 months', '36 months'),
  ('MAT-RM-001', 'Methyl Paraben IP', 'preservative', 'IP', 'SPEC-RM-001', 'STP-RM-001', 'Room Temperature', '24 months', '36 months'),
  ('MAT-RM-002', 'Propyl Paraben IP', 'preservative', 'IP', 'SPEC-RM-002', 'STP-RM-002', 'Room Temperature', '24 months', '36 months'),
  ('MAT-RM-003', 'Sodium Metabisulphite IP', 'raw_material', 'IP', 'SPEC-RM-003', 'STP-RM-003', 'Room Temperature', '24 months', '36 months'),
  ('MAT-RM-004', 'Trisodium Citrate IP', 'buffer', 'IP', 'SPEC-RM-004', 'STP-RM-004', 'Room Temperature', '24 months', '36 months'),
  ('MAT-RM-005', 'Sulphuric Acid IP', 'ph_adjuster', 'IP', 'SPEC-RM-005', 'STP-RM-005', 'Room Temperature', '24 months', '36 months'),
  ('MAT-SOL-001', 'Water for Injection IP', 'solvent', 'IP', 'SPEC-SOL-001', 'STP-SOL-001', 'Room Temperature', 'N/A', 'N/A')
ON CONFLICT (material_code) DO NOTHING;

-- ============================================================
-- Seed default vendors
-- ============================================================
INSERT INTO vendor_master (vendor_code, vendor_name, vendor_type, material_supplied, manufacturer_name, supplier_name, country, avl_status, risk_category) VALUES
  ('VND-001', 'ChemPure Supplies', 'manufacturer_supplier', 'Amikacin Sulphate IP', 'ChemPure Supplies', 'ChemPure Supplies', 'India', 'approved', 'low'),
  ('VND-002', 'PackTech International', 'supplier', 'Methyl Paraben IP, Propyl Paraben IP', 'KemPres Ltd', 'PackTech International', 'India', 'approved', 'low'),
  ('VND-003', 'AdvAPI Corp', 'manufacturer', 'Amikacin Sulphate IP', 'AdvAPI Corp', 'AdvAPI Corp', 'India', 'conditional_approved', 'medium'),
  ('VND-004', 'Calibration Services Ltd', 'supplier', 'Sodium Metabisulphite, Trisodium Citrate', 'FineChem Ltd', 'Calibration Services Ltd', 'India', 'approved', 'low')
ON CONFLICT (vendor_code) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pqr_batches_pqr_id ON pqr_batches(pqr_id);
CREATE INDEX IF NOT EXISTS idx_pqr_batches_status ON pqr_batches(batch_status);
CREATE INDEX IF NOT EXISTS idx_pqr_batches_batch_no ON pqr_batches(batch_no);
CREATE INDEX IF NOT EXISTS idx_material_review_pqr_id ON material_review(pqr_id);
CREATE INDEX IF NOT EXISTS idx_material_review_batch_id ON material_review(batch_id);
CREATE INDEX IF NOT EXISTS idx_material_review_material_id ON material_review(material_id);
CREATE INDEX IF NOT EXISTS idx_material_review_vendor_id ON material_review(vendor_id);
CREATE INDEX IF NOT EXISTS idx_material_master_type ON material_master(material_type);
CREATE INDEX IF NOT EXISTS idx_vendor_master_avl ON vendor_master(avl_status);
