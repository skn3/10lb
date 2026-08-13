import { Utils } from './shared/utils/utils.js';

// =============================================================================
// DOMAIN — Pure business logic. No I/O, no side effects.
// =============================================================================
export const Domain = {
  suggestTitle(lastRound) {
    const y = new Date().getFullYear();
    if (!lastRound?.title) return `${y} - round 1`;
    const m = lastRound.title.match(/(\d{4})\s*-\s*round\s*(\d+)/i);
    if (!m) return `${y} - round 1`;
    const year = Number(m[1]);
    const round = Number(m[2]);
    return `${y} - round ${year === y ? round + 1 : 1}`;
  },
  activeRound(rounds) { return rounds.find((r) => r.status === 'active') || null; },
  userMap(users) { return new Map(users.map((u) => [u.id, u])); },
  roundUsers(round, users) {
    const map = this.userMap(users);
    return round.participantIds.map((id) => map.get(id)).filter((u) => !!u && (!u.invitedAt || !!u.inviteAcceptedAt));
  },
  submissionsByRound(submissions, roundId) { return submissions.filter((s) => s.roundId === roundId); },
  submissionFor(subs, week, userId) { return subs.find((s) => s.weekNumber === week && s.userId === userId) || null; },
  latestWeight(subs, userId, weekLimit) {
    return subs.filter((s) => s.userId === userId && s.type === 'weight' && s.weekNumber <= weekLimit)
      .sort((a, b) => b.weekNumber - a.weekNumber)[0] || null;
  },
  firstWeight(subs, userId) {
    return subs.filter((s) => s.userId === userId && s.type === 'weight' && s.weekNumber === 1)[0] || null;
  },
  isForfeit(subs, userId, week) {
    return subs.some((s) => s.userId === userId && s.type === 'forfeit' && s.weekNumber <= week);
  },
  holidaysUsed(subs, userId, week = Infinity) {
    return subs.filter((s) => s.userId === userId && s.type === 'holiday' && s.weekNumber <= week).length;
  },
  calcCurrentWeek(round, users, subs) {
    const participants = this.roundUsers(round, users);
    if (!participants.length) return 1;
    const maxWeek = Math.max(1, ...subs.map((s) => s.weekNumber));
    const weekComplete = (w) => this.isWeekComplete(round, users, subs, w);
    let week = 1;
    for (let w = 1; w <= round.weeksCount; w += 1) {
      week = w;
      if (!weekComplete(w)) return w;
    }
    return Math.min(round.weeksCount, maxWeek);
  },
  isWeekComplete(round, users, subs, week) {
    return this.roundUsers(round, users).every((u) => {
      if (this.isForfeit(subs, u.id, week)) return true;
      return !!this.submissionFor(subs, week, u.id);
    });
  },
  weekView(round, users, subs, week) {
    const participants = this.roundUsers(round, users);
    const ranked = [];
    const holiday = [];
    const forfeit = [];
    const pending = [];
    const startWeights = [];

    participants.forEach((u) => {
      const start = this.firstWeight(subs, u.id);
      if (start) startWeights.push({ user: u, weight: start.weight });

      if (this.isForfeit(subs, u.id, week)) {
        forfeit.push({ user: u });
        return;
      }

      const currentSubmission = this.submissionFor(subs, week, u.id);
      if (!currentSubmission) {
        pending.push({ user: u });
        return;
      }
      if (currentSubmission.type === 'holiday') {
        holiday.push({ user: u, holidaysUsed: this.holidaysUsed(subs, u.id, week) });
        return;
      }
      if (currentSubmission.type !== 'weight' || !start) {
        pending.push({ user: u });
        return;
      }

      const prevWeightSubmission = this.latestWeight(subs, u.id, week - 1);
      const startWeight = Utils.safeNum(start.weight);
      const currentWeight = Utils.safeNum(currentSubmission.weight);
      const previousWeight = prevWeightSubmission ? Utils.safeNum(prevWeightSubmission.weight) : startWeight;
      const totalLoss = Utils.round2(startWeight - currentWeight);
      const weeklyLoss = Utils.round2(previousWeight - currentWeight);
      const percentLoss = startWeight > 0 ? Utils.round2((totalLoss / startWeight) * 100) : 0;
      ranked.push({ user: u, startWeight, currentWeight, totalLoss, weeklyLoss, percentLoss });
    });

    ranked.sort((a, b) => b.percentLoss - a.percentLoss);
    return { ranked, holiday, forfeit, pending, startWeights };
  },
  payoutRankIndices(round) {
    return (round.prizeSplits || []).map((v, i) => ({ v: Utils.safeNum(v), i })).filter((x) => x.v > 0).map((x) => x.i);
  },
  prizeTotal(round) { return Utils.round2(round.entryFee * round.participantIds.length); }
};
