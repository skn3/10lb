import { Domain } from '../../../domain.js';
import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { ActionsPanel } from '../../../shared/components/actionsPanel.js';
import { SubmissionStatusPanel } from '../../../shared/components/submissionStatusPanel.js';
import { WeekPager } from '../components/weekPager.js';
import { Leaderboard } from '../components/leaderboard.js';
import { WeightChart } from '../../../shared/components/weightChart.js';
import { AppStore } from '../../../shared/classes/appStore.js';

const React = window.React;

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

export function OverviewPage({ app }) {
  const e = React.createElement;
  const round = app.currentRound();

  // ── All hooks must be at the top, before any conditional returns ──────────
  const subs = round ? Domain.submissionsByRound(app.state.submissions, round.id) : [];
  const currentWeek = round ? Domain.calcCurrentWeek(round, app.state.users, subs) : 1;

  const [selectedWeek, setSelectedWeek] = React.useState(() => {
    if (!round) return 1;
    return app.state.weekCursor[round.id] || Math.min(currentWeek, round.weeksCount);
  });

  React.useEffect(() => {
    if (!round) return;
    setSelectedWeek(app.state.weekCursor[round.id] || Math.min(currentWeek, round.weeksCount));
  }, [round?.id, currentWeek, round?.weeksCount, app.state.weekCursor]);

  React.useEffect(() => {
    if (!round) return;
    app.state.weekCursor[round.id] = selectedWeek;
  }, [app, round?.id, selectedWeek]);

  React.useEffect(() => {
    if (!round) return;
    const unit = app.state.appSettings.weightFormat || 'lb';
    if (selectedWeek >= 2) {
      app._weightChartInstance = WeightChart.attach(round, app.state.users, subs, selectedWeek, unit, app._weightChartInstance);
    } else {
      WeightChart.destroy(app._weightChartInstance);
      app._weightChartInstance = null;
    }
    return () => {
      WeightChart.destroy(app._weightChartInstance);
      app._weightChartInstance = null;
    };
  }, [app, round, selectedWeek, app.state.users, app.state.submissions, app.state.appSettings]);

  // ── Early return (after all hooks) ───────────────────────────────────────

  if (!round) {
    return e('div', { className: 'card' },
      e('h2', null, 'No challenges active'),
      e('p', { className: 'muted' }, 'Start a new round to begin.'),
      app.isAdmin()
        ? e('button', {
          type: 'button',
          className: 'btn',
          onClick: () => app.navigate('create')
        },
        e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'add_circle'),
        'Start New Round')
        : null
    );
  }

  const view = Domain.weekView(round, app.state.users, subs, selectedWeek);
  const prizeRanks = Domain.payoutRankIndices(round);
  const isFinalComplete = Domain.isWeekComplete(round, app.state.users, subs, round.weeksCount);
  const isSelectedWeekComplete = Domain.isWeekComplete(round, app.state.users, subs, selectedWeek);
  const canGoNext = selectedWeek < currentWeek;
  const unit = app.state.appSettings.weightFormat || 'lb';
  const statusPanel = (app.isAdmin() && selectedWeek === currentWeek)
    ? SubmissionStatusPanel.render(round, app.state.users, subs, selectedWeek, {})
    : '';

  return e(React.Fragment, null,
    e('div', { className: 'card' },
      e('div', { className: 'row between' },
        e('h2', { style: { margin: 0 } }, round.title),
        e('span', { className: 'tag' }, round.status)
      ),
      e('div', { className: 'row between week-nav', style: { marginTop: '8px' } },
        e('button', { type: 'button', disabled: selectedWeek <= 1, onClick: () => setSelectedWeek((week) => Math.max(1, week - 1)) }, '◀'),
        e('strong', null, `Week ${selectedWeek} of ${round.weeksCount}`),
        e('button', { type: 'button', disabled: !canGoNext, onClick: () => setSelectedWeek((week) => Math.min(currentWeek, week + 1)) }, '▶')
      )
    ),
    e('div', { className: 'card', style: { marginTop: '10px' } },
      e('div', { className: 'row small muted' },
        e('span', null, `${round.participantIds.length} participants`),
        e('span', null, '•'),
        e('span', null, `${round.weeksCount} weeks`),
        e('span', null, '•'),
        e('span', null, `Weigh day: ${Utils.weekdayName(round.weighDay)}`)
      ),
      e('div', { className: 'small muted', style: { marginTop: '4px' } }, `Current progress week: ${currentWeek} / ${round.weeksCount}`)
    ),
    statusPanel ? SubmissionStatusPanel.renderReact(round, app.state.users, subs, selectedWeek, {}, (route) => app.navigate(route)) : null,
    selectedWeek === 1
      ? e('div', { className: 'card', style: { marginTop: '10px' } },
        e('strong', null, 'Start weights'),
        view.startWeights.length
          ? e('ul', null, ...view.startWeights.map((entry, index) => e('li', { key: `${entry.user?.id || index}` }, `${Utils.fullName(entry.user)}: ${entry.weight}${unit}`)))
          : e('p', { className: 'muted' }, 'No start weights submitted yet.')
      )
      : null,
    selectedWeek >= 2 ? Leaderboard.renderReact(view, round, app.state.appSettings, prizeRanks) : null,
    selectedWeek === round.weeksCount && isFinalComplete
      ? e('div', { className: 'card', style: { marginTop: '10px' } },
        e('strong', null, 'Final winners'),
        e('ol', null, ...view.ranked.slice(0, prizeRanks.length).map((ranked, index) =>
          e('li', { key: `${ranked.user?.id || index}` }, `${Utils.fullName(ranked.user)} — ${Utils.money(round.prizeSplits[index] || 0, app.state.appSettings.currency)}`)
        ))
      )
      : null,
    round.status === 'active' && app.isAdmin()
      ? ActionsPanel.renderReact([
        { icon: 'edit', title: 'Edit Round', route: 'edit', color: 'secondary' },
        ...(isSelectedWeekComplete ? [{ icon: 'image', title: 'Generate SOTD Image', route: 'sotd-image' }] : [])
      ], (route) => app.navigate(route))
      : null
  );
}
