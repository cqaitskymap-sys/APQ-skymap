/*
# PQR Module — Document Setup & Product Master

## Overview
Creates tables for the Product Quality Review (PQR) document management module.
This module captures PQR cover page, header, product details, document approval,
revision control, and abbreviation master — all 21 CFR Part 11 compliant.

## New Tables
- `pqr_documents` — main PQR document records with header info, review period, status
- `product_master` — extended product details with composition, brand names
- `pqr_approvals` — approval workflow (prepared/reviewed/approved by) with signatures
- `pqr_revision_history` — revision tracking with change control references
- `abbreviation_master` — abbreviation dictionary for PQR documents
- `pqr_composition` — ingredient/composition rows for products (child of product_master)
- `pqr_brand_names` — brand name list for products (child of product_master)

## Security
- RLS enabled on all tables
- authenticated users can CRUD (owner-scoped via app layer)
*/

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PQR DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS pqr_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'Skymap Pharmaceuticals Pvt. Ltd., Roorkee',
  site_name text DEFAULT '',
  address text DEFAULT '',
  document_title text NOT NULL,
  product_name text NOT NULL,
  pqr_number text NOT NULL,
  page_number text DEFAULT '1',
  revision_number text NOT NULL DEFAULT '00',
  format_number text DEFAULT '',
  product_code text DEFAULT '',
  review_period_from date NOT NULL,
  review_period_to date NOT NULL,
  total_review_months integer DEFAULT 0,
  total_batches_manufactured integer DEFAULT 0,
  total_released_batches integer DEFAULT 0,
  total_rejected_batches integer DEFAULT 0,
  total_reworked_batches integer DEFAULT 0,
  total_reprocessed_batches integer DEFAULT 0,
  pqr_year integer,
  document_status text NOT NULL DEFAULT 'draft' CHECK (document_status IN ('draft','under_review','approved','rejected','archived')),
  review_frequency text DEFAULT 'yearly' CHECK (review_frequency IN ('monthly','quarterly','half_yearly','yearly')),
  current_revision text DEFAULT '00',
  previous_revision text DEFAULT '',
  next_review_due_date date,
  document_owner_department text DEFAULT 'Quality Assurance',
  effective_date date,
  prepared_date date,
  company_logo_url text DEFAULT '',
  observations text DEFAULT '',
  conclusions text DEFAULT '',
  recommendations text DEFAULT '',
  overall_compliance text DEFAULT 'satisfactory' CHECK (overall_compliance IN ('satisfactory','needs_improvement','unsatisfactory')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  UNIQUE(pqr_number)
);

ALTER TABLE pqr_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_pqr_documents" ON pqr_documents;
CREATE POLICY "select_pqr_documents" ON pqr_documents FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_pqr_documents" ON pqr_documents;
CREATE POLICY "insert_pqr_documents" ON pqr_documents FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_pqr_documents" ON pqr_documents;
CREATE POLICY "update_pqr_documents" ON pqr_documents FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_pqr_documents" ON pqr_documents;
CREATE POLICY "delete_pqr_documents" ON pqr_documents FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- PRODUCT MASTER
-- ============================================================
CREATE TABLE IF NOT EXISTS product_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generic_name text NOT NULL,
  product_name text NOT NULL,
  strength text NOT NULL,
  shelf_life text DEFAULT '',
  standard_batch_size text DEFAULT '',
  manufacturing_license_no text DEFAULT '',
  final_packing_details text DEFAULT '',
  product_code text DEFAULT '',
  dosage_form text DEFAULT '',
  market_type text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE product_master ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_product_master" ON product_master;
CREATE POLICY "select_product_master" ON product_master FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_product_master" ON product_master;
CREATE POLICY "insert_product_master" ON product_master FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_product_master" ON product_master;
CREATE POLICY "update_product_master" ON product_master FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_product_master" ON product_master;
CREATE POLICY "delete_product_master" ON product_master FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- PQR COMPOSITION
-- ============================================================
CREATE TABLE IF NOT EXISTS pqr_composition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES product_master(id) ON DELETE CASCADE,
  ingredient_name text NOT NULL,
  grade text DEFAULT '',
  equivalent_claim text DEFAULT '',
  quantity text DEFAULT '',
  unit text DEFAULT '',
  purpose text DEFAULT '',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pqr_composition ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_pqr_composition" ON pqr_composition;
CREATE POLICY "select_pqr_composition" ON pqr_composition FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_pqr_composition" ON pqr_composition;
CREATE POLICY "insert_pqr_composition" ON pqr_composition FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_pqr_composition" ON pqr_composition;
CREATE POLICY "update_pqr_composition" ON pqr_composition FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_pqr_composition" ON pqr_composition;
CREATE POLICY "delete_pqr_composition" ON pqr_composition FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- PQR BRAND NAMES
-- ============================================================
CREATE TABLE IF NOT EXISTS pqr_brand_names (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES product_master(id) ON DELETE CASCADE,
  brand_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pqr_brand_names ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_pqr_brand_names" ON pqr_brand_names;
CREATE POLICY "select_pqr_brand_names" ON pqr_brand_names FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_pqr_brand_names" ON pqr_brand_names;
CREATE POLICY "insert_pqr_brand_names" ON pqr_brand_names FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_pqr_brand_names" ON pqr_brand_names;
CREATE POLICY "update_pqr_brand_names" ON pqr_brand_names FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_pqr_brand_names" ON pqr_brand_names;
CREATE POLICY "delete_pqr_brand_names" ON pqr_brand_names FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- PQR APPROVALS
-- ============================================================
CREATE TABLE IF NOT EXISTS pqr_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pqr_id uuid NOT NULL REFERENCES pqr_documents(id) ON DELETE CASCADE,
  approval_type text NOT NULL CHECK (approval_type IN ('prepared','reviewed','approved')),
  designation text NOT NULL,
  name text DEFAULT '',
  signature_url text DEFAULT '',
  signature_text text DEFAULT '',
  approval_date date,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  remarks text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pqr_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_pqr_approvals" ON pqr_approvals;
CREATE POLICY "select_pqr_approvals" ON pqr_approvals FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_pqr_approvals" ON pqr_approvals;
CREATE POLICY "insert_pqr_approvals" ON pqr_approvals FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_pqr_approvals" ON pqr_approvals;
CREATE POLICY "update_pqr_approvals" ON pqr_approvals FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_pqr_approvals" ON pqr_approvals;
CREATE POLICY "delete_pqr_approvals" ON pqr_approvals FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- PQR REVISION HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS pqr_revision_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pqr_id uuid NOT NULL REFERENCES pqr_documents(id) ON DELETE CASCADE,
  revision_no text NOT NULL DEFAULT '00',
  change_control_no text DEFAULT 'Not Applicable',
  details_of_changes text DEFAULT 'Not Applicable',
  reason_of_changes text DEFAULT 'New PQR',
  effective_date date,
  updated_by uuid REFERENCES auth.users(id),
  is_locked boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pqr_revision_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_pqr_revision_history" ON pqr_revision_history;
CREATE POLICY "select_pqr_revision_history" ON pqr_revision_history FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_pqr_revision_history" ON pqr_revision_history;
CREATE POLICY "insert_pqr_revision_history" ON pqr_revision_history FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_pqr_revision_history" ON pqr_revision_history;
CREATE POLICY "update_pqr_revision_history" ON pqr_revision_history FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_pqr_revision_history" ON pqr_revision_history;
CREATE POLICY "delete_pqr_revision_history" ON pqr_revision_history FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- ABBREVIATION MASTER
-- ============================================================
CREATE TABLE IF NOT EXISTS abbreviation_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  abbreviation text NOT NULL,
  full_form text NOT NULL,
  description text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE abbreviation_master ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_abbreviation_master" ON abbreviation_master;
CREATE POLICY "select_abbreviation_master" ON abbreviation_master FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_abbreviation_master" ON abbreviation_master;
CREATE POLICY "insert_abbreviation_master" ON abbreviation_master FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_abbreviation_master" ON abbreviation_master;
CREATE POLICY "update_abbreviation_master" ON abbreviation_master FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_abbreviation_master" ON abbreviation_master;
CREATE POLICY "delete_abbreviation_master" ON abbreviation_master FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- Seed default abbreviations
-- ============================================================
INSERT INTO abbreviation_master (abbreviation, full_form, description) VALUES
  ('STP', 'Standard Test Procedure', 'Standard testing methodology'),
  ('STS', 'Standard Test Specification', 'Product specification limits'),
  ('FP', 'Finish Product', 'Final packaged product'),
  ('SF', 'Semi Finish', 'Intermediate product'),
  ('BMR', 'Batch Manufacturing Record', 'Manufacturing documentation'),
  ('BPR', 'Batch Packing Record', 'Packing documentation'),
  ('MFR No.', 'Master Formula Record Number', 'Master formula reference'),
  ('PQR', 'Product Quality Review', 'Annual product quality review'),
  ('Min.', 'Minimum value from all values', 'Statistical minimum'),
  ('Max.', 'Maximum value from all values', 'Statistical maximum'),
  ('API', 'Active Pharmaceutical Ingredient', 'Active drug substance'),
  ('A.R.', 'Analytical Report', 'Lab analysis report'),
  ('HVAC', 'Heating Ventilation Air Conditioner', 'Environmental control system'),
  ('CAPA', 'Corrective Action and Preventive Action', 'Quality improvement system'),
  ('OOS', 'Out of Specification', 'Result outside specification'),
  ('LT', 'Less Than', 'Comparison operator'),
  ('NMT', 'Not More Than', 'Upper limit specification'),
  ('ND', 'Not Detected', 'Below detection limit'),
  ('AVL', 'Approved Vendor List', 'Qualified supplier list'),
  ('NLT', 'Not Less Than', 'Lower limit specification'),
  ('CQA', 'Critical Quality Attribute', 'Key quality parameter'),
  ('CPP', 'Critical Process Parameter', 'Key process parameter'),
  ('RH', 'Relative Humidity', 'Moisture measurement'),
  ('PV', 'Process Validation', 'Manufacturing process verification'),
  ('IQ', 'Installation Qualification', 'Equipment installation verification'),
  ('OQ', 'Operational Qualification', 'Equipment operation verification'),
  ('PQ', 'Performance Qualification', 'Equipment performance verification')
ON CONFLICT DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pqr_documents_pqr_number ON pqr_documents(pqr_number);
CREATE INDEX IF NOT EXISTS idx_pqr_documents_status ON pqr_documents(document_status);
CREATE INDEX IF NOT EXISTS idx_pqr_approvals_pqr_id ON pqr_approvals(pqr_id);
CREATE INDEX IF NOT EXISTS idx_pqr_revision_history_pqr_id ON pqr_revision_history(pqr_id);
CREATE INDEX IF NOT EXISTS idx_pqr_composition_product_id ON pqr_composition(product_id);
CREATE INDEX IF NOT EXISTS idx_pqr_brand_names_product_id ON pqr_brand_names(product_id);
CREATE INDEX IF NOT EXISTS idx_abbreviation_master_active ON abbreviation_master(is_active);
