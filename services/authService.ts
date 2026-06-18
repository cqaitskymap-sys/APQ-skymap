/**
 * Authentication service — Firebase Auth + user profiles.
 */
export {
  signIn,
  signOut,
  signUp,
  getUserProfile,
  updateUserProfile,
  subscribeToAuthState,
  getCurrentUser,
  resetPassword,
  formatAuthError,
  isAuthNetworkError,
  isFirebaseConfigured,
  FirebaseNotConfiguredError,
  USERS_COLLECTION,
  PROFILES_COLLECTION,
  APP_ROLES,
  type Profile,
  type UserRole,
} from '@/lib/auth';
