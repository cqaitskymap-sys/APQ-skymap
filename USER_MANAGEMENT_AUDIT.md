# SkyMap Admin → User Management — Implementation Report

## Scope

Existing User Management module audited and hardened (not rewritten). Routes covered:

- `/admin/users` — list, filters, bulk actions, realtime updates
- `/admin/users/create` — create user
- `/admin/users/[id]` — profile / activity / permissions / audit / sessions
- `/admin/users/[id]/edit` — governed edit with change reason
- `/dashboard/profile` — self-service profile, password change, email verification
- `/dashboard/admin/users` — redirects to `/admin/users`

Firebase project: `apq-skymap` · Firestore `(default)` Standard / Native · `nam5`

---

## 1. Bugs Found

| # | Severity | Issue |
|---|----------|--------|
| 1 | Critical | User updates and permission overrides could commit separately (partial access state) |
| 2 | Critical | Locked users could remain Auth-enabled when edited as Active |
| 3 | High | Unlock always forced status to Active |
| 4 | High | Profile self-edit only updated `profiles` (users + Auth displayName went stale) |
| 5 | High | No password change path; `passwordResetRequired` never cleared after reset |
| 6 | High | Login/session history never written to `login_activity` |
| 7 | Medium | `fetchUserById` scanned entire users collection |
| 8 | Medium | Silent empty results masked Firestore errors |
| 9 | Medium | Legacy snake_case / lowercase status records rendered incorrectly |
| 10 | Medium | Reporting manager was free text (no hierarchy validation) |
| 11 | Medium | Soft-deleted users could not be restored |
| 12 | Low | Double semicolon / typo on user detail page; weak create password policy (8 vs 12) |
| 13 | Low | Permission matrix tab visible/editable for non–Super Admin |

## 2. Bugs Fixed

All items above addressed:

- Privileged create/update/permission writes go through Cloud Functions in one batch
- Auth `disabled` derived from status + lock + retirement
- `statusBeforeLock` preserved and restored on unlock
- `updateOwnUserProfile` syncs profile + users + Auth
- Profile password change with reauth + `recordOwnPasswordChange`
- Session open/close on login/logout
- Document-scoped user fetch + realtime list subscription
- Normalization at service boundary
- Manager picker + cycle detection server-side
- Restore retired users to Inactive

## 3. Missing Features Added

- Enterprise user fields (employee code, name parts, alternate mobile, username, gender, DOB, site, business unit, location, shift, employment type, remarks, etc.)
- Soft delete (Retire) + Restore
- Bulk activate / deactivate / lock / unlock / retire / restore with mandatory reason
- Sort, include-retired toggle, deferred search
- Change-reason required for edit and status actions
- Password policy (12+ chars, upper/lower/number/special)
- Duplicate employee ID / username checks (server)
- Email verification send + refresh sync
- Idle session timeout logout
- JWT `active` claim check in middleware after privilege revocation
- User notifications for create/update/role/lock/etc.

## 4. Missing Pages Created

No new top-level module. Detail view gained in-page tabs (Profile, Activity, Permissions, Audit Trail, Session History) instead of separate broken routes.

Related self-service: password change + email verification on `/dashboard/profile`.

## 5. Missing Components Created

No new standalone component packages. Extended:

- `UserForm` — full identity/org sections, password + change reason
- `UserDetailView` — tabbed profile/activity/permissions/audit/sessions
- `UsersListPage` — bulk actions, retire/restore, realtime, accessibility

## 6. Backend Improvements

- `lib/admin/user-service.ts` — normalize, subscribe, restore, targeted queries, callable-only mutations
- `lib/admin/schemas.ts` — expanded Zod schema + password create rules
- `lib/auth.ts` — login_activity write/close
- `contexts/auth-context.tsx` — idle timeout
- `middleware.ts` — deny tokens with `active: false`
- Profile page uses callables for profile/password/email verification sync

## 7. Firebase Improvements

Callables (compile successfully; **deploy requires billing + Cloud Functions API**):

- `createAdminUser`
- `updateAdminUser`
- `updateOwnUserProfile`
- `recordOwnPasswordChange`
- `syncOwnEmailVerification`
- (existing) `auditPendingUserRegistration`

On role/lock/disable: refresh tokens revoked; custom claims include `role` + `active`.

## 8. Firestore Improvements

- `users` client write denied (function-only)
- Explicit `login_activity` rules (own session create/update)
- Indexes for login_activity, audit_trail by documentId, audit_logs by recordId
- Composite query support for user detail activity/audit panels

## 9. Cloud Function Improvements

- Master validation (department, designation, site, manager)
- Hierarchy cycle detection
- Permission matrix shape validation (Super Admin only)
- Atomic batch: users + profiles + permissions + audit + notification
- Field allowlists, phone/date/HTTPS photo validation
- Mandatory change reason (≥8 chars) on updates

## 10. Security Improvements

- RBAC on routes/buttons (`canViewUsers` / `canEditUsers` + Admin permission matrix)
- No self status/role escalation
- Only Super Admin assigns admin roles or custom permission overrides
- Soft delete retains audit evidence
- Part 11–aligned attributable reasons on governed changes
- Immutable audit trail writes; update/delete denied in rules

## 11. Performance Improvements

- Realtime list via `onSnapshot` (no full reload after every silent poll)
- Document get for detail instead of full collection scan
- Indexed login/audit queries with limits
- `useDeferredValue` for search typing
- Diff-only update payloads to Cloud Function

## 12. UI/UX Improvements

- Structured create/edit form sections
- Detail tabs for Profile / Activity / Permissions / Audit / Sessions
- KPI cards, filters, sort, export, bulk bar
- Aria-labels on icon actions; loading skeletons; button loading states
- Dark/light compatible reason panels and status badges

## 13. Compliance Improvements

Aligned toward FDA 21 CFR Part 11 / EU Annex 11 / ALCOA+ practices:

- Unique identity + authenticated actions
- Attributable change reasons
- Immutable audit events
- Access control + session timeout
- Electronic signature ecosystem unchanged but user access events are auditable
- Soft delete preserves records for inspection

**Note:** Formal IQ/OQ/PQ and QA release remain customer responsibilities before regulated production use.

## 14. Files Modified (User Management focus)

- `app/admin/users/create/page.tsx`
- `app/admin/users/[id]/page.tsx`
- `app/admin/users/[id]/edit/page.tsx`
- `app/dashboard/profile/page.tsx`
- `components/admin/users/user-form.tsx`
- `components/admin/users/user-detail-view.tsx`
- `components/admin/users/users-list-page.tsx`
- `components/admin/users/user-access-guard.tsx`
- `lib/admin/user-service.ts`
- `lib/admin/schemas.ts`
- `lib/admin/constants.ts`
- `lib/auth.ts`
- `contexts/auth-context.tsx`
- `middleware.ts`
- `functions/src/index.ts`
- `firestore.rules`
- `firestore.indexes.json`

## 15. Files Created

- `USER_MANAGEMENT_AUDIT.md` (this report)

## 16. Build Status

| Check | Status |
|-------|--------|
| `npm run type-check` | Pass |
| `npm run lint` (`--max-warnings=0`) | Pass |
| `functions` `npm run build` (`tsc`) | Pass |
| `npm run build` (Next.js) | Pass (538 static pages, ~13.7 min) |

## Deployment prerequisites (blocking live callables)

1. Enable billing on Firebase project `apq-skymap`
2. Enable Cloud Functions API
3. Deploy: `firebase deploy --only functions,firestore:rules,firestore:indexes`
4. Role-by-role UAT (Super Admin → Viewer)
5. Complete regulated validation (IQ/OQ/PQ) before GxP production

## Known limitations (not bugs in this module)

- Bulk CSV import/create of users is not implemented (export exists; create remains one-by-one + bulk status actions)
- Concurrent-session hard limit is not enforced in Auth (idle timeout + token revoke on privilege change are)
- Two-factor flag is stored; full MFA enrollment UX is outside this module
- Live Cloud Function endpoints are unavailable until billing/API enablement
