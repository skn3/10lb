import { SubmissionController } from './submissionController.js';

// =============================================================================
// SUBMISSION SERVICE — Public API for the submission feature.
// =============================================================================
export const SubmissionService = {
  listSubmissions: () => SubmissionController.listSubmissions(),
  recordSubmission: (submission, snapshot) => SubmissionController.recordSubmission(submission, snapshot),
  submissionsByRound: (submissions, roundId) => SubmissionController.submissionsByRound(submissions, roundId),
  submissionFor: (subs, week, userId) => SubmissionController.submissionFor(subs, week, userId),
  isForfeit: (subs, userId, week) => SubmissionController.isForfeit(subs, userId, week),
  holidaysUsed: (subs, userId, week) => SubmissionController.holidaysUsed(subs, userId, week),
  weekView: (round, users, subs, week) => SubmissionController.weekView(round, users, subs, week),
  isWeekComplete: (round, users, subs, week) => SubmissionController.isWeekComplete(round, users, subs, week),
  calcCurrentWeek: (round, users, subs) => SubmissionController.calcCurrentWeek(round, users, subs),
  userStats: (user, rounds, allSubmissions, allUsers) => SubmissionController.userStats(user, rounds, allSubmissions, allUsers)
};
