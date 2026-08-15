import { Domain } from '../../../domain.js';
import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { SubmissionStatusPanel } from '../../../shared/components/submissionStatusPanel.js';
import { ChallengeService } from '../classes/challengeService.js';
import { DeniedPage } from '../../app/pages/deniedPage.js';
import { AppStore } from '../../../shared/classes/appStore.js';

const React = window.React;

// =============================================================================
// FINISH WEEK PAGE
// =============================================================================
export function renderFinishWeekPage(app) {
  if (!app.isAdmin()) return app._renderDenied();
  const round = Domain.activeRound(app.state.rounds);
  if (!round) return `<div class="card"><p class="error">No active challenge round.</p>${SubmitButton.render({ text: 'Back', icon: 'arrow_back', theme: 'secondary', attrs: { 'data-go': 'overview' } })}</div>`;
  const subs = Domain.submissionsByRound(app.state.submissions, round.id);
  const week = Domain.calcCurrentWeek(round, app.state.users, subs);
  const statusPanel = SubmissionStatusPanel.render(round, app.state.users, subs, week, { hideFinishButton: true });
  return `<div class="card"><h2 style="margin-top:0">Finish Week ${week}</h2>
    ${statusPanel}
    <p class="muted">Once you generate results, the weigh-ins for week ${week} will be finalised. After finalising, the submit screen will advance to week ${week + 1} so participants can enter their next weigh-in.</p>
    <form id="finish-week-form">
      <label class="row" style="margin-bottom:12px"><input type="checkbox" id="finish-week-confirm" data-label="Confirm finalise week" required style="width:auto"/> I confirm I want to finalise week ${week} results</label>
      <div class="row">${SubmitButton.render({ text: 'Generate Results', icon: 'task_alt', submit: true })}${SubmitButton.render({ text: 'Cancel', icon: 'close', theme: 'secondary', attrs: { 'type': 'button', 'data-go': 'overview' } })}</div>
    </form>
  </div>`;
}

export function bindFinishWeekEvents(app) {
  const finishWeekForm = document.getElementById('finish-week-form');
  if (!finishWeekForm) return;
  app.bindAsyncFormSubmit(finishWeekForm, async () => {
    if (!document.getElementById('finish-week-confirm').checked) return app.fail('Please confirm to continue.');
    const round = Domain.activeRound(app.state.rounds);
    if (!round) return app.fail('No active challenge.');
    const subs = Domain.submissionsByRound(app.state.submissions, round.id);
    const week = Domain.calcCurrentWeek(round, app.state.users, subs);
    const completedWeeks = [...(round.completedWeeks || [])];
    if (!completedWeeks.includes(week)) completedWeeks.push(week);
    const roundUpdate = { ...round, completedWeeks };
    const ok = await app._saveWithConflictResolver('Round', roundUpdate, (payload) => ChallengeService.updateRound(payload));
    if (!ok) return;
    await app.refresh();
    app.setMessage(`Week ${week} finalised.`);
    app.navigate('overview', { keepFlash: true });
  });
}

export function FinishWeekPage({ app }) {
  const e = React.createElement;
  const formRef = React.useRef(null);
  const confirmRef = React.useRef(null);

  React.useEffect(() => {
    if (!app.isAdmin() || !Domain.activeRound(app.state.rounds)) return;
    const form = formRef.current;
    if (!form) return;
    app.bindAsyncFormSubmit(form, async () => {
      if (!confirmRef.current?.checked) return app.fail('Please confirm to continue.');
      const activeRound = Domain.activeRound(app.state.rounds);
      if (!activeRound) return app.fail('No active challenge.');
      const activeSubs = Domain.submissionsByRound(app.state.submissions, activeRound.id);
      const currentWeek = Domain.calcCurrentWeek(activeRound, app.state.users, activeSubs);
      const completedWeeks = [...(activeRound.completedWeeks || [])];
      if (!completedWeeks.includes(currentWeek)) completedWeeks.push(currentWeek);
      const roundUpdate = { ...activeRound, completedWeeks };
      const ok = await app._saveWithConflictResolver('Round', roundUpdate, (payload) => ChallengeService.updateRound(payload));
      if (!ok) return;
      await app.refresh();
      app.setMessage(`Week ${currentWeek} finalised.`);
      app.navigate('overview', { keepFlash: true });
    });
  });

  if (!app.isAdmin()) return e(DeniedPage, { app });

  const round = Domain.activeRound(app.state.rounds);
  if (!round) {
    return e('div', { className: 'card' },
      e('p', { className: 'error' }, 'No active challenge round.'),
      e('button', { type: 'button', className: 'btn secondary', onClick: () => app.navigate('overview') },
        e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'arrow_back'), ' Back')
    );
  }

  const subs = Domain.submissionsByRound(app.state.submissions, round.id);
  const week = Domain.calcCurrentWeek(round, app.state.users, subs);

  return e('div', { className: 'card' },
    e('h2', { style: { marginTop: 0 } }, `Finish Week ${week}`),
    SubmissionStatusPanel.renderReact(round, app.state.users, subs, week, { hideFinishWeekButton: true }, (route) => app.navigate(route)),
    e('p', { className: 'muted' }, `Once you generate results, the weigh-ins for week ${week} will be finalised. After finalising, the submit screen will advance to week ${week + 1} so participants can enter their next weigh-in.`),
    e('form', { ref: formRef, action: '#' },
      e('label', { className: 'row', style: { marginBottom: '12px' } },
        e('input', { ref: confirmRef, type: 'checkbox', 'data-label': 'Confirm finalise week', required: true, style: { width: 'auto' } }),
        ` I confirm I want to finalise week ${week} results`
      ),
      e('div', { className: 'row' },
        e('button', { type: 'submit', className: 'btn' },
          e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'task_alt'), ' Generate Results'),
        e('button', { type: 'button', className: 'btn secondary', onClick: () => app.navigate('overview') },
          e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'close'), ' Cancel')
      )
    )
  );
}

