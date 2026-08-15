import { Domain } from '../../../domain.js';
import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { ActionsPanel } from '../../../shared/components/actionsPanel.js';
import { SubmissionStatusPanel } from '../../../shared/components/submissionStatusPanel.js';
import { WeekPager } from '../components/weekPager.js';
import { Leaderboard } from '../components/leaderboard.js';
import { WeightChart } from '../../../shared/components/weightChart.js';

// =============================================================================
// OVERVIEW PAGE — Current challenge week summary and leaderboard
// =============================================================================
export function renderOverviewPage(app) {
  const round = app.currentRound();
  if (!round) return `<div class="card"><h2>No challenges active</h2><p class="muted">Start a new round to begin.</p>${app.isAdmin() ? SubmitButton.render({ text: 'Start New Round', icon: 'add_circle', attrs: { 'data-go': 'create' } }) : ''}</div>`;
  const subs = Domain.submissionsByRound(app.state.submissions, round.id);
  const currentWeek = Domain.calcCurrentWeek(round, app.state.users, subs);
  const selectedWeek = app.state.weekCursor[round.id] || Math.min(currentWeek, round.weeksCount);
  const view = Domain.weekView(round, app.state.users, subs, selectedWeek);
  const prizeRanks = Domain.payoutRankIndices(round);
  const isFinalComplete = Domain.isWeekComplete(round, app.state.users, subs, round.weeksCount);
  const isSelectedWeekComplete = Domain.isWeekComplete(round, app.state.users, subs, selectedWeek);
  const canGoNext = selectedWeek < currentWeek;

  const unit = app.state.appSettings.weightFormat || 'lb';
  const statusPanel = (app.isAdmin() && selectedWeek === currentWeek)
    ? SubmissionStatusPanel.render(round, app.state.users, subs, selectedWeek, {})
    : '';

  return `${round.status === 'active' && app.isAdmin() ? ActionsPanel.render([
    { icon: 'edit', title: 'Edit Round', route: 'edit', color: 'secondary' },
    ...(isSelectedWeekComplete ? [{ icon: 'image', title: 'Generate SOTD Image', route: 'sotd-image' }] : [])
  ]) : ''}<div class="card">
    <div class="row between">
      <h2 style="margin:0">${Utils.esc(round.title)}</h2>
      <span class="tag">${round.status}</span>
    </div>
    ${WeekPager.render(selectedWeek, round.weeksCount, canGoNext)}
  </div>
  <div class="card" style="margin-top:10px">
    <div class="row small muted">
      <span>${round.participantIds.length} participants</span><span>•</span>
      <span>${round.weeksCount} weeks</span><span>•</span>
      <span>Weigh day: ${Utils.weekdayName(round.weighDay)}</span>
    </div>
    <div class="small muted" style="margin-top:4px">Current progress week: ${currentWeek} / ${round.weeksCount}</div>
  </div>
  ${statusPanel ? `<div class="card" style="margin-top:10px">${statusPanel}</div>` : ''}
  ${selectedWeek === 1 ? `<div class="card" style="margin-top:10px"><strong>Start weights</strong>${view.startWeights.length ? `<ul>${view.startWeights.map((x) => `<li>${Utils.esc(Utils.fullName(x.user))}: ${x.weight}${unit}</li>`).join('')}</ul>` : '<p class="muted">No start weights submitted yet.</p>'}</div>` : ''}
  ${selectedWeek >= 2 ? Leaderboard.render(view, round, app.state.appSettings, prizeRanks) : ''}
  ${selectedWeek === round.weeksCount && isFinalComplete ? `<div class="card" style="margin-top:10px"><strong>Final winners</strong><ol>${view.ranked.slice(0, prizeRanks.length).map((r, i) => `<li>${Utils.esc(Utils.fullName(r.user))} — ${Utils.money(round.prizeSplits[i] || 0, app.state.appSettings.currency)}</li>`).join('')}</ol></div>` : ''}`;
}

export function bindOverviewEvents(app) {
  document.querySelectorAll('[data-week-nav]').forEach((b) => b.onclick = () => {
    const round = app.currentRound();
    if (!round) return;
    const subs = Domain.submissionsByRound(app.state.submissions, round.id);
    const currentWeek = Domain.calcCurrentWeek(round, app.state.users, subs);
    const curr = app.state.weekCursor[round.id] ?? Math.min(currentWeek, round.weeksCount);
    const next = b.dataset.weekNav === 'prev' ? Math.max(1, curr - 1) : Math.min(currentWeek, curr + 1);
    app.state.weekCursor[round.id] = next;
    app.render();
  });

  // Attach weight chart to overview
  const round = app.currentRound();
  if (round) {
    const subs = Domain.submissionsByRound(app.state.submissions, round.id);
    const currentWeek = Domain.calcCurrentWeek(round, app.state.users, subs);
    const selectedWeek = app.state.weekCursor[round.id] || Math.min(currentWeek, round.weeksCount);
    const unit = app.state.appSettings.weightFormat || 'lb';
    app._weightChartInstance = WeightChart.attach(round, app.state.users, subs, selectedWeek, unit, app._weightChartInstance);
  }
}
