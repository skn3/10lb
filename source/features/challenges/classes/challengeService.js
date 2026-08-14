import { ChallengeController } from './challengeController.js';

// =============================================================================
// CHALLENGE SERVICE — Public API for the challenges feature.
// =============================================================================
export const ChallengeService = {
  listRounds: () => ChallengeController.listRounds(),
  createRound: (roundData) => ChallengeController.createRound(roundData),
  updateRound: (roundData) => ChallengeController.updateRound(roundData),
  deleteRound: (id) => ChallengeController.deleteRound(id),
  activeRound: (rounds) => ChallengeController.activeRound(rounds),
  suggestTitle: (lastRound) => ChallengeController.suggestTitle(lastRound),
  calcCurrentWeek: (round, users, subs) => ChallengeController.calcCurrentWeek(round, users, subs),
  roundUsers: (round, users) => ChallengeController.roundUsers(round, users),
  isWeekComplete: (round, users, subs, week) => ChallengeController.isWeekComplete(round, users, subs, week),
  isWeekFinished: (round, week) => ChallengeController.isWeekFinished(round, week),
  payoutRankIndices: (round) => ChallengeController.payoutRankIndices(round),
  prizeTotal: (round) => ChallengeController.prizeTotal(round),
  buildCreateDefaults: (rounds, users) => ChallengeController.buildCreateDefaults(rounds, users)
};
