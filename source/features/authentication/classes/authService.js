import { AuthController } from './authController.js';

// =============================================================================
// AUTH SERVICE — Public API for the authentication feature.
// Other features must only call methods through AuthService, never directly
// accessing AuthController.
// =============================================================================
export const AuthService = {
  loadFirebaseSDK: () => AuthController.loadFirebaseSDK(),
  resolveFirebaseUser: (firebaseUserOrUid) => AuthController.resolveFirebaseUser(firebaseUserOrUid),
  upsertFirebaseSession: (user, appSettings, sessionId) => AuthController.upsertFirebaseSession(user, appSettings, sessionId),
  deleteFirebaseSession: (sessionId) => AuthController.deleteFirebaseSession(sessionId),
  registerFirebaseAdmin: (user) => AuthController.registerFirebaseAdmin(user),
  ensureFirebaseAuthenticatedState: (user, appSettings, sessionId) => AuthController.ensureFirebaseAuthenticatedState(user, appSettings, sessionId),
  provisionFirebaseMaster: (username, password, localUserId, logFn) => AuthController.provisionFirebaseMaster(username, password, localUserId, logFn),
  testFirebaseConnection: (firebaseConfig) => AuthController.testFirebaseConnection(firebaseConfig),
  getFirebaseInvite: (code) => AuthController.getFirebaseInvite(code),
  saveFirebaseInvite: (invite) => AuthController.saveFirebaseInvite(invite),
  deleteFirebaseInvite: (inviteId) => AuthController.deleteFirebaseInvite(inviteId)
};
