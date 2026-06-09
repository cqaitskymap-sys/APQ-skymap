# Firebase Migration - Commands & Quick Start

## Installation Commands

### Step 1: Install Firebase Dependency
```bash
cd "d:\😁PATRI😁\PQR ORIGINAL"
npm install
```

### Step 2: Verify Build
```bash
npm run build
```

### Step 3: Type Checking
```bash
npm run typecheck
```

---

## Project Structure After Migration

```
d:\😁PATRI😁\PQR ORIGINAL
│
├── lib/
│   ├── firebase.ts                 ✅ NEW (Firebase config & types)
│   ├── firestore-service.ts        ✅ NEW (Generic CRUD)
│   ├── material-service.ts         ✅ UPDATED (Firestore queries)
│   └── supabase.ts                 ⚠️ OLD (Can delete after verification)
│
├── contexts/
│   └── auth-context.tsx            ✅ UPDATED (Firebase Auth)
│
├── app/
│   ├── auth/
│   │   └── login/page.tsx          ✅ (No changes needed - uses auth context)
│   │
│   └── dashboard/
│       ├── pqr/
│       │   ├── page.tsx            ✅ UPDATED
│       │   ├── create/page.tsx     ⚠️ PENDING
│       │   ├── [id]/
│       │   │   ├── page.tsx        ⚠️ PENDING
│       │   │   ├── edit/page.tsx   ⚠️ PENDING
│       │   │   ├── batches/
│       │   │   │   ├── page.tsx    ⚠️ PENDING
│       │   │   │   ├── create/page.tsx ⚠️ PENDING
│       │   │   │   └── [batchid]/
│       │   │   │       └── edit/page.tsx ⚠️ PENDING
│       │   │   └── materials/
│       │   │       ├── page.tsx    ⚠️ PENDING
│       │   │       ├── create/page.tsx ⚠️ PENDING
│       │   │       ├── api/page.tsx ⚠️ PENDING
│       │   │       └── raw-material/page.tsx ⚠️ PENDING
│       │
│       └── master/
│           ├── materials/page.tsx  ✅ UPDATED
│           ├── vendors/page.tsx    ✅ UPDATED
│           ├── product/page.tsx    ⚠️ PENDING
│           └── abbreviations/page.tsx ⚠️ PENDING
│
├── .env                            ✅ UPDATED (Firebase variables)
├── package.json                    ✅ UPDATED (Firebase added)
│
└── Migration Guides/
    ├── FIREBASE_MIGRATION_GUIDE.md ✅ Reference
    ├── FIREBASE_MIGRATION_SUMMARY.md ✅ Overview
    ├── FIREBASE_MIGRATION_REPORT.md ✅ Detailed Report
    ├── REMAINING_PAGES_UPDATE_GUIDE.md ✅ Implementation Guide
    ├── MIGRATION_COMPLETE.md       ✅ Complete Summary
    └── MIGRATION_COMMANDS.md       ✅ This File
```

---

## Quick Start Guide

### For Development

```bash
# 1. Install dependencies
npm install

# 2. Verify types
npm run typecheck

# 3. Build project
npm run build

# 4. Start development server
npm run dev

# 5. Open browser
# Navigate to http://localhost:3000
```

### For Testing

```bash
# Test login page
npm run dev
# Go to: http://localhost:3000/auth/login

# Test materials page
# Go to: http://localhost:3000/dashboard/master/materials

# Test vendors page
# Go to: http://localhost:3000/dashboard/master/vendors

# Test PQR list
# Go to: http://localhost:3000/dashboard/pqr
```

---

## Migration Completion Checklist

### Phase 1: Preparation (5 min)
- [ ] Read this guide
- [ ] Review REMAINING_PAGES_UPDATE_GUIDE.md
- [ ] Have VS Code open with project
- [ ] Have Firebase console open in browser

### Phase 2: Update Remaining Pages (45 min)
For each of 12 pending pages:
- [ ] Open file
- [ ] Replace Supabase import with Firebase import
- [ ] Update fetch functions using provided patterns
- [ ] Update create/update/delete functions
- [ ] Save file

**Estimated:** 3-4 minutes per page × 12 pages

### Phase 3: Build & Verify (15 min)
- [ ] Run `npm install`
- [ ] Run `npm run build`
- [ ] Run `npm run typecheck`
- [ ] Fix any errors
- [ ] Verify no TypeScript issues

### Phase 4: Testing (30 min)
- [ ] Test login/logout
- [ ] Test each CRUD operation
- [ ] Test search/filter
- [ ] Check Firebase console for data

### Phase 5: Deployment (15 min)
- [ ] Create production build
- [ ] Deploy to hosting
- [ ] Verify production works

**Total Time: ~2 hours**

---

## Troubleshooting Commands

### Check Node and NPM versions
```bash
node --version   # Should be v16+
npm --version    # Should be v8+
```

### Clear node_modules and reinstall
```bash
rm -r node_modules
rm package-lock.json
npm install
```

### Check for Supabase imports still in codebase
```bash
# PowerShell (Windows):
Select-String -Path "*.tsx" -Pattern "supabase" -Recurse

# Bash (Mac/Linux):
grep -r "supabase" --include="*.tsx" --include="*.ts"
```

### Verify Firebase is imported correctly
```bash
# Check if firebase.ts exports are accessible
# Run in Node:
```

### Force TypeScript recheck
```bash
npm run typecheck -- --force
```

### Check build output
```bash
npm run build -- --debug
```

---

## File-by-File Update Guide

### Update One Page (Example)

**File:** `app/dashboard/master/product/page.tsx`

**Step 1: Find and Replace Import**
```typescript
// FIND:
import { supabase } from '@/lib/supabase';

// REPLACE WITH:
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
```

**Step 2: Update Fetch Function**
```typescript
// FIND:
const fetchProducts = async () => {
  const { data } = await supabase.from('products').select('*').order('product_code');
  if (data) setProducts(data);
};

// REPLACE WITH:
const fetchProducts = async () => {
  try {
    const q = query(collection(firestore, 'products'), orderBy('product_code', 'asc'));
    const querySnapshot = await getDocs(q);
    const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setProducts(data);
  } catch (error) {
    console.error('Error fetching products:', error);
  }
};
```

**Step 3: Update Create/Update**
```typescript
// FIND:
const { error } = await supabase.from('products').insert(form);

// REPLACE WITH:
try {
  const ref = doc(collection(firestore, 'products'));
  await setDoc(ref, form);
} catch (error) {
  console.error('Error creating product:', error);
}
```

**Step 4: Update Delete**
```typescript
// FIND:
const { error } = await supabase.from('products').delete().eq('id', id);

// REPLACE WITH:
try {
  await deleteDoc(doc(firestore, 'products', id));
} catch (error) {
  console.error('Error deleting product:', error);
}
```

---

## Automated Find & Replace (Using VS Code)

### Step 1: Open Find & Replace
```
Ctrl+H (Windows)
Cmd+Option+F (Mac)
```

### Step 2: Search for Pattern
```
import { supabase } from '@/lib/supabase'
```

### Step 3: Identify Matches
- Should find 13 matches (1 already updated in materials/vendors)

### Step 4: Create Replacement
Create a new file with all Firebase imports and copy-paste into each file

---

## Environment Setup Verification

### Verify Firebase Config
```bash
# Check if .env exists
ls -la | grep .env

# Check Firebase config
cat .env | grep FIREBASE
```

### Expected Output
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyC0O8J9_1eYUt4__QQ4INv_H1U9sBrzJBU
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=apq-skymap.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=apq-skymap
... (8 variables total)
```

---

## Common Issues & Solutions

### Issue: "firebase is not defined"
**Solution:**
```bash
npm install firebase
npm run build
```

### Issue: "Cannot find module '@/lib/firebase'"
**Solution:**
1. Verify `lib/firebase.ts` exists
2. Check tsconfig.json for path alias
3. Restart VS Code

### Issue: "supabase is not defined"
**Solution:**
- Search for remaining Supabase imports using grep command above
- Replace all imports with Firebase equivalents

### Issue: Build fails with TypeScript errors
**Solution:**
```bash
npm run typecheck 2>&1 | head -20
# Find first error and fix
# Then rebuild
npm run build
```

### Issue: Firestore query errors
**Solution:**
1. Check collection names match Firestore console
2. Verify document structure
3. Use try-catch for debugging

---

## Next Commands to Run

### Immediate
```bash
# 1. Install dependencies
npm install

# 2. Verify no build errors
npm run build

# 3. Check types
npm run typecheck

# 4. Update remaining 12 pages (using guide)
# (Manual step - 45 minutes)

# 5. Rebuild after updates
npm run build

# 6. Start dev server for testing
npm run dev
```

### For Production
```bash
# Create optimized build
npm run build

# Deploy to hosting
# (Your deployment commands here)
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] All pages updated to use Firebase
- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors: `npm run typecheck`
- [ ] All tests pass
- [ ] No console errors when running dev server

### Deployment
```bash
# For Vercel
npm run build  # Auto-deploys on git push

# For Netlify
npm run build  # Deploy ./out directory

# For Docker
docker build -t pqr:latest .
docker run -p 3000:3000 pqr:latest
```

### Post-Deployment
- [ ] Test login in production
- [ ] Verify data loads from Firebase
- [ ] Check Firebase console metrics
- [ ] Monitor error logs

---

## Performance Check

```bash
# Check bundle size
npm run build
# Look for "Compiled successfully"

# Test performance in dev
npm run dev
# Use Chrome DevTools: Lighthouse
```

---

## Backup & Rollback

### Before Starting Migration Completion
```bash
# Create backup branch
git checkout -b backup/before-firebase-complete

# Commit current state
git add .
git commit -m "Backup: Before completing Firebase migration"
```

### If Rollback Needed
```bash
git checkout main
git reset --hard backup/before-firebase-complete
```

---

## Summary Commands

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Build | `npm run build` |
| Type check | `npm run typecheck` |
| Dev server | `npm run dev` |
| Check Supabase refs | `grep -r "supabase" --include="*.tsx"` |
| Clear cache | `rm -rf .next node_modules` |

---

## Support

- **Documentation:** See FIREBASE_MIGRATION_GUIDE.md
- **Templates:** See REMAINING_PAGES_UPDATE_GUIDE.md
- **Issues:** Check TROUBLESHOOTING.md
- **Firebase Docs:** https://firebase.google.com/docs

---

**Last Updated:** June 6, 2026
**Status:** Ready to Execute
**Estimated Completion Time:** 2 hours
