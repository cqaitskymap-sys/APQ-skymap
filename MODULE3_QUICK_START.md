# Module 3: Developer Quick Start Guide

## 🎯 What You Can Do RIGHT NOW

### 1. View Material Reviews
```bash
npm run dev
# Navigate to: /dashboard/pqr/any-pqr-id/materials
# You'll see:
✓ 8 summary stat cards
✓ Material data table with filters
✓ Add/Import buttons
```

### 2. Create a Material Review
```bash
# Click "Add Material" button
# Select material type → Material name auto-populates details
# Fill required fields (marked with *)
# Watch compliance status update in real-time
# Green = Complies, Red = Does Not Comply with reasons shown
# Click Save → Success! Returns to list
```

### 3. Edit or Delete
```bash
# In table, click dropdown menu (...)
# Edit → Returns to form with prefilled data
# Delete → Confirmation dialog, then removes from list
# All actions logged in audit trail
```

### 4. View Material Master
```bash
# Navigate to: /dashboard/master/materials
# See 7 pre-loaded default materials
# Filter by Type/Status
# Search by code/name
# Edit/Delete materials
```

---

## 📦 Core Files Reference

### Business Logic Layer
```typescript
// Schemas with validation
import { 
  materialReviewSchema,
  MaterialReview,
  MATERIAL_TYPES,
  QC_STATUSES 
} from '@/lib/material-schemas';

// Compliance calculation
import { 
  calculateCompliance,
  getComplianceBadgeColor 
} from '@/lib/compliance-logic';

// Database operations
import { 
  getMaterialReviewsByPQR,
  createMaterialReview,
  updateMaterialReview,
  deleteMaterialReview,
  logMaterialAudit 
} from '@/lib/material-service';
```

### UI Components
```typescript
// Summary cards showing KPIs
import { ComplianceSummaryCards } from '@/components/materials/compliance-summary-cards';

// Filterable data table
import { MaterialReviewTable } from '@/components/materials/material-review-table';
```

### Usage Example
```typescript
'use client';
import { useEffect, useState } from 'react';
import { getMaterialReviewsByPQR } from '@/lib/material-service';
import { MaterialReviewTable } from '@/components/materials/material-review-table';
import { ComplianceSummaryCards } from '@/components/materials/compliance-summary-cards';

export default function MyPage() {
  const [materials, setMaterials] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      // Load all reviews for a PQR with optional filters
      const data = await getMaterialReviewsByPQR('pqr-123', {
        materialType: 'API',
        qcStatus: 'Approved'
      });
      setMaterials(data);
    };
    loadData();
  }, []);

  // Calculate stats for cards
  const stats = {
    totalMaterials: materials.length,
    totalAPILots: materials.filter(m => m.materialType === 'API').length,
    totalRawMaterialLots: materials.filter(m => m.materialType !== 'API').length,
    approvedLots: materials.filter(m => m.qcStatus === 'Approved').length,
    rejectedLots: materials.filter(m => m.qcStatus === 'Rejected').length,
    avlCompliantLots: materials.filter(m => m.avlStatus === 'Approved').length,
    nonCompliantLots: materials.filter(m => m.complianceStatus === 'Does Not Comply').length,
    expiredRetestDueMaterials: materials.filter(m => {
      const exp = new Date(m.expDate);
      return exp < new Date();
    }).length,
  };

  return (
    <>
      <ComplianceSummaryCards {...stats} />
      <MaterialReviewTable 
        data={materials}
        onEdit={(id) => console.log('Edit', id)}
        onDelete={(id) => console.log('Delete', id)}
      />
    </>
  );
}
```

---

## 🔧 Common Tasks

### Load Data with Filters
```typescript
import { getMaterialReviewsByPQR } from '@/lib/material-service';

// Get all API materials that were approved by QC
const apiReviews = await getMaterialReviewsByPQR('pqr-123', {
  materialType: 'API',
  qcStatus: 'Approved',
  avlStatus: 'Approved'
});
```

### Check Compliance
```typescript
import { calculateCompliance } from '@/lib/compliance-logic';

const review = {
  avlStatus: 'Approved',
  qcStatus: 'Approved',
  coaAvailable: 'Yes',
  expDate: '2025-12-31',
  usedQuantity: 100,
  issuedQuantity: 150
};

const result = calculateCompliance(review);
console.log(result.status);      // "Complies"
console.log(result.reasons);     // []
console.log(result.isExpired);   // false
```

### Create Material Review
```typescript
import { createMaterialReview } from '@/lib/material-service';

const newReview = await createMaterialReview({
  pqrId: 'PQR-2024-001',
  batchNo: 'BATCH-001',
  materialType: 'API',
  materialId: 'mat-uuid',
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

### Validate Material Exists
```typescript
import { checkMaterialExists } from '@/lib/material-service';

const exists = await checkMaterialExists(materialId);
if (!exists) {
  throw new Error('Material not found');
}
```

---

## 🎨 Styling & UI Patterns

### Badge Colors (Auto-Applied)
```
Compliance:
  "Complies" → bg-green-100 text-green-800
  "Does Not Comply" → bg-red-100 text-red-800
  "Not Applicable" → bg-gray-100 text-gray-800

QC Status:
  "Approved" → Green
  "Rejected" → Red
  "Under Test" → Yellow
  "Quarantine" → Orange
  "Retest Required" → Orange

AVL Status:
  "Approved" → Green
  "Not Approved" → Red
  "Conditional Approved" → Yellow
  "Blocked" → Red
```

Use in components:
```typescript
import { getComplianceBadgeColor } from '@/lib/compliance-logic';

<Badge className={getComplianceBadgeColor(complianceStatus)}>
  {complianceStatus}
</Badge>
```

---

## 🗄️ Database Queries You Can Use

### Get all approved materials for a PQR
```sql
SELECT * FROM material_review 
WHERE pqr_id = 'pqr-123' 
  AND qc_status = 'Approved' 
  AND avl_status = 'Approved'
ORDER BY created_at DESC;
```

### Find compliance issues
```sql
SELECT * FROM material_review 
WHERE pqr_id = 'pqr-123' 
  AND compliance_status = 'Does Not Comply'
ORDER BY created_at DESC;
```

### Audit trail for a record
```sql
SELECT * FROM audit_logs_material 
WHERE record_id = 'review-uuid'
ORDER BY changed_at DESC;
```

### Materials near expiry
```sql
SELECT * FROM material_review 
WHERE exp_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
ORDER BY exp_date ASC;
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Materials not showing | Run `initializeDefaultMaterials()` first |
| Compliance not calculating | Check all required fields are filled (not null) |
| Audit log not created | Verify user.id and user.email exist |
| Type errors on form | Ensure types match schema (MATERIAL_TYPES enum) |
| Filters not working | Check select values match constant arrays |
| Delete not working | Verify no foreign key constraints |

---

## 📝 Validation Rules

### Required Fields (*)
- Batch No
- Material Type
- Material Name
- Manufacturer Name
- Supplier Name
- AR No
- Used Quantity
- Unit
- QC Status
- COA Available

### Conditional Validations
```
✓ EXP Date must be after MFG Date
✓ Used Quantity ≤ Issued Quantity
✓ Received Qty ≥ 0
✓ AR No must be unique (per review)
✓ Approval Expiry cannot be past for "Approved" vendors
```

---

## 🚀 Next Steps to Extend

### Easy (1-2 hours)
- [ ] Create Material Master edit page
- [ ] Create Vendor Master pages (list + create + edit)
- [ ] Add detail view modal for material reviews

### Medium (2-4 hours)
- [ ] Excel import with preview
- [ ] PDF export functionality
- [ ] Bulk edit/delete operations

### Advanced (4+ hours)
- [ ] Analytics dashboard with Recharts
- [ ] Email notifications
- [ ] Role-based access control
- [ ] Advanced search with full-text search
- [ ] Dashboard widgets

---

## 📚 Documentation Files

**In project root:**
- `MODULE3_SETUP.md` - Database setup SQL
- `MODULE3_REFERENCE.md` - Comprehensive reference
- `MODULE3_IMPLEMENTATION.md` - Complete implementation details
- `MODULE3_QUICK_START.md` - This file

---

## ✅ Verification Checklist

After setup, verify:
- [ ] Can navigate to `/dashboard/pqr/[id]/materials`
- [ ] See 8 summary stat cards
- [ ] Data table loads (or shows "No materials")
- [ ] Can click "Add Material" and form opens
- [ ] Required fields are marked with *
- [ ] Form validates on submit
- [ ] Can see Material Master at `/dashboard/master/materials`
- [ ] See 7 default materials pre-loaded
- [ ] Can create/edit/delete materials

If any step fails:
1. Check Supabase tables are created
2. Verify environment variables are set
3. Check browser console for error messages
4. Review error toast notifications

---

## 🎓 Learning Path

**If new to this codebase:**
1. Read this quick start file
2. Look at `material-schemas.ts` - understand the data shape
3. Look at `compliance-logic.ts` - understand business logic
4. Look at `compliance-summary-cards.tsx` - understand UI
5. Try creating a material review manually
6. Read `MODULE3_REFERENCE.md` for deep dive

**If extending features:**
1. Start with `material-service.ts` - add new query
2. Create new page using existing pages as template
3. Import components and services you need
4. Add Zod validation for new fields
5. Test thoroughly before deploying

---

**Quick Links:**
- 📖 [Full Reference](MODULE3_REFERENCE.md)
- 🛠️ [Setup Guide](MODULE3_SETUP.md)
- 📋 [Implementation Details](MODULE3_IMPLEMENTATION.md)
- 💻 [Source Code](lib/material-schemas.ts)

**Status**: ✅ Ready to Use
**Version**: 1.0
**Last Updated**: 2024
