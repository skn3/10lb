// =============================================================================
// SUBMISSION MODEL
// =============================================================================
export class SubmissionModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.roundId = data.roundId || null;
    this.userId = data.userId || null;
    this.weekNumber = data.weekNumber || 1;
    this.type = data.type || 'weight'; // 'weight' | 'holiday' | 'forfeit'
    this.weight = data.weight ?? null;
    this.photoName = data.photoName || null;
    this.createdAt = data.createdAt || null;
    this.updatedAt = data.updatedAt || null;
    this.version = data.version || 1;
    this.clientId = data.clientId || null;
    this.deletedAt = data.deletedAt || null;
  }
}
