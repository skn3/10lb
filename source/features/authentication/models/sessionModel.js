// =============================================================================
// SESSION MODEL
// =============================================================================
export class SessionModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.userId = data.userId || null;
    this.token = data.token || null;
    this.firebaseUid = data.firebaseUid || null;
    this.email = data.email || '';
    this.firstName = data.firstName || '';
    this.lastName = data.lastName || '';
    this.role = data.role || 'user';
    this.clientId = data.clientId || null;
    this.startedAt = data.startedAt || null;
    this.lastSeenAt = data.lastSeenAt || null;
    this.expiresAt = data.expiresAt || null;
    this.deletedAt = data.deletedAt || null;
  }
}
