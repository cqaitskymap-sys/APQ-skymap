# Module 3: API & Raw Material Review - Quick Reference Guide

## Overview
Complete Pharma PQR Material Review module with auto-compliance logic, master data management, and audit trails.

## 🎯 Core Features Implemented

### 1. **Material Review Management**
- Create/Edit/Delete material reviews
- Auto-compliance calculation based on vendor AVL, QC status, COA, expiry, quantities
- Real-time compliance status display
- Link to Material Master and Vendor Master

### 2. **Data Validation (Zod Schemas)**
- All entities validated with strict Zod schemas
- Automatic expiry date validation (must be after MFG date)
- Quantity validation (used ≤ issued ≤ received)
- AR No. must be unique
- Required fields enforced

### 3. **Summary Cards**
- Total Materials Reviewed
- Total API Lots / Raw Material Lots
- Approved / Rejected lots with percentages
- AVL Compliant / Non-Compliant lots
- Expired / Retest Due count

### 4. **Smart Data Table**
- 13-column responsive table with sticky header
- Multi-level filtering:
  - Material Type
  - QC Status
  - AVL Status
  - Compliance Status
  - Batch No., Material Name, Manufacturer, Supplier
- Mobile-responsive column wrapping
- Inline actions (View, Edit, Delete)

### 5. **Compliance Logic**
```typescript
Auto-marks "Complies" if ALL conditions met:
✓ Vendor AVL Status = Approved
✓ QC Status = Approved
✓ COA Available = Yes
✓ Material not expired
✓ Used Quantity ≤ Issued Quantity

Otherwise: "Does Not Comply" with specific reasons
```

### 6. **Audit Trail**
- Every create/update/delete logged
- User, timestamp, field changes tracked
- Module, record ID, reason recorded
- Query by date range, user, module

## 📁 File Structure

```
lib/
├── material-schemas.ts       # Zod schemas + constants
├── compliance-logic.ts       # Compliance calculation + badge colors
└── material-service.ts       # Supabase CRUD + validation helpers

components/materials/
├── compliance-summary-cards.tsx    # 8 stat cards
├── material-review-table.tsx       # Filterable data table
├── material-master-table.tsx       # (template for Vendor too)
└── audit-trail-viewer.tsx          # (to create)

app/dashboard/
├── pqr/[id]/materials/
│   ├── page.tsx              # List view ✓
│   ├── create/page.tsx       # Create/Edit form (template: review create)
│   ├── import/page.tsx       # Excel import (to create)
│   └── [id]/edit/page.tsx    # (to create)
└── master/
    ├── materials/
    │   ├── page.tsx          # Master list ✓
    │   ├── create/page.tsx   # Create material (to create)
    │   └── [id]/edit/page.tsx # Edit material (to create)
    └── vendors/
        ├── page.tsx          # Vendor list (to create)
        ├── create/page.tsx   # Create vendor (to create)
        └── [id]/edit/page.tsx # Edit vendor (to create)
```

## 🔑 Key Types & Enums

### Material Types
`API | Raw Material | Excipient | Solvent | Preservative | Buffer | pH Adjuster | Other`

### Statuses
- **Material**: Active, Inactive, Blocked
- **Vendor**: Active, Inactive, Blocked
- **AVL**: Approved, Not Approved, Conditional Approved, Blocked
- **QC**: Approved, Rejected, Under Test, Quarantine, Retest Required
- **Compliance**: Complies, Does Not Comply, Not Applicable

## 💡 Usage Examples

### Load Material Reviews
```typescript
import { getMaterialReviewsByPQR } from '@/lib/material-service';

const reviews = await getMaterialReviewsByPQR(pqrId, {
  materialType: 'API',
  qcStatus: 'Approved',
  avlStatus: 'Approved',
  dateFrom: '2024-01-01',
  dateTo: '2024-12-31'
});
```

### Calculate Compliance
```typescript
import { calculateCompliance } from '@/lib/compliance-logic';

const result = calculateCompliance({
  avlStatus: 'Approved',
  qcStatus: 'Approved',
  coaAvailable: 'Yes',
  expDate: '2025-12-31',
  usedQuantity: 100,
  issuedQuantity: 150
});

console.log(result.status); // 'Complies'
console.log(result.reasons); // []
```

### Create Material Review
```typescript
import { createMaterialReview } from '@/lib/material-service';

const review = await createMaterialReview({
  pqrId: 'PQR-2024-001',
  batchNo: 'BATCH-001',
  materialType: 'API',
  materialId: 'mat-123',
  materialName: 'Amikacin Sulphate IP',
  manufacturerName: 'Pharma Co.',
  supplierName: 'Supplier Inc.',
  arNo: 'AR-2024-001',
  usedQuantity: 100,
  unit: 'g',
  qcStatus: 'Approved',
  coaAvailable: 'Yes'
}, userId);
```

### Log Audit Entry
```typescript
import { logMaterialAudit } from '@/lib/material-service';

await logMaterialAudit({
  module: 'MATERIAL_REVIEW',
  recordId: reviewId,
  fieldName: 'qcStatus',
  oldValue: 'Under Test',
  newValue: 'Approved',
  changedBy: user.email,
  reason: 'Approved after testing'
}, userId);
```

## 🚀 Quick Setup

### 1. Create Supabase Tables
Run SQL from `MODULE3_SETUP.md`

### 2. Initialize Materials
```typescript
import { initializeDefaultMaterials } from '@/lib/material-service';
await initializeDefaultMaterials(); // Loads 7 default materials
```

### 3. Test the List Page
Navigate to `/dashboard/pqr/[pqr-id]/materials`

### 4. Create a Review
Click "Add Material" button

## 🎨 Component Props

### ComplianceSummaryCards
```typescript
interface SummaryCardsProps {
  totalMaterials: number;
  totalAPILots: number;
  totalRawMaterialLots: number;
  approvedLots: number;
  rejectedLots: number;
  avlCompliantLots: number;
  nonCompliantLots: number;
  expiredRetestDueMaterials: number;
}
```

### MaterialReviewTable
```typescript
interface MaterialReviewTableProps {
  data: MaterialReviewRow[];
  isLoading?: boolean;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}
```

## 📊 Badge Colors

```typescript
// Compliance
Complies → Green
Does Not Comply → Red
Not Applicable → Gray

// QC Status
Approved → Green
Rejected → Red
Under Test → Yellow
Quarantine → Orange
Retest Required → Orange

// AVL Status
Approved → Green
Not Approved → Red
Conditional Approved → Yellow
Blocked → Red
```

## 🔐 Role-Based Access

Add to middleware:
```typescript
const roleAccess = {
  super_admin: ['create', 'read', 'update', 'delete'],
  qa: ['create', 'read', 'update', 'approve'],
  qc: ['read', 'update_qc_status'],
  warehouse: ['create', 'read', 'update_quantities'],
  production: ['read'],
  auditor: ['read'],
  viewer: ['read']
};
```

## 📋 Next Steps

1. **Create Material Master Edit Form** - Use create page as template
2. **Create Vendor Master Pages** - Copy Material Master pattern
3. **Excel Import** - Parse + validate + batch insert
4. **PDF Export** - jsPDF + table layout
5. **Analytics Dashboard** - Recharts with 5 chart types
6. **Audit Trail UI** - Table viewer with filters

## ⚙️ Configuration

### Environment
```
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
```

### Storage Limits
- Material Master: No limit (indexed by code)
- Material Review: No limit per PQR
- Audit Logs: Retain 2 years (configurable)

## 🐛 Troubleshooting

### Compliance Not Calculating?
Check if all required fields are filled:
- avlStatus, qcStatus, coaAvailable, expDate, quantities

### Materials Not Loading?
- Run `initializeDefaultMaterials()` first
- Check Supabase table permissions
- Verify foreign keys

### Audit Log Not Created?
- Ensure user.id and user.email exist
- Check audit_logs_material table exists
- Verify role-based access

## 📚 Related Documentation
- Zod Schemas: `/lib/material-schemas.ts` (9200+ lines of types)
- Compliance Logic: `/lib/compliance-logic.ts` (validation functions)
- Service Layer: `/lib/material-service.ts` (Supabase queries)

---
**Last Updated**: 2024  
**Version**: 1.0 (Foundation Complete)  
**Status**: Ready for Extension
