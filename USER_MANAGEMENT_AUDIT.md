# SkyMap Admin User Management Audit

## Scope and environment

- Existing routes reviewed: `/admin/users`, `/admin/users/create`, `/admin/users/[id]`,
  `/admin/users/[id]/edit`, and `/dashboard/profile`.
- Firebase project: `apq-skymap`.
- Firestore database: `(default)`, Standard edition, Native mode, `nam5`.
- Realtime updates are enabled. Point-in-time recovery and database delete protection are
  currently disabled.
- The Cloud Functions API is disabled and project billing is not enabled. The updated
  callable functions therefore require project provisioning and deployment before the live
  application can use them.

## Data model

Governed user directory records are stored in `users`; authentication-facing profiles are
stored in `profiles/{authUid}`. Firebase Authentication remains the identity authority.
User-specific permission overrides are stored in `user_permissions`, login sessions in
`login_activity`, and immutable events in `audit_trail`/`audit_logs`.

The normalized user record supports identity, contact, organization, employment, access,
status, provenance, and integration fields. Legacy snake_case profile-backed records are
normalized at the service boundary.

## Material findings addressed

1. User updates and permission overrides could commit separately, leaving partially updated
   access. Permission writes are now performed by the callable function in the same Firestore
   batch as the user/profile/audit/notification writes.
2. `userStatus: Active` took precedence over `accountLocked`, allowing an edited locked user
   to remain enabled in Firebase Authentication. Disabled state is now derived from status,
   lock, and retirement together.
3. Unlocking always changed a locked user to Active. The pre-lock state is now retained and
   restored, defaulting safely to Inactive for legacy records.
4. Profile edits only changed `profiles`; the governed `users` directory and Firebase Auth
   display name became stale. `updateOwnUserProfile` now synchronizes all three.
5. Password changes were absent and the forced-reset flag could never be cleared. Password
   change now requires reauthentication, enforces complexity, and records a server audit event.
6. Login/session history was never written. Successful sessions now create an attributable
   `login_activity` record and close it on explicit logout.
7. List/detail reads silently converted backend errors into empty results, and details loaded
   the complete directory. Detail reads are now document-scoped and user-list updates are
   realtime.
8. Legacy lowercase statuses and snake_case identity fields produced incorrect list/detail
   values. Records are normalized before rendering.
9. Reporting manager was free text. It now references an active user and server validation
   rejects self-reference and hierarchy cycles.
10. Retired users could not be restored. Administrators can include retired records and restore
    them to an inactive state.

## Security-rules attack review

- Public list exploit: denied because `users`, `profiles`, permissions, sessions, and audit
  collections require authenticated role/ownership checks.
- Unauthorized user write: denied; all client creates/updates/deletes under `users` are false.
- Self-role/status escalation: denied in the callable function and profile self-update field
  allowlist.
- Administrative role assignment: only an active Super Admin can assign Super Admin/Admin.
- Schema pollution: callable functions copy an allowlist and validate string sizes, roles,
  statuses, masters, manager references, and permission matrix shape.
- Mixed-content exposure: governed directory PII is restricted to authorized administrative
  directory roles; ordinary users only read their own profile or specifically authorized
  departmental directory profiles.
- Audit mutation: audit updates/deletes are denied.
- Session spoofing: users may create only their own successful session record and may update
  only logout/status timestamps.
- Ownership and hierarchy hijacking: manager IDs must reference active user records, cannot
  reference self, and cannot create a cycle within the supported depth.
- Direct URL access: protected routes require a verified Firebase JWT; newly issued tokens with
  `active: false` are denied. Firestore independently checks the active profile on every data
  operation.

Security Rules syntax validation passes. Emulator-based adversarial integration tests and
independent security review are still required before regulated production release.

## Deployment and validation prerequisites

1. Enable billing and the Cloud Functions API for `apq-skymap`.
2. Deploy the compiled callable functions.
3. Deploy `firestore.rules` and `firestore.indexes.json`.
4. Execute role-by-role emulator tests for Super Admin, Admin, QA/QC, HR, training coordinator,
   document controller, department head, employee, auditor, vendor, and viewer.
5. Complete IQ/OQ/PQ, SOP approval, access review, backup/restore testing, and QA release.
