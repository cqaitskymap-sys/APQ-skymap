/**
 * Firebase Cloud Functions — scheduled effective date activation.
 *
 * Deploy: cd functions && npm install && npm run deploy
 * Requires EFFECTIVE_DATE_API_URL and EFFECTIVE_DATE_CRON_SECRET env config.
 *
 * Alternative: call POST /api/dms/effective-date/activate from Cloud Scheduler directly.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

function initializeAdmin() {
  if (getApps().length === 0) initializeApp();
}

function requiredString(value: unknown, field: string, maxLength = 200): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpsError('invalid-argument', `${field} is required`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new HttpsError('invalid-argument', `${field} exceeds ${maxLength} characters`);
  }
  return normalized;
}

function optionalString(value: unknown, field: string, maxLength = 200): string {
  if (value == null) return '';
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', `${field} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new HttpsError('invalid-argument', `${field} exceeds ${maxLength} characters`);
  }
  return normalized;
}

function validatedPhone(value: unknown, field: string): string {
  const phone = optionalString(value, field, 40);
  if (phone && !/^\+?[\d\s\-()]{10,20}$/.test(phone)) {
    throw new HttpsError('invalid-argument', `${field} is invalid`);
  }
  return phone;
}

function validatedDate(value: unknown, field: string, mustBePast = false): string {
  const date = optionalString(value, field, 10);
  if (!date) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new HttpsError('invalid-argument', `${field} must be a valid date`);
  }
  if (mustBePast && date >= new Date().toISOString().slice(0, 10)) {
    throw new HttpsError('invalid-argument', `${field} must be in the past`);
  }
  return date;
}

const ADMIN_USER_ROLES = [
  'super_admin', 'admin', 'qa', 'qc', 'production', 'engineering', 'warehouse',
  'regulatory', 'head_qa', 'qa_manager', 'qa_executive',
  'qc_manager', 'qc_executive', 'production_manager', 'production_executive',
  'warehouse_manager', 'warehouse_executive', 'engineering_manager',
  'engineering_executive', 'regulatory_affairs', 'hr', 'training_coordinator',
  'document_controller', 'department_head', 'employee', 'auditor', 'vendor', 'viewer',
] as const;

const ADMIN_USER_STATUSES = ['Active', 'Inactive', 'Locked', 'Suspended', 'Pending Approval'] as const;

function validatePermissionMatrix(value: unknown): Record<string, Record<string, boolean>> | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', 'modulePermissions must be an object');
  }
  const modules = Object.entries(value as Record<string, unknown>);
  if (modules.length > 60) {
    throw new HttpsError('invalid-argument', 'Too many permission modules');
  }

  return modules.reduce<Record<string, Record<string, boolean>>>((matrix, [moduleName, actions]) => {
    if (!moduleName || moduleName.length > 100 || typeof actions !== 'object' || !actions || Array.isArray(actions)) {
      throw new HttpsError('invalid-argument', 'Invalid permission module');
    }
    const actionEntries = Object.entries(actions as Record<string, unknown>);
    if (actionEntries.length > 40 || actionEntries.some(([name, allowed]) =>
      !name || name.length > 80 || typeof allowed !== 'boolean')) {
      throw new HttpsError('invalid-argument', 'Invalid permission action');
    }
    matrix[moduleName] = actionEntries.reduce<Record<string, boolean>>((result, [name, allowed]) => {
      result[name] = allowed as boolean;
      return result;
    }, {});
    return matrix;
  }, {});
}

async function validateUserMasterAssignments(
  firestore: Firestore,
  input: Record<string, unknown>,
  targetUserId?: string,
) {
  const department = optionalString(input.department, 'department', 160);
  if (department) {
    const departments = await firestore.collection('departments')
      .where('departmentName', '==', department)
      .limit(10)
      .get();
    const hasActiveDepartment = departments.docs.some((document) =>
      document.data().isDeleted !== true
      && String(document.data().status || 'Active').toLowerCase() === 'active');
    if (!hasActiveDepartment) {
      throw new HttpsError('failed-precondition', 'Department is missing or inactive');
    }
  }

  const designation = optionalString(input.designation, 'designation', 160);
  if (designation) {
    let designationQuery = firestore.collection('designations')
      .where('designationName', '==', designation);
    if (department) {
      designationQuery = designationQuery.where('department', '==', department);
    }
    const designations = await designationQuery.limit(10).get();
    const hasActiveDesignation = designations.docs.some((document) => {
      const record = document.data();
      return record.isDeleted !== true
        && String(record.status || 'Active').toLowerCase() === 'active'
        && (!department || !record.department || record.department === department);
    });
    if (!hasActiveDesignation) {
      throw new HttpsError('failed-precondition', 'Designation is missing, inactive, or outside the selected department');
    }
  }

  const siteId = optionalString(input.siteId, 'siteId', 128);
  if (siteId) {
    const site = await firestore.collection('company_sites').doc(siteId).get();
    const siteData = site.data();
    if (!site.exists || site.data()?.isDeleted === true
      || String(site.data()?.status || 'Active').toLowerCase() !== 'active') {
      throw new HttpsError('failed-precondition', 'Site is missing or inactive');
    }
    const siteName = optionalString(input.siteName, 'siteName', 200);
    const businessUnit = optionalString(input.businessUnit, 'businessUnit', 160);
    if (siteName && siteData?.siteName && siteName !== siteData.siteName) {
      throw new HttpsError('invalid-argument', 'Site name does not match the selected site');
    }
    if (businessUnit && siteData?.companyName && businessUnit !== siteData.companyName) {
      throw new HttpsError('invalid-argument', 'Business unit does not match the selected site');
    }
  }

  const managerId = optionalString(input.managerId, 'managerId', 128);
  if (managerId) {
    if (managerId === targetUserId) {
      throw new HttpsError('invalid-argument', 'A user cannot report to themselves');
    }
    const manager = await firestore.collection('users').doc(managerId).get();
    const managerData = manager.data();
    if (!manager.exists || managerData?.isDeleted === true
      || String(managerData?.userStatus || managerData?.status || '').toLowerCase() !== 'active') {
      throw new HttpsError('failed-precondition', 'Reporting manager is missing or inactive');
    }
    if (targetUserId) {
      let ancestorId = optionalString(managerData?.managerId, 'managerId', 128);
      const visited = new Set([managerId]);
      for (let depth = 0; ancestorId && depth < 25; depth += 1) {
        if (ancestorId === targetUserId) {
          throw new HttpsError('failed-precondition', 'Reporting manager assignment would create a hierarchy cycle');
        }
        if (visited.has(ancestorId)) {
          throw new HttpsError('failed-precondition', 'The selected reporting hierarchy already contains a cycle');
        }
        visited.add(ancestorId);
        const ancestor = await firestore.collection('users').doc(ancestorId).get();
        if (!ancestor.exists) break;
        ancestorId = optionalString(ancestor.data()?.managerId, 'managerId', 128);
      }
      if (ancestorId) {
        throw new HttpsError('failed-precondition', 'Reporting hierarchy exceeds the supported depth');
      }
    }
  }
}

function userNotification(
  targetUid: string,
  recordId: string,
  eventName: string,
  title: string,
  message: string,
  now: string,
) {
  return {
    notificationId: `NTF-${Date.now().toString(36).toUpperCase()}-${recordId.slice(0, 6)}`,
    userId: targetUid,
    recipientUserId: targetUid,
    title,
    message,
    type: 'info',
    moduleName: 'User Management',
    eventName,
    recordId,
    priority: 'High',
    notificationChannel: 'In-App',
    readStatus: 'Unread',
    sentStatus: 'Sent',
    isRead: false,
    actionLink: '/dashboard/profile',
    createdAt: now,
    readAt: null,
    readBy: [],
    readAtBy: {},
  };
}

/**
 * Creates an authentication account without replacing the administrator's browser session.
 * Authorization and privileged writes are enforced server-side.
 */
export const createAdminUser = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentication required');

  initializeAdmin();
  const firestore = getFirestore();
  const actorSnapshot = await firestore.collection('profiles').doc(request.auth.uid).get();
  const actor = actorSnapshot.data();
  const actorRole = String(actor?.role || '');
  if (!actorSnapshot.exists || actor?.is_active !== true || !['super_admin', 'admin'].includes(actorRole)) {
    throw new HttpsError('permission-denied', 'Active administrator access required');
  }

  const input = request.data as Record<string, unknown>;
  const email = requiredString(input.email, 'email', 320).toLowerCase();
  const password = requiredString(input.temporaryPassword, 'temporaryPassword', 128);
  const employeeId = requiredString(input.employeeId, 'employeeId', 80);
  const fullName = requiredString(input.fullName, 'fullName');
  const department = requiredString(input.department, 'department');
  const role = requiredString(input.role, 'role', 80);
  const username = optionalString(input.username, 'username', 80).toLowerCase();
  const requestedStatus = ADMIN_USER_STATUSES.includes(input.userStatus as typeof ADMIN_USER_STATUSES[number])
    ? input.userStatus as typeof ADMIN_USER_STATUSES[number]
    : 'Active';
  const accountLocked = Boolean(input.accountLocked) || requestedStatus === 'Locked';
  const userStatus = accountLocked ? 'Locked' : requestedStatus;
  const modulePermissions = validatePermissionMatrix(input.modulePermissions);
  const presetId = optionalString(input.presetId, 'presetId', 100);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'A valid email is required');
  }
  if (!ADMIN_USER_ROLES.includes(role as typeof ADMIN_USER_ROLES[number])) {
    throw new HttpsError('invalid-argument', 'Unsupported role');
  }
  if (['super_admin', 'admin'].includes(role) && actorRole !== 'super_admin') {
    throw new HttpsError('permission-denied', 'Only a Super Admin can assign an administrative role');
  }
  if (modulePermissions && actorRole !== 'super_admin') {
    throw new HttpsError('permission-denied', 'Only a Super Admin can assign user-specific permissions');
  }
  if (!['', 'Female', 'Male', 'Non-binary', 'Prefer not to say'].includes(String(input.gender || ''))) {
    throw new HttpsError('invalid-argument', 'Invalid gender');
  }
  if (!['Permanent', 'Contract', 'Temporary', 'Consultant', 'Vendor', 'Intern']
    .includes(String(input.employmentType || 'Permanent'))) {
    throw new HttpsError('invalid-argument', 'Invalid employment type');
  }
  const profilePhoto = optionalString(input.profilePhoto, 'profilePhoto', 2048);
  if (profilePhoto && !/^https:\/\//i.test(profilePhoto)) {
    throw new HttpsError('invalid-argument', 'Profile picture URL must use HTTPS');
  }
  if (
    password.length < 12
    || !/[A-Z]/.test(password)
    || !/[a-z]/.test(password)
    || !/\d/.test(password)
    || !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new HttpsError(
      'invalid-argument',
      'Temporary password must be at least 12 characters and include upper, lower, number, and special characters',
    );
  }

  await validateUserMasterAssignments(firestore, input);

  const [duplicateEmployee, duplicateUsername] = await Promise.all([
    firestore.collection('users').where('employeeId', '==', employeeId).limit(1).get(),
    username
      ? firestore.collection('users').where('username', '==', username).limit(1).get()
      : Promise.resolve(null),
  ]);
  if (!duplicateEmployee.empty) {
    throw new HttpsError('already-exists', 'Employee ID already exists');
  }
  if (duplicateUsername && !duplicateUsername.empty) {
    throw new HttpsError('already-exists', 'Username already exists');
  }

  let createdUid: string | undefined;
  try {
    const authUser = await getAuth().createUser({
      email,
      password,
      displayName: fullName,
      disabled: userStatus !== 'Active' || accountLocked,
      photoURL: profilePhoto || undefined,
    });
    createdUid = authUser.uid;
    await getAuth().setCustomUserClaims(authUser.uid, {
      role,
      active: userStatus === 'Active' && !accountLocked,
    });

    const now = new Date().toISOString();
    const userRef = firestore.collection('users').doc();
    const profileRef = firestore.collection('profiles').doc(authUser.uid);
    const auditRef = firestore.collection('audit_logs').doc();
    const notificationRef = firestore.collection('notifications').doc();
    const userRecord = {
      employeeId,
      employeeCode: optionalString(input.employeeCode, 'employeeCode', 80),
      firstName: optionalString(input.firstName, 'firstName', 100),
      middleName: optionalString(input.middleName, 'middleName', 100),
      lastName: optionalString(input.lastName, 'lastName', 100),
      fullName,
      email,
      mobileNumber: validatedPhone(input.mobileNumber, 'mobileNumber'),
      alternateMobile: validatedPhone(input.alternateMobile, 'alternateMobile'),
      username,
      profilePhoto,
      gender: optionalString(input.gender, 'gender', 40),
      dateOfBirth: validatedDate(input.dateOfBirth, 'dateOfBirth', true),
      department,
      designation: optionalString(input.designation, 'designation', 160),
      role,
      reportingManager: optionalString(input.reportingManager, 'reportingManager'),
      managerId: optionalString(input.managerId, 'managerId', 128),
      businessUnit: optionalString(input.businessUnit, 'businessUnit', 160),
      siteId: optionalString(input.siteId, 'siteId', 128),
      siteName: optionalString(input.siteName, 'siteName', 200),
      location: optionalString(input.location, 'location', 240),
      shift: optionalString(input.shift, 'shift', 80),
      employmentType: optionalString(input.employmentType, 'employmentType', 80) || 'Permanent',
      userStatus,
      statusBeforeLock: accountLocked ? requestedStatus === 'Locked' ? 'Inactive' : requestedStatus : null,
      status: userStatus === 'Active' ? 'Active' : 'Inactive',
      accountLocked,
      passwordResetRequired: true,
      twoFactorEnabled: Boolean(input.twoFactorEnabled),
      joiningDate: validatedDate(input.joiningDate, 'joiningDate'),
      remarks: optionalString(input.remarks, 'remarks', 2000),
      emailVerified: authUser.emailVerified,
      authUid: authUser.uid,
      userId: `USR-${employeeId}`,
      isDeleted: false,
      createdBy: request.auth.uid,
      updatedBy: request.auth.uid,
      createdAt: now,
      updatedAt: now,
    };

    const batch = firestore.batch();
    batch.create(userRef, userRecord);
    batch.create(profileRef, {
      id: authUser.uid,
      full_name: fullName,
      email,
      role,
      department,
      employee_id: employeeId,
      phone: userRecord.mobileNumber,
      avatar_url: userRecord.profilePhoto,
      is_active: userRecord.userStatus === 'Active' && !userRecord.accountLocked,
      access_status: userRecord.accountLocked ? 'locked'
        : userRecord.userStatus === 'Active' ? 'approved' : 'disabled',
      designation: userRecord.designation,
      manager_id: userRecord.managerId,
      site_id: userRecord.siteId,
      business_unit: userRecord.businessUnit,
      last_login: null,
      created_at: now,
      updated_at: now,
    });
    batch.create(auditRef, {
      userId: request.auth.uid,
      userName: String(actor?.full_name || actor?.email || 'Administrator'),
      module: 'User Management',
      recordId: userRef.id,
      action: 'CREATE_USER',
      oldValue: '',
      newValue: JSON.stringify({ employeeId, email, role, department }),
      reason: 'Administrator-created user',
      ipAddress: request.rawRequest.ip || 'server',
      device: request.rawRequest.get('user-agent') || 'unknown',
      status: 'Success',
      dateTime: now,
    });
    batch.create(notificationRef, userNotification(
      authUser.uid,
      userRef.id,
      'USER_CREATED',
      'Your SkyMap account was created',
      'An administrator created your account. Complete the required password reset before use.',
      now,
    ));
    if (modulePermissions || presetId) {
      const permissionRef = firestore.collection('user_permissions').doc(authUser.uid);
      batch.set(permissionRef, {
        userId: authUser.uid,
        roleId: role,
        modulePermissions: modulePermissions || {},
        customPermissions: modulePermissions || {},
        presetId,
        isDeleted: false,
        createdAt: now,
        createdBy: request.auth.uid,
        updatedAt: now,
        updatedBy: request.auth.uid,
      });
    }
    await batch.commit();

    return { id: userRef.id, ...userRecord };
  } catch (error) {
    if (createdUid) {
      await getAuth().deleteUser(createdUid).catch((rollbackError) => {
        logger.error('Failed to roll back partially created user', { createdUid, rollbackError });
      });
    }
    if (error instanceof HttpsError) throw error;
    const code = (error as { code?: string }).code;
    if (code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Email already exists');
    }
    logger.error('createAdminUser failed', error);
    throw new HttpsError('internal', 'Unable to create user');
  }
});

export const updateAdminUser = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentication required');
  initializeAdmin();

  const firestore = getFirestore();
  const actorSnap = await firestore.collection('profiles').doc(request.auth.uid).get();
  const actor = actorSnap.data();
  if (!actorSnap.exists || actor?.is_active !== true || !['super_admin', 'admin'].includes(actor?.role)) {
    throw new HttpsError('permission-denied', 'Administrator access required');
  }

  const userId = requiredString(request.data?.userId, 'userId', 128);
  const requestedUpdates = request.data?.updates;
  if (!requestedUpdates || typeof requestedUpdates !== 'object' || Array.isArray(requestedUpdates)) {
    throw new HttpsError('invalid-argument', 'updates must be an object');
  }

  const userRef = firestore.collection('users').doc(userId);
  const targetSnap = await userRef.get();
  if (!targetSnap.exists) throw new HttpsError('not-found', 'User not found');
  const target = targetSnap.data() || {};
  if (actor?.role !== 'super_admin' && ['super_admin', 'admin'].includes(target.role)) {
    throw new HttpsError('permission-denied', 'Only a Super Admin can modify an administrative account');
  }

  const allowedFields = [
    'employeeId', 'employeeCode', 'firstName', 'middleName', 'lastName',
    'fullName', 'email', 'mobileNumber', 'alternateMobile', 'username',
    'profilePhoto', 'gender', 'dateOfBirth', 'department', 'designation', 'role',
    'reportingManager', 'managerId', 'businessUnit', 'siteId', 'siteName',
    'location', 'shift', 'employmentType', 'joiningDate', 'remarks',
    'userStatus', 'status', 'statusBeforeLock', 'accountLocked', 'isDeleted',
    'passwordResetRequired', 'twoFactorEnabled',
  ];
  const updates = Object.entries(requestedUpdates as Record<string, unknown>)
    .reduce<Record<string, unknown>>((result, [key, value]) => {
      if (allowedFields.includes(key)) result[key] = value;
      return result;
    }, {});
  const hasPermissionPayload = Object.prototype.hasOwnProperty.call(request.data || {}, 'modulePermissions')
    || Object.prototype.hasOwnProperty.call(request.data || {}, 'presetId');
  if (Object.keys(updates).length === 0 && !hasPermissionPayload) {
    throw new HttpsError('invalid-argument', 'No supported updates supplied');
  }
  const reason = requiredString(request.data?.reason, 'reason', 1000);
  if (reason.length < 8) {
    throw new HttpsError('invalid-argument', 'A meaningful change reason is required');
  }
  const modulePermissions = validatePermissionMatrix(request.data?.modulePermissions);
  const presetId = optionalString(request.data?.presetId, 'presetId', 100);
  if ((modulePermissions || presetId) && actor?.role !== 'super_admin') {
    throw new HttpsError('permission-denied', 'Only a Super Admin can change user-specific permissions');
  }

  if (typeof updates.role === 'string') {
    const nextRole = requiredString(updates.role, 'role', 80);
    updates.role = nextRole;
    if (!ADMIN_USER_ROLES.includes(nextRole as typeof ADMIN_USER_ROLES[number])) {
      throw new HttpsError('invalid-argument', 'Invalid role');
    }
    if (['super_admin', 'admin'].includes(nextRole) && actor?.role !== 'super_admin') {
      throw new HttpsError('permission-denied', 'Only a Super Admin can assign an administrative role');
    }
  }
  if (typeof updates.email === 'string') {
    const normalizedEmail = requiredString(updates.email, 'email', 320).toLowerCase();
    updates.email = normalizedEmail;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new HttpsError('invalid-argument', 'A valid email is required');
    }
  }
  if (typeof updates.employeeId === 'string') {
    const employeeId = requiredString(updates.employeeId, 'employeeId', 80);
    const duplicate = await firestore.collection('users')
      .where('employeeId', '==', employeeId)
      .limit(2)
      .get();
    if (duplicate.docs.some((doc) => doc.id !== userId)) {
      throw new HttpsError('already-exists', 'Employee ID already exists');
    }
    updates.employeeId = employeeId;
  }
  if (typeof updates.username === 'string') {
    const username = optionalString(updates.username, 'username', 80).toLowerCase();
    if (username && !/^[a-zA-Z0-9._-]+$/.test(username)) {
      throw new HttpsError('invalid-argument', 'Invalid username');
    }
    if (username) {
      const duplicate = await firestore.collection('users')
        .where('username', '==', username)
        .limit(2)
        .get();
      if (duplicate.docs.some((document) => document.id !== userId)) {
        throw new HttpsError('already-exists', 'Username already exists');
      }
    }
    updates.username = username;
  }
  if (
    typeof updates.userStatus === 'string'
    && !ADMIN_USER_STATUSES.includes(updates.userStatus as typeof ADMIN_USER_STATUSES[number])
  ) {
    throw new HttpsError('invalid-argument', 'Invalid user status');
  }

  const stringLimits: Record<string, number> = {
    employeeCode: 80, firstName: 100, middleName: 100, lastName: 100,
    fullName: 200, mobileNumber: 40, alternateMobile: 40, profilePhoto: 2048,
    gender: 40, dateOfBirth: 10, department: 160, designation: 160,
    reportingManager: 200, managerId: 128, businessUnit: 160, siteId: 128,
    siteName: 200, location: 240, shift: 80, employmentType: 80,
    joiningDate: 10, remarks: 2000,
  };
  Object.entries(stringLimits).forEach(([field, maxLength]) => {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      updates[field] = optionalString(updates[field], field, maxLength);
    }
  });
  if (Object.prototype.hasOwnProperty.call(updates, 'fullName')) {
    updates.fullName = requiredString(updates.fullName, 'fullName', 200);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'department')) {
    updates.department = requiredString(updates.department, 'department', 160);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'mobileNumber')) {
    updates.mobileNumber = validatedPhone(updates.mobileNumber, 'mobileNumber');
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'alternateMobile')) {
    updates.alternateMobile = validatedPhone(updates.alternateMobile, 'alternateMobile');
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'dateOfBirth')) {
    updates.dateOfBirth = validatedDate(updates.dateOfBirth, 'dateOfBirth', true);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'joiningDate')) {
    updates.joiningDate = validatedDate(updates.joiningDate, 'joiningDate');
  }
  if (
    Object.prototype.hasOwnProperty.call(updates, 'gender')
    && !['', 'Female', 'Male', 'Non-binary', 'Prefer not to say'].includes(String(updates.gender))
  ) {
    throw new HttpsError('invalid-argument', 'Invalid gender');
  }
  if (
    Object.prototype.hasOwnProperty.call(updates, 'employmentType')
    && !['Permanent', 'Contract', 'Temporary', 'Consultant', 'Vendor', 'Intern']
      .includes(String(updates.employmentType))
  ) {
    throw new HttpsError('invalid-argument', 'Invalid employment type');
  }
  if (
    typeof updates.profilePhoto === 'string'
    && updates.profilePhoto
    && !/^https:\/\//i.test(updates.profilePhoto)
  ) {
    throw new HttpsError('invalid-argument', 'Profile picture URL must use HTTPS');
  }

  if (['department', 'designation', 'siteId', 'managerId'].some((field) =>
    Object.prototype.hasOwnProperty.call(updates, field))) {
    await validateUserMasterAssignments(firestore, { ...target, ...updates }, userId);
  }

  const authUid = String(target.authUid || userId);
  if (
    authUid === request.auth.uid
    && ['role', 'userStatus', 'status', 'accountLocked', 'isDeleted']
      .some((field) => Object.prototype.hasOwnProperty.call(updates, field))
  ) {
    throw new HttpsError('failed-precondition', 'You cannot change your own access or account status');
  }
  const authUserBefore = await getAuth().getUser(authUid);
  const previousDisabled = authUserBefore.disabled;
  const requestedNextStatus = String(updates.userStatus ?? target.userStatus ?? target.status ?? 'Inactive');
  const nextLocked = Boolean(updates.accountLocked ?? target.accountLocked) || requestedNextStatus === 'Locked';
  const nextStatus = nextLocked ? 'Locked' : requestedNextStatus;
  if (nextStatus !== target.userStatus) updates.userStatus = nextStatus;
  if (nextLocked !== Boolean(target.accountLocked)) updates.accountLocked = nextLocked;
  updates.status = nextStatus === 'Active' ? 'Active' : 'Inactive';
  const nextDeleted = Boolean(updates.isDeleted ?? target.isDeleted);
  const nextDisabled = nextStatus !== 'Active' || nextLocked || nextDeleted;
  const previousEmail = authUserBefore.email || String(target.email || '');
  const nextEmail = typeof updates.email === 'string' ? updates.email.trim().toLowerCase() : previousEmail;

  try {
    await getAuth().updateUser(authUid, {
      email: nextEmail || undefined,
      disabled: nextDisabled,
      displayName: typeof updates.fullName === 'string' ? updates.fullName.trim() : undefined,
      photoURL: typeof updates.profilePhoto === 'string' ? updates.profilePhoto || null : undefined,
    });
    const accessClaimsChanged = typeof updates.role === 'string' || nextDisabled !== previousDisabled;
    if (accessClaimsChanged) {
      await getAuth().setCustomUserClaims(authUid, {
        ...authUserBefore.customClaims,
        role: updates.role ?? target.role ?? 'viewer',
        active: !nextDisabled,
      });
    }

    const now = new Date().toISOString();
    const profileRef = firestore.collection('profiles').doc(authUid);
    const auditRef = firestore.collection('audit_trail').doc();
    const notificationRef = firestore.collection('notifications').doc();
    const batch = firestore.batch();
    batch.update(userRef, { ...updates, email: nextEmail, updatedAt: now, updatedBy: request.auth.uid });
    batch.set(profileRef, {
      full_name: updates.fullName ?? target.fullName ?? '',
      email: nextEmail,
      role: updates.role ?? target.role ?? 'viewer',
      department: updates.department ?? target.department ?? '',
      employee_id: updates.employeeId ?? target.employeeId ?? '',
      phone: updates.mobileNumber ?? target.mobileNumber ?? '',
      avatar_url: updates.profilePhoto ?? target.profilePhoto ?? '',
      is_active: !nextDisabled,
      access_status: nextDeleted ? 'retired' : nextLocked ? 'locked' : nextDisabled ? 'disabled' : 'approved',
      designation: updates.designation ?? target.designation ?? '',
      manager_id: updates.managerId ?? target.managerId ?? '',
      site_id: updates.siteId ?? target.siteId ?? '',
      business_unit: updates.businessUnit ?? target.businessUnit ?? '',
      updated_at: now,
    }, { merge: true });

    const changedFields = Object.keys(updates);
    let auditAction = 'UPDATE_USER';
    if (modulePermissions || presetId) auditAction = 'PERMISSION_CHANGE';
    if (updates.department !== undefined && updates.department !== target.department) auditAction = 'DEPARTMENT_CHANGE';
    if (updates.role !== undefined && updates.role !== target.role) auditAction = 'ROLE_CHANGE';
    if (updates.userStatus === 'Active' && target.userStatus !== 'Active') auditAction = 'ACTIVATE_USER';
    if (updates.userStatus === 'Inactive' && target.userStatus === 'Active') auditAction = 'DEACTIVATE_USER';
    if (updates.accountLocked === true && target.accountLocked !== true) auditAction = 'LOCK_USER';
    if (updates.accountLocked === false && target.accountLocked === true) auditAction = 'UNLOCK_USER';
    if (updates.isDeleted === true && target.isDeleted !== true) auditAction = 'RETIRE_USER';
    if (updates.isDeleted === false && target.isDeleted === true) auditAction = 'RESTORE_USER';
    if (updates.passwordResetRequired === true && target.passwordResetRequired !== true) {
      auditAction = 'PASSWORD_RESET';
    }
    if (request.data?.action === 'PASSWORD_RESET' && updates.passwordResetRequired === true) {
      auditAction = 'PASSWORD_RESET';
    }

    batch.create(auditRef, {
      userId: request.auth.uid,
      userName: String(actor?.full_name || actor?.email || 'Administrator'),
      collectionName: 'users',
      documentId: userId,
      moduleName: 'User Management',
      module: 'User Management',
      recordId: userId,
      action: auditAction,
      oldValue: JSON.stringify(target),
      newValue: JSON.stringify({ ...target, ...updates, email: nextEmail }),
      changedFields,
      reason,
      ipAddress: request.rawRequest.ip || 'server',
      device: request.rawRequest.get('user-agent') || 'unknown',
      status: 'Success',
      dateTime: now,
      timestamp: now,
    });

    const notificationTitles: Record<string, string> = {
      ROLE_CHANGE: 'Your role was changed',
      PERMISSION_CHANGE: 'Your permissions were changed',
      DEPARTMENT_CHANGE: 'Your department was changed',
      ACTIVATE_USER: 'Your account was activated',
      DEACTIVATE_USER: 'Your account was deactivated',
      LOCK_USER: 'Your account was locked',
      UNLOCK_USER: 'Your account was unlocked',
      RETIRE_USER: 'Your account was retired',
      RESTORE_USER: 'Your account record was restored',
      PASSWORD_RESET: 'Password reset requested',
      UPDATE_USER: 'Your user profile was updated',
    };
    batch.create(notificationRef, userNotification(
      authUid,
      userId,
      auditAction,
      notificationTitles[auditAction] || 'Your account was updated',
      `An administrator updated your account. Reason: ${reason}`,
      now,
    ));

    if (hasPermissionPayload) {
      const permissionQuery = await firestore.collection('user_permissions')
        .where('userId', '==', authUid)
        .limit(1)
        .get();
      const permissionRef = permissionQuery.empty
        ? firestore.collection('user_permissions').doc(authUid)
        : permissionQuery.docs[0].ref;
      batch.set(permissionRef, {
        userId: authUid,
        roleId: updates.role ?? target.role ?? 'viewer',
        modulePermissions: modulePermissions || {},
        customPermissions: modulePermissions || {},
        presetId,
        isDeleted: false,
        updatedAt: now,
        updatedBy: request.auth.uid,
        ...(permissionQuery.empty ? { createdAt: now, createdBy: request.auth.uid } : {}),
      }, { merge: true });
    }
    await batch.commit();
    if (accessClaimsChanged) {
      await getAuth().revokeRefreshTokens(authUid)
        .catch((revokeError) => logger.error('Failed to revoke changed user sessions', revokeError));
    }
    return { id: userId, ...target, ...updates, email: nextEmail, updatedAt: now };
  } catch (error) {
    await getAuth().updateUser(authUid, {
      email: previousEmail || undefined,
      disabled: previousDisabled,
      displayName: authUserBefore.displayName || undefined,
      photoURL: authUserBefore.photoURL || null,
    }).then(async () => {
      if (typeof updates.role === 'string' || nextDisabled !== previousDisabled) {
        await getAuth().setCustomUserClaims(authUid, authUserBefore.customClaims || {});
      }
    }).catch((rollbackError) => logger.error('Failed to roll back Auth user update', rollbackError));
    if (error instanceof HttpsError) throw error;
    const code = (error as { code?: string }).code;
    if (code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Email already exists');
    }
    if (code === 'auth/user-not-found') {
      throw new HttpsError('not-found', 'Authentication account not found');
    }
    logger.error('updateAdminUser failed', error);
    throw new HttpsError('internal', 'Unable to update user');
  }
});

export const updateOwnUserProfile = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentication required');
  initializeAdmin();

  const firestore = getFirestore();
  const profileRef = firestore.collection('profiles').doc(request.auth.uid);
  const profileSnapshot = await profileRef.get();
  const profile = profileSnapshot.data();
  if (!profileSnapshot.exists || profile?.is_active !== true || profile?.access_status === 'pending') {
    throw new HttpsError('permission-denied', 'An active account is required');
  }

  const fullName = requiredString(request.data?.fullName, 'fullName', 200);
  const phone = optionalString(request.data?.phone, 'phone', 40);
  const usersByAuthUid = await firestore.collection('users')
    .where('authUid', '==', request.auth.uid)
    .limit(1)
    .get();
  const fallbackUserRef = firestore.collection('users').doc(request.auth.uid);
  const fallbackUser = usersByAuthUid.empty ? await fallbackUserRef.get() : null;
  const userRef = !usersByAuthUid.empty
    ? usersByAuthUid.docs[0].ref
    : fallbackUser?.exists ? fallbackUserRef : null;

  const authBefore = await getAuth().getUser(request.auth.uid);
  const now = new Date().toISOString();
  try {
    await getAuth().updateUser(request.auth.uid, { displayName: fullName });
    const batch = firestore.batch();
    batch.update(profileRef, { full_name: fullName, phone, updated_at: now });
    if (userRef) {
      batch.update(userRef, {
        fullName,
        mobileNumber: phone,
        updatedAt: now,
        updatedBy: request.auth.uid,
      });
    }
    batch.create(firestore.collection('audit_trail').doc(), {
      collectionName: 'profiles',
      documentId: request.auth.uid,
      action: 'PROFILE_UPDATE',
      oldValue: { fullName: profile.full_name || '', phone: profile.phone || '' },
      newValue: { fullName, phone },
      userId: request.auth.uid,
      userName: fullName,
      moduleName: 'Profile',
      source: 'cloud-function',
      reason: 'User updated own contact profile',
      ipAddress: request.rawRequest.ip || 'server',
      device: request.rawRequest.get('user-agent') || 'unknown',
      timestamp: now,
    });
    await batch.commit();
    return { fullName, phone, updatedAt: now };
  } catch (error) {
    await getAuth().updateUser(request.auth.uid, {
      displayName: authBefore.displayName || undefined,
    }).catch((rollbackError) => logger.error('Failed to roll back profile display name', rollbackError));
    if (error instanceof HttpsError) throw error;
    logger.error('updateOwnUserProfile failed', error);
    throw new HttpsError('internal', 'Unable to update profile');
  }
});

export const recordOwnPasswordChange = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentication required');
  const authenticatedAt = Number(request.auth.token.auth_time || 0) * 1000;
  if (!authenticatedAt || Date.now() - authenticatedAt > 5 * 60_000) {
    throw new HttpsError('failed-precondition', 'Recent authentication is required');
  }
  initializeAdmin();

  const firestore = getFirestore();
  const profile = await firestore.collection('profiles').doc(request.auth.uid).get();
  if (!profile.exists || profile.data()?.is_active !== true) {
    throw new HttpsError('permission-denied', 'An active account is required');
  }
  const usersByAuthUid = await firestore.collection('users')
    .where('authUid', '==', request.auth.uid)
    .limit(1)
    .get();
  const fallbackRef = firestore.collection('users').doc(request.auth.uid);
  const fallback = usersByAuthUid.empty ? await fallbackRef.get() : null;
  const userRef = !usersByAuthUid.empty
    ? usersByAuthUid.docs[0].ref
    : fallback?.exists ? fallbackRef : null;
  const now = new Date().toISOString();
  const batch = firestore.batch();
  if (userRef) {
    batch.update(userRef, {
      passwordResetRequired: false,
      passwordChangedAt: now,
      updatedAt: now,
      updatedBy: request.auth.uid,
    });
  }
  batch.create(firestore.collection('audit_trail').doc(), {
    collectionName: 'users',
    documentId: userRef?.id || request.auth.uid,
    action: 'PASSWORD_CHANGE',
    oldValue: null,
    newValue: { passwordChanged: true },
    userId: request.auth.uid,
    userName: String(profile.data()?.full_name || profile.data()?.email || 'User'),
    moduleName: 'Auth',
    source: 'cloud-function',
    reason: 'User changed own password after reauthentication',
    ipAddress: request.rawRequest.ip || 'server',
    device: request.rawRequest.get('user-agent') || 'unknown',
    timestamp: now,
  });
  await batch.commit();
  return { success: true };
});

export const syncOwnEmailVerification = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentication required');
  initializeAdmin();

  const authUser = await getAuth().getUser(request.auth.uid);
  if (!authUser.emailVerified) return { verified: false };
  const firestore = getFirestore();
  const profileRef = firestore.collection('profiles').doc(request.auth.uid);
  const profile = await profileRef.get();
  if (!profile.exists || profile.data()?.is_active !== true) {
    throw new HttpsError('permission-denied', 'An active account is required');
  }
  if (profile.data()?.email_verified === true) return { verified: true };

  const usersByAuthUid = await firestore.collection('users')
    .where('authUid', '==', request.auth.uid)
    .limit(1)
    .get();
  const fallbackRef = firestore.collection('users').doc(request.auth.uid);
  const fallback = usersByAuthUid.empty ? await fallbackRef.get() : null;
  const userRef = !usersByAuthUid.empty
    ? usersByAuthUid.docs[0].ref
    : fallback?.exists ? fallbackRef : null;
  const now = new Date().toISOString();
  const batch = firestore.batch();
  batch.update(profileRef, { email_verified: true, updated_at: now });
  if (userRef) {
    batch.update(userRef, {
      emailVerified: true,
      updatedAt: now,
      updatedBy: request.auth.uid,
    });
  }
  batch.create(firestore.collection('audit_trail').doc(), {
    collectionName: 'users',
    documentId: userRef?.id || request.auth.uid,
    action: 'EMAIL_VERIFIED',
    oldValue: { emailVerified: false },
    newValue: { emailVerified: true },
    userId: request.auth.uid,
    userName: String(profile.data()?.full_name || profile.data()?.email || 'User'),
    moduleName: 'Auth',
    source: 'cloud-function',
    reason: 'Firebase Authentication email verification confirmed',
    timestamp: now,
  });
  await batch.commit();
  return { verified: true };
});

export const auditPendingUserRegistration = onDocumentCreated('profiles/{userId}', async (event) => {
  initializeAdmin();
  const profile = event.data?.data();
  if (!profile || profile.is_active !== false || profile.access_status !== 'pending') return;

  await getFirestore().collection('audit_trail').add({
    collectionName: 'profiles',
    documentId: event.params.userId,
    action: 'REGISTER',
    oldValue: null,
    newValue: {
      email: profile.email || '',
      requestedRole: profile.requested_role || 'viewer',
      accessStatus: 'pending',
    },
    userId: event.params.userId,
    userName: profile.full_name || profile.email || 'Pending User',
    moduleName: 'Auth',
    source: 'cloud-function',
    timestamp: new Date().toISOString(),
  });
});

const cronSecret = defineSecret('EFFECTIVE_DATE_CRON_SECRET');
const apiUrl = defineSecret('EFFECTIVE_DATE_API_URL');

export const scheduledEffectiveDateActivation = onSchedule(
  {
    schedule: 'every day 00:05',
    timeZone: 'UTC',
    secrets: [cronSecret, apiUrl],
  },
  async () => {
    const url = apiUrl.value() || process.env.EFFECTIVE_DATE_API_URL;
    const secret = cronSecret.value() || process.env.EFFECTIVE_DATE_CRON_SECRET;
    if (!url) {
      logger.error('EFFECTIVE_DATE_API_URL not configured');
      return;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const body = await res.json();
    logger.info('Effective date activation completed', body);
  },
);

const prmCronSecret = defineSecret('PERIODIC_REVIEW_CRON_SECRET');
const prmApiUrl = defineSecret('PERIODIC_REVIEW_API_URL');

export const scheduledPeriodicReviewJobs = onSchedule(
  {
    schedule: 'every day 06:00',
    timeZone: 'UTC',
    secrets: [prmCronSecret, prmApiUrl],
  },
  async () => {
    const url = prmApiUrl.value() || process.env.PERIODIC_REVIEW_API_URL;
    const secret = prmCronSecret.value() || process.env.PERIODIC_REVIEW_CRON_SECRET;
    if (!url) {
      logger.error('PERIODIC_REVIEW_API_URL not configured');
      return;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const body = await res.json();
    logger.info('Periodic review scheduler completed', body);
  },
);

const dtlCronSecret = defineSecret('TRAINING_LINKAGE_CRON_SECRET');
const dtlApiUrl = defineSecret('TRAINING_LINKAGE_API_URL');

export const scheduledTrainingLinkageJobs = onSchedule(
  {
    schedule: 'every day 07:00',
    timeZone: 'UTC',
    secrets: [dtlCronSecret, dtlApiUrl],
  },
  async () => {
    const url = dtlApiUrl.value() || process.env.TRAINING_LINKAGE_API_URL;
    const secret = dtlCronSecret.value() || process.env.TRAINING_LINKAGE_CRON_SECRET;
    if (!url) {
      logger.error('TRAINING_LINKAGE_API_URL not configured');
      return;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const body = await res.json();
    logger.info('Training linkage scheduler completed', body);
  },
);

const ciaCronSecret = defineSecret('CHANGE_IMPACT_CRON_SECRET');
const ciaApiUrl = defineSecret('CHANGE_IMPACT_API_URL');

export const scheduledChangeImpactJobs = onSchedule(
  {
    schedule: 'every day 08:00',
    timeZone: 'UTC',
    secrets: [ciaCronSecret, ciaApiUrl],
  },
  async () => {
    const url = ciaApiUrl.value() || process.env.CHANGE_IMPACT_API_URL;
    const secret = ciaCronSecret.value() || process.env.CHANGE_IMPACT_CRON_SECRET;
    if (!url) {
      logger.error('CHANGE_IMPACT_API_URL not configured');
      return;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const body = await res.json();
    logger.info('Change impact scheduler completed', body);
  },
);

const archiveCronSecret = defineSecret('ARCHIVE_CRON_SECRET');
const archiveApiUrl = defineSecret('ARCHIVE_API_URL');

export const scheduledArchiveJobs = onSchedule(
  {
    schedule: 'every day 09:00',
    timeZone: 'UTC',
    secrets: [archiveCronSecret, archiveApiUrl],
  },
  async () => {
    const url = archiveApiUrl.value() || process.env.ARCHIVE_API_URL;
    const secret = archiveCronSecret.value() || process.env.ARCHIVE_CRON_SECRET;
    if (!url) {
      logger.error('ARCHIVE_API_URL not configured');
      return;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const body = await res.json();
    logger.info('Archive scheduler completed', body);
  },
);

const retentionCronSecret = defineSecret('RETENTION_CRON_SECRET');
const retentionApiUrl = defineSecret('RETENTION_API_URL');

export const scheduledRetentionJobs = onSchedule(
  {
    schedule: 'every day 10:00',
    timeZone: 'UTC',
    secrets: [retentionCronSecret, retentionApiUrl],
  },
  async () => {
    const url = retentionApiUrl.value() || process.env.RETENTION_API_URL;
    const secret = retentionCronSecret.value() || process.env.RETENTION_CRON_SECRET;
    if (!url) {
      logger.error('RETENTION_API_URL not configured');
      return;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const body = await res.json();
    logger.info('Retention scheduler completed', body);
  },
);

const externalDocCronSecret = defineSecret('EXTERNAL_DOC_CRON_SECRET');
const externalDocApiUrl = defineSecret('EXTERNAL_DOC_API_URL');

export const scheduledExternalDocumentJobs = onSchedule(
  {
    schedule: 'every day 11:00',
    timeZone: 'UTC',
    secrets: [externalDocCronSecret, externalDocApiUrl],
  },
  async () => {
    const url = externalDocApiUrl.value() || process.env.EXTERNAL_DOC_API_URL;
    const secret = externalDocCronSecret.value() || process.env.EXTERNAL_DOC_CRON_SECRET;
    if (!url) {
      logger.error('EXTERNAL_DOC_API_URL not configured');
      return;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const body = await res.json();
    logger.info('External document scheduler completed', body);
  },
);

const printControlCronSecret = defineSecret('PRINT_CONTROL_CRON_SECRET');
const printControlApiUrl = defineSecret('PRINT_CONTROL_API_URL');

export const scheduledPrintControlJobs = onSchedule(
  {
    schedule: 'every day 12:00',
    timeZone: 'UTC',
    secrets: [printControlCronSecret, printControlApiUrl],
  },
  async () => {
    const url = printControlApiUrl.value() || process.env.PRINT_CONTROL_API_URL;
    const secret = printControlCronSecret.value() || process.env.PRINT_CONTROL_CRON_SECRET;
    if (!url) {
      logger.error('PRINT_CONTROL_API_URL not configured');
      return;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const body = await res.json();
    logger.info('Print control scheduler completed', body);
  },
);

const watermarkCronSecret = defineSecret('WATERMARK_CRON_SECRET');
const watermarkApiUrl = defineSecret('WATERMARK_API_URL');

export const scheduledWatermarkJobs = onSchedule(
  {
    schedule: 'every day 13:00',
    timeZone: 'UTC',
    secrets: [watermarkCronSecret, watermarkApiUrl],
  },
  async () => {
    const url = watermarkApiUrl.value() || process.env.WATERMARK_API_URL;
    const secret = watermarkCronSecret.value() || process.env.WATERMARK_CRON_SECRET;
    if (!url) {
      logger.error('WATERMARK_API_URL not configured');
      return;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const body = await res.json();
    logger.info('Watermark scheduler completed', body);
  },
);

const documentAuditCronSecret = defineSecret('DOCUMENT_AUDIT_CRON_SECRET');
const documentAuditApiUrl = defineSecret('DOCUMENT_AUDIT_API_URL');

export const scheduledDocumentAuditJobs = onSchedule(
  {
    schedule: 'every day 14:00',
    timeZone: 'UTC',
    secrets: [documentAuditCronSecret, documentAuditApiUrl],
  },
  async () => {
    const url = documentAuditApiUrl.value() || process.env.DOCUMENT_AUDIT_API_URL;
    const secret = documentAuditCronSecret.value() || process.env.DOCUMENT_AUDIT_CRON_SECRET;
    if (!url) {
      logger.error('DOCUMENT_AUDIT_API_URL not configured');
      return;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const body = await res.json();
    logger.info('Document audit scheduler completed', body);
  },
);

export const scheduledTrainingAutomationJobs = onSchedule(
  {
    schedule: 'every day 05:00',
    timeZone: 'UTC',
  },
  async () => {
    if (getApps().length === 0) initializeApp();
    const firestore = getFirestore();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const reminderDate = new Date(now);
    reminderDate.setUTCDate(reminderDate.getUTCDate() + 30);
    const threshold = reminderDate.toISOString().slice(0, 10);
    let retrainingUpdated = 0;
    let certificatesUpdated = 0;

    const retraining = await firestore.collection('retraining_records')
      .where('due_date', '<=', threshold)
      .get();
    for (const snapshot of retraining.docs) {
      const record = snapshot.data();
      if (['Completed', 'Closed', 'Cancelled'].includes(String(record.retraining_status))) continue;
      const overdue = String(record.due_date) < today;
      const status = overdue ? 'Overdue' : String(record.retraining_status || 'Scheduled');
      const notificationId = `retraining-${snapshot.id}-${overdue ? 'overdue' : today}`;
      const batch = firestore.batch();
      if (overdue && record.retraining_status !== 'Overdue') {
        batch.update(snapshot.ref, {
          retraining_status: 'Overdue',
          status: 'Overdue',
          updated_at: now.toISOString(),
          updated_by: 'system',
          updated_by_name: 'Training Automation',
        });
        retrainingUpdated++;
      }
      batch.set(firestore.collection('notifications').doc(notificationId), {
        userId: String(record.employee_id || ''),
        recipientRole: 'training_coordinator',
        title: overdue ? 'Retraining Overdue' : 'Retraining Reminder',
        message: `${String(record.training_topic || 'Training')} is ${overdue ? 'overdue' : `due ${String(record.due_date)}`}`,
        type: overdue ? 'warning' : 'info',
        module: 'training',
        recordId: snapshot.id,
        isRead: false,
        createdAt: now.toISOString(),
        dedupeKey: notificationId,
        status,
      }, { merge: false });
      await batch.commit();
    }

    const certificates = await firestore.collection('training_certificates')
      .where('expiry_date', '<=', threshold)
      .get();
    for (const snapshot of certificates.docs) {
      const certificate = snapshot.data();
      if (certificate.certificate_status === 'Revoked') continue;
      const expired = String(certificate.expiry_date) < today;
      const status = expired ? 'Expired' : 'Expiring Soon';
      if (certificate.certificate_status === status) continue;
      const notificationId = `certificate-${snapshot.id}-${status.toLowerCase().replace(' ', '-')}`;
      const batch = firestore.batch();
      batch.update(snapshot.ref, {
        certificate_status: status,
        updated_at: now.toISOString(),
        updated_by: 'system',
        updated_by_name: 'Training Automation',
      });
      batch.set(firestore.collection('notifications').doc(notificationId), {
        userId: String(certificate.employee_id || ''),
        recipientRole: 'training_coordinator',
        title: `Certificate ${status}`,
        message: `${String(certificate.certificate_number || snapshot.id)} ${expired ? 'has expired' : `expires ${String(certificate.expiry_date)}`}`,
        type: expired ? 'warning' : 'info',
        module: 'training',
        recordId: snapshot.id,
        isRead: false,
        createdAt: now.toISOString(),
        dedupeKey: notificationId,
      }, { merge: false });
      await batch.commit();
      certificatesUpdated++;
    }

    await firestore.collection('training_automation_log').add({
      job: 'daily_training_automation',
      started_at: now.toISOString(),
      completed_at: new Date().toISOString(),
      status: 'Completed',
      retraining_updated: retrainingUpdated,
      certificates_updated: certificatesUpdated,
    });
    logger.info('Training automation completed', { retrainingUpdated, certificatesUpdated });
  },
);
