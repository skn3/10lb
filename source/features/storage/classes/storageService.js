import { StorageController } from './storageController.js';

// =============================================================================
// STORAGE SERVICE — public API for Firestore + sync operations.
// =============================================================================
export const StorageService = {
  initializeFirestore: (firebaseConfig, challengeId) =>
    StorageController.initializeFirestore(firebaseConfig, challengeId),
  isFirestoreReady: () => StorageController.isFirestoreReady(),
  getUid: () => StorageController.getUid(),
  getCurrentFirebaseUser: () => StorageController.getCurrentFirebaseUser(),
  signInWithEmail: (email, password) => StorageController.signInWithEmail(email, password),
  createUserWithEmail: (email, password) => StorageController.createUserWithEmail(email, password),
  signOut: () => StorageController.signOut(),
  sendPasswordResetEmail: (email) => StorageController.sendPasswordResetEmail(email),
  updatePassword: (newPassword) => StorageController.updatePassword(newPassword),
  writeRecord: (entityType, record) => StorageController.writeRecord(entityType, record),
  getRecord: (entityType, id) => StorageController.getRecord(entityType, id),
  queryRecords: (entityType, field, value) => StorageController.queryRecords(entityType, field, value),
  downloadAll: (entityType) => StorageController.downloadAll(entityType),
  removeRecord: (entityType, id) => StorageController.removeRecord(entityType, id),
  resetChallengeData: () => StorageController.resetChallengeData(),
  getChallengeDoc: () => StorageController.getChallengeDoc(),
  getCurrentAuthUser: () => StorageController.getCurrentAuthUser(),
  startSync: () => StorageController.startSync(),
  stopSync: () => StorageController.stopSync(),
  retrySyncNow: () => StorageController.retrySyncNow(),
  isSyncRunning: () => StorageController.isSyncRunning()
};
