import { Data } from '../../storage/models/data.js';
import { Domain } from '../../../domain.js';
import { Utils } from '../../../shared/utils/utils.js';

// =============================================================================
// SUBMISSION CONTROLLER — Private business logic for submission handling.
// =============================================================================
export const SubmissionController = {
  async listSubmissions() { return Data.adapter.listSubmissions(); },

  async recordSubmission(submission, snapshot) {
    return Data.adapter.recordSubmissionAndSnapshot(submission, snapshot);
  },

  submissionsByRound(submissions, roundId) { return Domain.submissionsByRound(submissions, roundId); },

  submissionFor(subs, week, userId) { return Domain.submissionFor(subs, week, userId); },

  isForfeit(subs, userId, week) { return Domain.isForfeit(subs, userId, week); },

  holidaysUsed(subs, userId, week) { return Domain.holidaysUsed(subs, userId, week); },

  weekView(round, users, subs, week) { return Domain.weekView(round, users, subs, week); },

  isWeekComplete(round, users, subs, week) { return Domain.isWeekComplete(round, users, subs, week); },

  calcCurrentWeek(round, users, subs) { return Domain.calcCurrentWeek(round, users, subs); },

  userStats(user, rounds, allSubmissions, allUsers) {
    const submissions = allSubmissions.filter((s) => s.userId === user.id);
    const roundsParticipated = new Set(submissions.map((s) => s.roundId));
    rounds.forEach((r) => {
      if ((r.participantIds || []).includes(user.id)) roundsParticipated.add(r.id);
    });

    let totalCashWon = 0;
    let totalWeightDelta = 0;

    rounds.filter((r) => r.status === 'completed').forEach((r) => {
      const subs = Domain.submissionsByRound(allSubmissions, r.id);
      const final = Domain.weekView(r, allUsers, subs, r.weeksCount).ranked;
      const idx = final.findIndex((x) => x.user.id === user.id);
      if (idx >= 0) totalCashWon += Utils.safeNum(r.prizeSplits?.[idx], 0);

      const first = Domain.firstWeight(subs, user.id);
      const latest = Domain.latestWeight(subs, user.id, r.weeksCount);
      if (first && latest) totalWeightDelta += Utils.round2(first.weight - latest.weight);
    });

    const activeRound = Domain.activeRound(rounds);
    const inCurrentRound = !!(activeRound && activeRound.participantIds.includes(user.id));

    return {
      roundsParticipated: roundsParticipated.size,
      totalCashWon: Utils.round2(totalCashWon),
      totalWeightDelta: Utils.round2(totalWeightDelta),
      inCurrentRound
    };
  }
};
