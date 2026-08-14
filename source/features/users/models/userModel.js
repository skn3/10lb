// =============================================================================
// USER MODEL
// =============================================================================
export class UserModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.username = data.username || '';
    this.firstName = data.firstName || '';
    this.lastName = data.lastName || '';
    this.password = data.password || null;
    this.userType = data.userType || 'user'; // 'master' | 'admin' | 'user' | 'participant'
    this.isAdmin = data.isAdmin || false;
    this.isMaster = data.isMaster || false;
    this.canLogin = data.canLogin !== false;
    this.firebaseUid = data.firebaseUid || null;
    this.inviteCode = data.inviteCode || null;
    this.invitedAt = data.invitedAt || null;
    this.inviteAcceptedAt = data.inviteAcceptedAt || null;
    this.lastLoginAt = data.lastLoginAt || null;
    this.createdAt = data.createdAt || null;
    this.updatedAt = data.updatedAt || null;
    this.version = data.version || 1;
    this.clientId = data.clientId || null;
    this.deletedAt = data.deletedAt || null;
  }
}
