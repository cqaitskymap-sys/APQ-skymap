# Firebase Migration Guide

## Overview
This project has been migrated from Supabase to Firebase. This guide documents all changes made and provides templates for any remaining file updates.

## Files Changed

### 1. **lib/firebase.ts** (NEW)
- Created centralized Firebase configuration
- Exports: `auth`, `firestore`, `storage`
- Contains all TypeScript interfaces and types (moved from lib/supabase.ts)
- Configuration uses environment variables for all settings

### 2. **lib/firestore-service.ts** (NEW)
- Generic CRUD operations for Firestore
- Functions: `createRecord`, `getRecord`, `getRecords`, `updateRecord`, `deleteRecord`, `recordExists`
- Use this for simple operations on any collection

### 3. **lib/material-service.ts** (UPDATED)
- Replaced all Supabase queries with Firestore equivalents
- Uses Firestore SDK: `collection`, `doc`, `getDoc`, `getDocs`, `addDoc`, `updateDoc`, `deleteDoc`, `query`, `where`, `orderBy`, `writeBatch`
- All CRUD operations updated
- Client-side filtering for text search (Firestore limitation for complex queries)

### 4. **contexts/auth-context.tsx** (UPDATED)
- Replaced Supabase Auth with Firebase Authentication
- Uses: `signInWithEmailAndPassword`, `signUpWithEmailAndPassword`, `signOut`, `onAuthStateChanged`
- Profile data stored in Firestore `profiles` collection instead of Supabase

### 5. **package.json** (UPDATED)
- Removed: `@supabase/supabase-js`
- Added: `firebase: ^10.7.2`

### 6. **.env** (UPDATED)
- Removed: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Added: All Firebase environment variables (prefixed with `NEXT_PUBLIC_FIREBASE_`)

### 7. **app/dashboard/pqr/page.tsx** (UPDATED)
- Replaced: `import { supabase } from '@/lib/supabase'`
- With: `import { firestore } from '@/lib/firebase'` and Firestore functions
- Updated `fetchDocuments()` to use Firestore query

### 8. **app/dashboard/master/materials/page.tsx** (UPDATED)
- Replaced all Supabase calls with Firestore equivalents
- Updated: `fetchMaterials()`, `handleSave()`, `handleDelete()`
- Uses `collection`, `getDocs`, `query`, `orderBy`, `updateDoc`, `deleteDoc`

## Files Pending Update
The following files still have Supabase imports and need to be updated:

### Dashboard Pages
- `app/dashboard/pqr/[id]/page.tsx`
- `app/dashboard/pqr/[id]/edit/page.tsx`
- `app/dashboard/pqr/[id]/batches/page.tsx`
- `app/dashboard/pqr/[id]/batches/create/page.tsx`
- `app/dashboard/pqr/[id]/batches/[batchid]/edit/page.tsx`
- `app/dashboard/pqr/create/page.tsx`
- `app/dashboard/pqr/[id]/materials/page.tsx`
- `app/dashboard/pqr/[id]/materials/create/page.tsx`
- `app/dashboard/pqr/[id]/materials/api/page.tsx`
- `app/dashboard/pqr/[id]/materials/raw-material/page.tsx`
- `app/dashboard/master/product/page.tsx`
- `app/dashboard/master/vendors/page.tsx`
- `app/dashboard/master/abbreviations/page.tsx`

## Migration Patterns

### Pattern 1: SELECT Query
**Supabase:**
```typescript
const { data } = await supabase
  .from('table_name')
  .select('*')
  .eq('column', value)
  .order('created_at', { ascending: false });
```

**Firebase (Firestore):**
```typescript
const q = query(
  collection(firestore, 'table_name'),
  where('column', '==', value),
  orderBy('created_at', 'desc')
);
const querySnapshot = await getDocs(q);
const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
```

### Pattern 2: INSERT Query
**Supabase:**
```typescript
const { data, error } = await supabase
  .from('table_name')
  .insert([{ field1: value1, field2: value2 }])
  .select()
  .single();
```

**Firebase (Firestore):**
```typescript
const docRef = await addDoc(collection(firestore, 'table_name'), {
  field1: value1,
  field2: value2,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
```

### Pattern 3: UPDATE Query
**Supabase:**
```typescript
const { data, error } = await supabase
  .from('table_name')
  .update({ field1: newValue })
  .eq('id', recordId)
  .select()
  .single();
```

**Firebase (Firestore):**
```typescript
await updateDoc(doc(firestore, 'table_name', recordId), {
  field1: newValue,
  updatedAt: new Date().toISOString(),
});
```

### Pattern 4: DELETE Query
**Supabase:**
```typescript
const { error } = await supabase
  .from('table_name')
  .delete()
  .eq('id', recordId);
```

**Firebase (Firestore):**
```typescript
await deleteDoc(doc(firestore, 'table_name', recordId));
```

### Pattern 5: Text Search (ILIKE)
**Supabase:**
```typescript
query = query.ilike('column', `%${searchTerm}%`);
```

**Firebase (Firestore) - Client-side:**
```typescript
// Fetch all records, then filter client-side
const filtered = data.filter(record =>
  record.column?.toLowerCase().includes(searchTerm.toLowerCase())
);
```

### Pattern 6: Multiple Conditions
**Supabase:**
```typescript
const { data } = await supabase
  .from('table_name')
  .select('*')
  .eq('status', 'active')
  .eq('type', 'api')
  .order('code', { ascending: true });
```

**Firebase (Firestore):**
```typescript
const q = query(
  collection(firestore, 'table_name'),
  where('status', '==', 'active'),
  where('type', '==', 'api'),
  orderBy('code', 'asc')
);
const querySnapshot = await getDocs(q);
const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
```

## Key Differences

| Feature | Supabase | Firebase |
|---------|----------|----------|
| Auth | Supabase Auth (PostgreSQL) | Firebase Authentication |
| Database | PostgreSQL (relational) | Firestore (NoSQL, document-based) |
| Real-time | Built-in subscriptions | Firestore listeners |
| Storage | Supabase Storage | Firebase Storage |
| Imports | `from '@supabase/supabase-js'` | `from 'firebase/...'` |
| Query Builder | `.select()`, `.eq()`, `.ilike()` | `query()`, `where()`, `orderBy()` |
| Transactions | Available | `writeBatch()` or transaction API |

## Important Notes

1. **Document IDs**: Firebase auto-generates document IDs. If you need specific IDs, set them explicitly with `setDoc()`

2. **Timestamps**: Firestore recommends using server timestamps. Use `serverTimestamp()` for better consistency:
   ```typescript
   import { serverTimestamp } from 'firebase/firestore';
   await updateDoc(docRef, { updatedAt: serverTimestamp() });
   ```

3. **Text Searches**: Firestore doesn't support case-insensitive searches. Implement client-side filtering or use Firestore full-text search extensions

4. **Batch Operations**: Use `writeBatch()` for atomic multi-document updates:
   ```typescript
   const batch = writeBatch(firestore);
   batch.set(doc1, data1);
   batch.update(doc2, data2);
   batch.delete(doc3);
   await batch.commit();
   ```

5. **Error Handling**: Firebase throws errors directly, not in a `.error` property. Wrap calls in try-catch

6. **Null Values**: Firestore returns `null` for missing collections, not an error

## Testing Checklist

- [ ] Build passes: `npm run build`
- [ ] No TypeScript errors
- [ ] Login/authentication works
- [ ] Dashboard loads and displays data
- [ ] Create new PQR works
- [ ] Edit/update PQR works
- [ ] Delete records works
- [ ] Filter and search works
- [ ] Material Master CRUD works
- [ ] Vendor Master CRUD works

## Next Steps

1. Update remaining dashboard pages using the patterns above
2. Verify all CRUD operations work with Firestore
3. Test authentication flows
4. Run build and tests
5. Deploy to production

## Removed Files

- `lib/supabase.ts` - Can be deleted (functionality moved to `lib/firebase.ts`)
- `supabase/` directory - Can be deleted (no longer needed)
