# Remaining Pages Update Instructions

## Quick Copy-Paste Guide for 12 Remaining Pages

Each page in this list needs the SAME modifications. Follow these 3 steps:

### STEP 1: Update Import
**Replace this line:**
```typescript
import { supabase } from '@/lib/supabase';
```

**With these lines:**
```typescript
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where, orderBy, QueryConstraint } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
```

### STEP 2: Update fetchData Functions
Use one of these patterns based on your query type:

**Pattern A: Simple List with Ordering**
```typescript
// BEFORE:
const fetchData = async () => {
  const { data } = await supabase.from('table_name').select('*').order('field', { ascending: false });
  setData(data);
};

// AFTER:
const fetchData = async () => {
  try {
    const q = query(collection(firestore, 'table_name'), orderBy('field', 'desc'));
    const querySnapshot = await getDocs(q);
    const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setData(data);
  } catch (error) {
    console.error('Error fetching:', error);
  }
};
```

**Pattern B: With Filters**
```typescript
// BEFORE:
const fetchData = async () => {
  const { data } = await supabase
    .from('table_name')
    .select('*')
    .eq('status', 'active')
    .eq('type', 'api')
    .order('code', { ascending: true });
  setData(data);
};

// AFTER:
const fetchData = async () => {
  try {
    const q = query(
      collection(firestore, 'table_name'),
      where('status', '==', 'active'),
      where('type', '==', 'api'),
      orderBy('code', 'asc')
    );
    const querySnapshot = await getDocs(q);
    const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setData(data);
  } catch (error) {
    console.error('Error fetching:', error);
  }
};
```

**Pattern C: Single Record**
```typescript
// BEFORE:
const { data } = await supabase.from('table_name').select('*').eq('id', recordId).single();

// AFTER:
const docSnap = await getDoc(doc(firestore, 'table_name', recordId));
const data = docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
```

### STEP 3: Update Create/Update/Delete

**For CREATE:**
```typescript
// BEFORE:
const { error } = await supabase.from('table_name').insert(formData);

// AFTER:
try {
  const docRef = doc(collection(firestore, 'table_name'));
  await setDoc(docRef, formData);
} catch (error) {
  console.error('Error creating record:', error);
}
```

**For UPDATE:**
```typescript
// BEFORE:
const { error } = await supabase.from('table_name').update(updates).eq('id', recordId);

// AFTER:
try {
  await updateDoc(doc(firestore, 'table_name', recordId), updates);
} catch (error) {
  console.error('Error updating record:', error);
}
```

**For DELETE:**
```typescript
// BEFORE:
const { error } = await supabase.from('table_name').delete().eq('id', recordId);

// AFTER:
try {
  await deleteDoc(doc(firestore, 'table_name', recordId));
} catch (error) {
  console.error('Error deleting record:', error);
}
```

---

## Pages to Update (Copy-Paste Ready)

### 1. app/dashboard/pqr/[id]/page.tsx
- Replace: `import { supabase } from '@/lib/supabase'`
- Add Firebase imports above
- Update all `.from('pqr_records').select()`  calls
- Update all `.from('batches').select()` calls
- Table names: `pqr_records`, `batches`

### 2. app/dashboard/pqr/[id]/edit/page.tsx
- Follow same pattern as above
- Tables: `pqr_records`
- Update form submission to use `updateDoc`

### 3. app/dashboard/pqr/[id]/batches/page.tsx
- Tables: `batches`
- Fetch batches where `pqr_id == paramId`
- Use `where('pqr_id', '==', pqrId)` in query

### 4. app/dashboard/pqr/[id]/batches/create/page.tsx
- Table: `batches`
- Create new batch with form data
- Include: `pqr_id`, `created_at`, `updated_at`

### 5. app/dashboard/pqr/[id]/batches/[batchid]/edit/page.tsx
- Table: `batches`
- Fetch single batch by ID
- Update using form data

### 6. app/dashboard/pqr/create/page.tsx
- Table: `pqr_records`
- Create with current user ID
- Set status to 'draft' by default

### 7. app/dashboard/pqr/[id]/materials/page.tsx
- Table: `pqr_materials` or `material_review`
- Fetch where `pqr_id == paramId`
- Include filtering by type, status

### 8. app/dashboard/pqr/[id]/materials/create/page.tsx
- Table: `pqr_materials` or `material_review`
- Create with `pqr_id` relation

### 9. app/dashboard/pqr/[id]/materials/api/page.tsx
- Table: `api_materials`
- Fetch for specific PQR

### 10. app/dashboard/pqr/[id]/materials/raw-material/page.tsx
- Table: `raw_materials`
- Fetch for specific PQR

### 11. app/dashboard/master/product/page.tsx
- Table: `products`
- Similar to materials.tsx page
- All CRUD operations

### 12. app/dashboard/master/abbreviations/page.tsx
- Table: `abbreviations`
- Simple CRUD without complex queries

---

## Batch Update Approach

To update all 12 pages quickly:

1. Search and replace in your editor:
   - Find: `import { supabase } from '@/lib/supabase';`
   - Replace with Firebase import block above

2. For each page, find its main data fetch function and apply the appropriate pattern

3. Search for:
   - `supabase.from(` and replace with Firestore equivalents
   - `.select()`, `.eq()`, `.insert()`, `.update()`, `.delete()`

4. Test each page after updating

---

## Automated Replace Examples

If your editor supports regex find-replace:

**Find Supabase queries:**
```
supabase\.from\('([^']+)'\)\.select\(\)
```

**Replace pattern (manual completion needed):**
```
query(collection(firestore, '$1'))
```

---

## Testing After Update

For each page you update:

1. ✅ Page loads without errors
2. ✅ Data displays correctly
3. ✅ Create/Edit/Delete functions work
4. ✅ Filters and search work
5. ✅ No console errors

---

## Common Issues & Fixes

**Issue: "supabase is not defined"**
- Fix: Make sure you imported firebase properly at the top

**Issue: "Cannot read property of undefined"**
- Fix: Check that you're converting Firestore docs to objects correctly:
  ```typescript
  { id: doc.id, ...doc.data() }
  ```

**Issue: "Query constraint can't be used in a query"**
- Fix: Ensure you're using `where()` before `orderBy()` in the constraints array

**Issue: "Document not found"**
- Fix: Use `getDoc()` and check `docSnap.exists()` before accessing data

---

Total estimated time: 30-45 minutes for all 12 pages
