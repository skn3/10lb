// =============================================================================
// ROUND MODEL
// =============================================================================
export class RoundModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.title = data.title || '';
    this.status = data.status || 'pending';
    this.weeksCount = data.weeksCount || 10;
    this.holidaysAllowed = data.holidaysAllowed || 2;
    this.entryFee = data.entryFee || 0;
    this.startDate = data.startDate || null;
    this.weighDay = data.weighDay ?? 1;
    this.participantIds = data.participantIds || [];
    this.userNames = data.userNames || [];
    this.payoutMode = data.payoutMode || 'preset3';
    this.prizeSplits = data.prizeSplits || [];
    this.completedWeeks = data.completedWeeks || [];
    this.createdAt = data.createdAt || null;
    this.updatedAt = data.updatedAt || null;
    this.version = data.version || 1;
    this.clientId = data.clientId || null;
    this.deletedAt = data.deletedAt || null;
  }
}
