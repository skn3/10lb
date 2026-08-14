import { Data } from '../../storage/models/data.js';
import { AuthService } from '../../authentication/classes/authService.js';
import { StorageService } from '../../storage/classes/storageService.js';
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

  async resetServer(isFirebaseMode) {
    if (isFirebaseMode && StorageService.isSyncRunning()) await StorageService.stopSync();
    if (isFirebaseMode && StorageService.isFirestoreReady()) await StorageService.resetChallengeData();
    await Data.adapter.clearAllData();
    if (isFirebaseMode && StorageService.isFirestoreReady()) {
      const authUser = StorageService.getCurrentAuthUser();
      if (authUser) {
        try {
          await AuthService.deleteCurrentFirebaseAuthUser();
        } catch (e) {
          console.warn('Could not delete current Firebase auth user during reset:', e.message);
          await AuthService.signOutFirebase();
        }
      } else {
        await AuthService.signOutFirebase();
      }
    }
    Utils.clearCookie('tenlb_session');
  }
};
