import { Domain } from '../../../domain.js';
import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';

const React = window.React;

// =============================================================================
// ROUND LIST PAGE
// =============================================================================
export function renderRoundListPage(app) {
  const active = Domain.activeRound(app.state.rounds);
  return `<div class="card"><div class="row between"><h2 style="margin:0">Challenge Rounds</h2>${(!active && app.isAdmin()) ? SubmitButton.render({ text: 'Start New Round', icon: 'add_circle', attrs: { 'data-go': 'create' } }) : ''}</div>
    <div class="list" style="margin-top:10px">${app.state.rounds.length ? app.state.rounds.map((r) => {
      const subs = Domain.submissionsByRound(app.state.submissions, r.id);
      const progress = Domain.calcCurrentWeek(r, app.state.users, subs);
      const prize = Utils.money(Domain.prizeTotal(r), app.state.appSettings.currency);
      return `<button class="list-item ${r.status === 'active' ? 'active' : ''}" data-open-round="${r.id}">
        <div class="row between"><strong>${Utils.esc(r.title)}</strong>${r.status === 'active' ? '<span class="pill ok">ACTIVE</span>' : ''}</div>
        <div class="small muted">${r.participantIds.length} participants • Week ${progress}/${r.weeksCount}</div>
        <div class="small muted">${Utils.date(r.startDate)} → ${Utils.date(new Date(new Date(r.startDate).getTime() + ((r.weeksCount - 1) * 7 * 86400000)).toISOString())}</div>
        <div class="small">Prize pool: ${prize}</div>
      </button>`;
    }).join('') : '<p class="muted">No rounds found.</p>'}</div></div>`;
}

export function bindRoundListEvents(app) {
  document.querySelectorAll('[data-open-round]').forEach((b) => b.onclick = () => {
    app.state.selectedRoundId = b.dataset.openRound;
    app.navigate('overview');
  });
}

export function RoundListPage({ app }) {
  const e = React.createElement;
  const active = Domain.activeRound(app.state.rounds);
  return e('div', { className: 'card' },
    e('div', { className: 'row between' },
      e('h2', { style: { margin: 0 } }, 'Challenge Rounds'),
      (!active && app.isAdmin())
        ? e('button', { type: 'button', className: 'btn', onClick: () => app.navigate('create') },
          e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'add_circle'),
          'Start New Round')
        : null
    ),
    e('div', { className: 'list', style: { marginTop: '10px' } },
      app.state.rounds.length
        ? app.state.rounds.map((r) => {
          const subs = Domain.submissionsByRound(app.state.submissions, r.id);
          const progress = Domain.calcCurrentWeek(r, app.state.users, subs);
          const prize = Utils.money(Domain.prizeTotal(r), app.state.appSettings.currency);
          const endDate = new Date(new Date(r.startDate).getTime() + ((r.weeksCount - 1) * 7 * 86400000)).toISOString();
          return e('button', {
            key: r.id,
            type: 'button',
            className: `list-item${r.status === 'active' ? ' active' : ''}`,
            onClick: () => { app.state.selectedRoundId = r.id; app.navigate('overview'); }
          },
          e('div', { className: 'row between' },
            e('strong', null, r.title),
            r.status === 'active' ? e('span', { className: 'pill ok' }, 'ACTIVE') : null
          ),
          e('div', { className: 'small muted' }, `${r.participantIds.length} participants • Week ${progress}/${r.weeksCount}`),
          e('div', { className: 'small muted' }, `${Utils.date(r.startDate)} → ${Utils.date(endDate)}`),
          e('div', { className: 'small' }, `Prize pool: ${prize}`)
          );
        })
        : e('p', { className: 'muted' }, 'No rounds found.')
    )
  );
}
