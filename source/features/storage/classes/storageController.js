import { FirestoreAdapter } from './firestoreAdapter.js';
import { SyncEngine } from './syncEngine.js';

// =============================================================================
// STORAGE CONTROLLER — private storage logic for Firestore + sync operations.
// =============================================================================
export const StorageController = {
  initializeFirestore(firebaseConfig, challengeId = 'default') {
    return FirestoreAdapter.init(firebaseConfig, challengeId);
  },

  isFirestoreReady() {
    return FirestoreAdapter.isReady();
  },

  getUid() {
    return FirestoreAdapter.getUid();
  },

  getCurrentFirebaseUser() {
    return FirestoreAdapter.getCurrentFirebaseUser();
  },

  signInWithEmail(email, password) {
    return FirestoreAdapter.signInWithEmail(email, password);
  },

  createUserWithEmail(email, password) {
    return FirestoreAdapter.createUserWithEmail(email, password);
  },

  signOut() {
    return FirestoreAdapter.signOut();
  },

  sendPasswordResetEmail(email) {
    return FirestoreAdapter.sendPasswordResetEmail(email);
  },

  updatePassword(newPassword) {
    return FirestoreAdapter.updatePassword(newPassword);
  },

  writeRecord(entityType, record) {
    return FirestoreAdapter.writeRecord(entityType, record);
  },

  getRecord(entityType, id) {
    return FirestoreAdapter.getRecord(entityType, id);
  },

  queryRecords(entityType, field, value) {
    return FirestoreAdapter.queryRecords(entityType, field, value);
  },

  downloadAll(entityType) {
    return FirestoreAdapter.downloadAll(entityType);
  },

  removeRecord(entityType, id) {
    return FirestoreAdapter.removeRecord(entityType, id);
  },

  resetChallengeData() {
    return FirestoreAdapter.resetChallengeData();
  },

  getChallengeDoc() {
    return FirestoreAdapter.getChallengeDoc();
  },

  getCurrentAuthUser() {
    return FirestoreAdapter.getAuth()?.currentUser || null;
  },

  startSync() {
    return SyncEngine.start();
  },

  stopSync() {
    return SyncEngine.stop();
  },

  retrySyncNow() {
    return SyncEngine.retryNow();
  },

  isSyncRunning() {
    return SyncEngine.isRunning();
  }
};
