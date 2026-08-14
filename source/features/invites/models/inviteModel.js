// =============================================================================
// INVITE MODEL
// =============================================================================
export class InviteModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.code = data.code || '';
    this.userId = data.userId || null;
    this.inviteType = data.inviteType || 'user'; // 'user' | 'admin'
    this.createdAt = data.createdAt || null;
    this.usedAt = data.usedAt || null;
    this.usedBy = data.usedBy || null;
    this.usedByFirebaseUid = data.usedByFirebaseUid || null;
    this.inviteAcceptedAt = data.inviteAcceptedAt || null;
    this.deletedAt = data.deletedAt || null;
  }
}
