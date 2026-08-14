import { Data } from '../../storage/models/data.js';
import { Domain } from '../../../domain.js';
import { Utils } from '../../../shared/utils/utils.js';

// =============================================================================
// CHALLENGE CONTROLLER — Private business logic for challenge rounds.
// =============================================================================
export const ChallengeController = {
  async listRounds() { return Data.adapter.listRounds(); },

  async createRound(roundData) { return Data.adapter.createRound(roundData); },

  async updateRound(roundData) { return Data.adapter.updateRound(roundData); },

  async deleteRound(id) { return Data.adapter.deleteRound(id); },

  activeRound(rounds) { return Domain.activeRound(rounds); },

  suggestTitle(lastRound) { return Domain.suggestTitle(lastRound); },

  calcCurrentWeek(round, users, subs) { return Domain.calcCurrentWeek(round, users, subs); },

  roundUsers(round, users) { return Domain.roundUsers(round, users); },

  isWeekComplete(round, users, subs, week) { return Domain.isWeekComplete(round, users, subs, week); },

  isWeekFinished(round, week) { return Domain.isWeekFinished(round, week); },

  payoutRankIndices(round) { return Domain.payoutRankIndices(round); },

  prizeTotal(round) { return Domain.prizeTotal(round); },

  buildCreateDefaults(rounds, users) {
    const lastRound = [...rounds].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    const allNames = [...new Set(users.filter((u) => !u.invitedAt || !!u.inviteAcceptedAt).map((u) => Utils.fullName(u)))];
    return {
      title: Domain.suggestTitle(lastRound),
      weeksCount: lastRound?.weeksCount || 10,
      holidaysAllowed: lastRound?.holidaysAllowed || 2,
      entryFee: lastRound?.entryFee || 10,
      startDate: new Date().toISOString().slice(0, 10),
      weighDay: String(lastRound?.weighDay ?? 1),
      selectedNames: lastRound ? Domain.roundUsers(lastRound, users).map((u) => Utils.fullName(u)) : allNames,
      allNames,
      newName: '',
      payoutMode: lastRound?.payoutMode || 'preset3',
      customMemory: (lastRound?.prizeSplits || [30, 20, 10]).map(String),
      presetCurrent: (lastRound?.prizeSplits || [30, 20, 10]).map(String)
    };
  }
};
