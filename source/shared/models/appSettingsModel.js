// =============================================================================
// APP SETTINGS MODEL
// =============================================================================
export class AppSettingsModel {
  constructor(data = {}) {
    this.installed = data.installed || false;
    this.serverName = data.serverName || '10lb Challenge';
    this.weightFormat = data.weightFormat || 'lb';
    this.currency = data.currency || '£';
    this.theme = data.theme || 'teal';
    this.sessionDurationDays = data.sessionDurationDays || 7;
    this.installLockedAt = data.installLockedAt || null;
    this.updatedAt = data.updatedAt || null;
  }
}
