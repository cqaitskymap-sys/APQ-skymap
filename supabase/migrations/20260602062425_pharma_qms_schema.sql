/*
  # Pharma QMS Platform — Core Schema

  ## Overview
  Complete database schema for an enterprise pharmaceutical Quality Management System (QMS)
  supporting GMP, 21 CFR Part 11, WHO GMP compliance.

  ## New Tables
  - `profiles` — extended user profiles with roles
  - `products` — pharmaceutical product master data
  - `batches` — manufacturing batch records
  - `deviations` — GMP deviation records
  - `oos_records` — Out-of-Specification investigation records
  - `capa_records` — Corrective and Preventive Action records
  - `change_controls` — change control records
  - `complaints` — market complaint records
  - `pqr_records` — Product Quality Review records
  - `stability_studies` — stability study records
  - `audit_logs` — immutable 21 CFR Part 11 audit trail
  - `notifications` — system notification records
  - `documents` — document management records
  - `vendors` — vendor/supplier master data
  - `equipment` — equipment qualification records
  - `training_records` — personnel training records

  ## Security
  - RLS enabled on all tables
  - Role-based access policies
  - Audit trail for all writes
*/

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('super_admin','qa','qc','production','engineering','warehouse','regulatory','viewer','auditor')),
  department text DEFAULT '',
  employee_id text DEFAULT '',
  phone text DEFAULT '',
  avatar_url text DEFAULT '',
  is_active boolean DEFAULT true,
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','auditor'))
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Super admin can update all profiles"
  ON profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

CREATE POLICY "Auth can insert profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code text UNIQUE NOT NULL,
  product_name text NOT NULL,
  generic_name text DEFAULT '',
  formulation text DEFAULT '',
  strength text DEFAULT '',
  pack_size text DEFAULT '',
  shelf_life_months integer DEFAULT 24,
  storage_conditions text DEFAULT '',
  market_authorization text DEFAULT '',
  therapeutic_category text DEFAULT '',
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view products"
  ON products FOR SELECT TO authenticated USING (true);

CREATE POLICY "QA/Admin can insert products"
  ON products FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','production'))
  );

CREATE POLICY "QA/Admin can update products"
  ON products FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa')));

-- ============================================================
-- BATCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number text UNIQUE NOT NULL,
  product_id uuid REFERENCES products(id),
  product_name text NOT NULL,
  product_code text NOT NULL,
  manufacturing_date date NOT NULL,
  expiry_date date NOT NULL,
  batch_size numeric(12,3) DEFAULT 0,
  unit text DEFAULT 'L',
  yield_percentage numeric(5,2),
  status text DEFAULT 'in_process' CHECK (status IN ('in_process','released','rejected','quarantine','recalled')),
  batch_formula_no text DEFAULT '',
  line_number text DEFAULT '',
  shift text DEFAULT '',
  batch_record_ref text DEFAULT '',
  remarks text DEFAULT '',
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view batches"
  ON batches FOR SELECT TO authenticated USING (true);

CREATE POLICY "Production/QA can insert batches"
  ON batches FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','qc','production'))
  );

CREATE POLICY "Production/QA can update batches"
  ON batches FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','qc','production')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','qc','production')));

-- ============================================================
-- DEVIATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS deviations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deviation_number text UNIQUE NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  deviation_type text DEFAULT 'minor' CHECK (deviation_type IN ('minor','major','critical')),
  category text DEFAULT '',
  product_id uuid REFERENCES products(id),
  batch_id uuid REFERENCES batches(id),
  batch_number text DEFAULT '',
  product_name text DEFAULT '',
  area text DEFAULT '',
  detected_by uuid REFERENCES profiles(id),
  detected_date date NOT NULL DEFAULT CURRENT_DATE,
  root_cause text DEFAULT '',
  immediate_action text DEFAULT '',
  status text DEFAULT 'open' CHECK (status IN ('open','under_investigation','capa_raised','closed','rejected')),
  risk_assessment text DEFAULT 'low' CHECK (risk_assessment IN ('low','medium','high','critical')),
  assigned_to uuid REFERENCES profiles(id),
  due_date date,
  closed_date date,
  closed_by uuid REFERENCES profiles(id),
  remarks text DEFAULT '',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE deviations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view deviations"
  ON deviations FOR SELECT TO authenticated USING (true);

CREATE POLICY "QA/Production can insert deviations"
  ON deviations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','qc','production','engineering','warehouse'))
  );

CREATE POLICY "QA can update deviations"
  ON deviations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','qc','production','engineering')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','qc','production','engineering')));

-- ============================================================
-- OOS RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS oos_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oos_number text UNIQUE NOT NULL,
  product_id uuid REFERENCES products(id),
  batch_id uuid REFERENCES batches(id),
  product_name text DEFAULT '',
  batch_number text DEFAULT '',
  test_parameter text NOT NULL,
  specification text DEFAULT '',
  obtained_result text DEFAULT '',
  unit text DEFAULT '',
  phase text DEFAULT 'phase1' CHECK (phase IN ('phase1','phase2a','phase2b','phase3')),
  status text DEFAULT 'open' CHECK (status IN ('open','under_investigation','invalidated','confirmed','closed')),
  investigation_type text DEFAULT 'laboratory' CHECK (investigation_type IN ('laboratory','manufacturing','both')),
  root_cause text DEFAULT '',
  corrective_action text DEFAULT '',
  assigned_to uuid REFERENCES profiles(id),
  due_date date,
  closed_date date,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE oos_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view OOS"
  ON oos_records FOR SELECT TO authenticated USING (true);

CREATE POLICY "QC/QA can insert OOS"
  ON oos_records FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','qc'))
  );

CREATE POLICY "QC/QA can update OOS"
  ON oos_records FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','qc')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','qc')));

-- ============================================================
-- CAPA RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS capa_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capa_number text UNIQUE NOT NULL,
  title text NOT NULL,
  source text DEFAULT '',
  source_reference text DEFAULT '',
  capa_type text DEFAULT 'corrective' CHECK (capa_type IN ('corrective','preventive','both')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  description text DEFAULT '',
  root_cause_analysis text DEFAULT '',
  proposed_action text DEFAULT '',
  effectiveness_criteria text DEFAULT '',
  status text DEFAULT 'open' CHECK (status IN ('open','in_progress','verification','effective','ineffective','closed')),
  assigned_to uuid REFERENCES profiles(id),
  target_date date,
  actual_close_date date,
  effectiveness_check_date date,
  verified_by uuid REFERENCES profiles(id),
  verified_date date,
  remarks text DEFAULT '',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE capa_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view CAPA"
  ON capa_records FOR SELECT TO authenticated USING (true);

CREATE POLICY "QA can insert CAPA"
  ON capa_records FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','qc','production','engineering'))
  );

CREATE POLICY "QA can update CAPA"
  ON capa_records FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','qc','production','engineering')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','qc','production','engineering')));

-- ============================================================
-- CHANGE CONTROLS
-- ============================================================
CREATE TABLE IF NOT EXISTS change_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cc_number text UNIQUE NOT NULL,
  title text NOT NULL,
  change_type text DEFAULT 'minor' CHECK (change_type IN ('minor','major','emergency')),
  category text DEFAULT '',
  description text DEFAULT '',
  justification text DEFAULT '',
  impact_assessment text DEFAULT '',
  risk_level text DEFAULT 'low' CHECK (risk_level IN ('low','medium','high')),
  status text DEFAULT 'draft' CHECK (status IN ('draft','submitted','under_review','approved','rejected','implemented','closed')),
  requested_by uuid REFERENCES profiles(id),
  request_date date DEFAULT CURRENT_DATE,
  target_implementation_date date,
  actual_implementation_date date,
  approved_by uuid REFERENCES profiles(id),
  approved_date date,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE change_controls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view CC"
  ON change_controls FOR SELECT TO authenticated USING (true);

CREATE POLICY "All staff can insert CC"
  ON change_controls FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "QA/Requestor can update CC"
  ON change_controls FOR UPDATE TO authenticated
  USING (
    requested_by = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa'))
  )
  WITH CHECK (
    requested_by = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa'))
  );

-- ============================================================
-- COMPLAINTS
-- ============================================================
CREATE TABLE IF NOT EXISTS complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_number text UNIQUE NOT NULL,
  product_id uuid REFERENCES products(id),
  batch_number text DEFAULT '',
  product_name text DEFAULT '',
  complaint_category text DEFAULT '',
  complaint_source text DEFAULT 'customer' CHECK (complaint_source IN ('customer','distributor','regulatory','internal')),
  description text NOT NULL,
  customer_name text DEFAULT '',
  country text DEFAULT '',
  severity text DEFAULT 'minor' CHECK (severity IN ('minor','major','critical','reportable')),
  status text DEFAULT 'open' CHECK (status IN ('open','under_investigation','closed','regulatory_reported')),
  investigation_summary text DEFAULT '',
  corrective_action text DEFAULT '',
  regulatory_reporting_required boolean DEFAULT false,
  assigned_to uuid REFERENCES profiles(id),
  due_date date,
  closed_date date,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view complaints"
  ON complaints FOR SELECT TO authenticated USING (true);

CREATE POLICY "QA can insert complaints"
  ON complaints FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','regulatory'))
  );

CREATE POLICY "QA can update complaints"
  ON complaints FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','regulatory')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','regulatory')));

-- ============================================================
-- PQR RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS pqr_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pqr_number text UNIQUE NOT NULL,
  product_id uuid REFERENCES products(id),
  product_name text NOT NULL,
  product_code text NOT NULL,
  review_year integer NOT NULL,
  review_period_start date NOT NULL,
  review_period_end date NOT NULL,
  total_batches integer DEFAULT 0,
  released_batches integer DEFAULT 0,
  rejected_batches integer DEFAULT 0,
  recall_batches integer DEFAULT 0,
  avg_yield numeric(5,2),
  oos_count integer DEFAULT 0,
  deviation_count integer DEFAULT 0,
  capa_count integer DEFAULT 0,
  complaint_count integer DEFAULT 0,
  stability_status text DEFAULT '',
  observations text DEFAULT '',
  conclusions text DEFAULT '',
  recommendations text DEFAULT '',
  overall_compliance text DEFAULT 'satisfactory' CHECK (overall_compliance IN ('satisfactory','needs_improvement','unsatisfactory')),
  status text DEFAULT 'draft' CHECK (status IN ('draft','under_review','approved','rejected')),
  prepared_by uuid REFERENCES profiles(id),
  reviewed_by uuid REFERENCES profiles(id),
  approved_by uuid REFERENCES profiles(id),
  review_date date,
  approval_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pqr_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view PQR"
  ON pqr_records FOR SELECT TO authenticated USING (true);

CREATE POLICY "QA can insert PQR"
  ON pqr_records FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','regulatory'))
  );

CREATE POLICY "QA can update PQR"
  ON pqr_records FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','regulatory')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','regulatory')));

-- ============================================================
-- STABILITY STUDIES
-- ============================================================
CREATE TABLE IF NOT EXISTS stability_studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_number text UNIQUE NOT NULL,
  product_id uuid REFERENCES products(id),
  batch_number text NOT NULL,
  product_name text DEFAULT '',
  study_type text DEFAULT 'long_term' CHECK (study_type IN ('long_term','accelerated','intermediate','stress')),
  storage_condition text DEFAULT '',
  temperature text DEFAULT '',
  humidity text DEFAULT '',
  start_date date NOT NULL,
  planned_end_date date,
  status text DEFAULT 'ongoing' CHECK (status IN ('ongoing','completed','discontinued','failed')),
  time_points text[] DEFAULT '{}',
  next_test_date date,
  assigned_to uuid REFERENCES profiles(id),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE stability_studies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view stability"
  ON stability_studies FOR SELECT TO authenticated USING (true);

CREATE POLICY "QC/QA can insert stability"
  ON stability_studies FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','qc'))
  );

CREATE POLICY "QC/QA can update stability"
  ON stability_studies FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','qc')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','qc')));

-- ============================================================
-- VENDORS
-- ============================================================
CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_code text UNIQUE NOT NULL,
  vendor_name text NOT NULL,
  vendor_type text DEFAULT 'raw_material' CHECK (vendor_type IN ('raw_material','packaging','api','service','equipment')),
  country text DEFAULT '',
  contact_person text DEFAULT '',
  email text DEFAULT '',
  phone text DEFAULT '',
  approval_status text DEFAULT 'approved' CHECK (approval_status IN ('approved','conditional','suspended','rejected')),
  last_audit_date date,
  next_audit_date date,
  quality_rating integer DEFAULT 3 CHECK (quality_rating BETWEEN 1 AND 5),
  gmp_certificate_expiry date,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view vendors"
  ON vendors FOR SELECT TO authenticated USING (true);

CREATE POLICY "QA/Warehouse can insert vendors"
  ON vendors FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','warehouse'))
  );

CREATE POLICY "QA/Warehouse can update vendors"
  ON vendors FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','warehouse')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','warehouse')));

-- ============================================================
-- EQUIPMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id text UNIQUE NOT NULL,
  equipment_name text NOT NULL,
  equipment_type text DEFAULT '',
  manufacturer text DEFAULT '',
  model text DEFAULT '',
  serial_number text DEFAULT '',
  location text DEFAULT '',
  department text DEFAULT '',
  status text DEFAULT 'qualified' CHECK (status IN ('qualified','under_maintenance','out_of_service','decommissioned','pending_qualification')),
  iq_date date,
  oq_date date,
  pq_date date,
  next_qualification_date date,
  last_calibration_date date,
  next_calibration_date date,
  last_pm_date date,
  next_pm_date date,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view equipment"
  ON equipment FOR SELECT TO authenticated USING (true);

CREATE POLICY "Engineering/QA can insert equipment"
  ON equipment FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','engineering'))
  );

CREATE POLICY "Engineering/QA can update equipment"
  ON equipment FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','engineering')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','engineering')));

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text UNIQUE NOT NULL,
  title text NOT NULL,
  doc_type text DEFAULT 'sop' CHECK (doc_type IN ('sop','policy','form','specification','protocol','report','certificate','other')),
  version text DEFAULT '1.0',
  status text DEFAULT 'draft' CHECK (status IN ('draft','under_review','approved','obsolete','superseded')),
  department text DEFAULT '',
  effective_date date,
  review_date date,
  file_url text DEFAULT '',
  file_name text DEFAULT '',
  description text DEFAULT '',
  created_by uuid REFERENCES profiles(id),
  approved_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view documents"
  ON documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "All staff can insert documents"
  ON documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Creator/QA can update documents"
  ON documents FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa'))
  )
  WITH CHECK (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa'))
  );

-- ============================================================
-- TRAINING RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS training_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id text UNIQUE NOT NULL,
  training_title text NOT NULL,
  training_type text DEFAULT 'gmp' CHECK (training_type IN ('gmp','sop','safety','technical','regulatory','soft_skill')),
  trainer_name text DEFAULT '',
  department text DEFAULT '',
  training_date date NOT NULL,
  validity_months integer DEFAULT 12,
  next_training_date date,
  attendees uuid[] DEFAULT '{}',
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
  assessment_score numeric(5,2),
  pass_score numeric(5,2) DEFAULT 70,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE training_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view training"
  ON training_records FOR SELECT TO authenticated USING (true);

CREATE POLICY "QA/Admin can insert training"
  ON training_records FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa'))
  );

CREATE POLICY "QA/Admin can update training"
  ON training_records FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa')));

-- ============================================================
-- AUDIT LOGS (Immutable — 21 CFR Part 11)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  user_name text DEFAULT '',
  user_role text DEFAULT '',
  action text NOT NULL,
  module text NOT NULL,
  record_id text DEFAULT '',
  record_number text DEFAULT '',
  field_name text DEFAULT '',
  old_value text DEFAULT '',
  new_value text DEFAULT '',
  ip_address text DEFAULT '',
  user_agent text DEFAULT '',
  timestamp timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view audit logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','qa','auditor','regulatory'))
  );

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info' CHECK (type IN ('info','warning','error','success','due_date')),
  module text DEFAULT '',
  record_id text DEFAULT '',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_batches_product ON batches(product_id);
CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_mfg_date ON batches(manufacturing_date);
CREATE INDEX IF NOT EXISTS idx_deviations_status ON deviations(status);
CREATE INDEX IF NOT EXISTS idx_deviations_type ON deviations(deviation_type);
CREATE INDEX IF NOT EXISTS idx_oos_status ON oos_records(status);
CREATE INDEX IF NOT EXISTS idx_capa_status ON capa_records(status);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ts ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_pqr_product_year ON pqr_records(product_id, review_year);
CREATE INDEX IF NOT EXISTS idx_stability_status ON stability_studies(status);
