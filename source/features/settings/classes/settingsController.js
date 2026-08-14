import { Data } from '../../storage/models/data.js';
import { Utils } from '../../../shared/utils/utils.js';

// =============================================================================
// SETTINGS CONTROLLER — private business logic for settings
// =============================================================================
export const SettingsController = {
  async saveUserProfile(currentUser, firstName, lastName) {
    return Data.adapter.updateUser({ ...currentUser, firstName, lastName });
  },

  async saveAppSettings(appSettings, updates) {
    const next = { ...appSettings, ...updates, updatedAt: new Date().toISOString() };
    await Data.adapter.saveAppSettings(next);
    return next;
  },

  async changeOfflinePassword(currentUser, currentPassword, newPassword, Security) {
    const ok = await Security.verifyPassword(currentPassword, currentUser.password);
    if (!ok) throw new Error('Current password is incorrect.');
    const hash = await Security.createPasswordRecord(newPassword);
    const updated = { ...currentUser, password: hash };
    await Data.adapter.updateUser(updated);
    return updated;
  },

  async resetServer(isFirebaseMode, FirestoreAdapter, SyncEngine) {
    if (isFirebaseMode && SyncEngine.isRunning()) await SyncEngine.stop();
    if (isFirebaseMode && FirestoreAdapter.isReady()) await FirestoreAdapter.resetChallengeData();
    await Data.adapter.clearAllData();
    if (isFirebaseMode && FirestoreAdapter.isReady()) {
      const authUser = FirestoreAdapter.getAuth()?.currentUser;
      if (authUser) {
        try {
          await authUser.delete();
        } catch (e) {
          console.warn('Could not delete current Firebase auth user during reset:', e.message);
          await FirestoreAdapter.signOut();
        }
      } else {
        await FirestoreAdapter.signOut();
      }
    }
    Utils.clearCookie('tenlb_session');
  }
};
