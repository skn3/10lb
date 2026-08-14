import { SettingsController } from './settingsController.js';

// =============================================================================
// SETTINGS SERVICE — public API for settings feature
// =============================================================================
export const SettingsService = {
  saveUserProfile: (currentUser, firstName, lastName) =>
    SettingsController.saveUserProfile(currentUser, firstName, lastName),

  saveAppSettings: (appSettings, updates) =>
    SettingsController.saveAppSettings(appSettings, updates),

  changeOfflinePassword: (currentUser, currentPassword, newPassword, Security) =>
    SettingsController.changeOfflinePassword(currentUser, currentPassword, newPassword, Security),

  resetServer: (isFirebaseMode) =>
    SettingsController.resetServer(isFirebaseMode)
};
