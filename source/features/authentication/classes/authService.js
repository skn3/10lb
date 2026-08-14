import { AuthController } from './authController.js';

// =============================================================================
// AUTH SERVICE — Public API for the authentication feature.
// Other features must only call methods through AuthService, never directly
// accessing AuthController.
// =============================================================================
export const AuthService = {
  loadFirebaseSDK: () => AuthController.loadFirebaseSDK(),
  initializeFirebase: (firebaseConfig, challengeId) => AuthController.initializeFirebase(firebaseConfig, challengeId),
  resolveFirebaseUser: (firebaseUserOrUid) => AuthController.resolveFirebaseUser(firebaseUserOrUid),
  signInWithEmail: (email, password) => AuthController.signInWithEmail(email, password),
  createUserWithEmail: (email, password) => AuthController.createUserWithEmail(email, password),
  getCurrentFirebaseUser: () => AuthController.getCurrentFirebaseUser(),
  sendPasswordResetEmail: (email) => AuthController.sendPasswordResetEmail(email),
  updateFirebasePassword: (newPassword) => AuthController.updateFirebasePassword(newPassword),
  queryUsersByEmail: (email) => AuthController.queryUsersByEmail(email),
  getChallengeDoc: () => AuthController.getChallengeDoc(),
  upsertFirebaseSession: (user, appSettings, sessionId) => AuthController.upsertFirebaseSession(user, appSettings, sessionId),
  deleteFirebaseSession: (sessionId) => AuthController.deleteFirebaseSession(sessionId),
  registerFirebaseAdmin: (user) => AuthController.registerFirebaseAdmin(user),
  ensureFirebaseAuthenticatedState: (user, appSettings, sessionId) => AuthController.ensureFirebaseAuthenticatedState(user, appSettings, sessionId),
  provisionFirebaseMaster: (username, password, localUserId, logFn) => AuthController.provisionFirebaseMaster(username, password, localUserId, logFn),
  testFirebaseConnection: (firebaseConfig) => AuthController.testFirebaseConnection(firebaseConfig),
  getFirebaseInvite: (code) => AuthController.getFirebaseInvite(code),
  saveFirebaseInvite: (invite) => AuthController.saveFirebaseInvite(invite),
  deleteFirebaseInvite: (inviteId) => AuthController.deleteFirebaseInvite(inviteId),
  loadVisibleInvites: (isFirebaseMode, currentUser, isAdmin, offlineAdapter) =>
    AuthController.loadVisibleInvites(isFirebaseMode, currentUser, isAdmin, offlineAdapter),
  loadVisibleSessions: (isFirebaseMode, currentUser, isAdmin) =>
    AuthController.loadVisibleSessions(isFirebaseMode, currentUser, isAdmin),
  deleteCurrentFirebaseAuthUser: () => AuthController.deleteCurrentFirebaseAuthUser(),
  signOutFirebase: () => AuthController.signOutFirebase()
};
