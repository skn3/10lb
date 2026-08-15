import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { ChallengeService } from '../classes/challengeService.js';
import { DeniedPage } from '../../app/pages/deniedPage.js';

const React = window.React;

// =============================================================================
// DELETE ROUND PAGE
// =============================================================================
export function renderDeleteRoundPage(app) {
  if (!app.isAdmin()) return app._renderDenied();
  const round = app.currentRound();
  if (!round) return `<div class="card"><p class="muted">No round selected.</p></div>`;
  return `<div class="card"><h2>Delete Challenge Round</h2><p class="error">This cannot be undone.</p>
    <form id="delete-form">
      <div>
        <label for="confirm-delete">Confirm delete</label>
        <label class="row"><input type="checkbox" id="confirm-delete" data-label="Confirm delete" required style="width:auto"/> I confirm delete <strong>${Utils.esc(round.title)}</strong></label>
      </div>
      <div class="row" style="margin-top:10px">${SubmitButton.render({ text: 'Delete round', icon: 'delete', theme: 'danger', submit: true })}${SubmitButton.render({ text: 'Cancel', icon: 'close', theme: 'secondary', attrs: { 'type': 'button', 'data-go': 'overview' } })}</div>
    </form></div>`;
}

export function bindDeleteRoundEvents(app) {
  const del = document.getElementById('delete-form');
  if (!del) return;
  app.bindAsyncFormSubmit(del, async () => {
    const ok = document.getElementById('confirm-delete').checked;
    if (!ok) return app.fail('Confirm deletion to continue.');
    const round = app.currentRound();
    if (!round) return;
    await ChallengeService.deleteRound(round.id);
    app.state.selectedRoundId = null;
    await app.refresh();
    app.setMessage('Round deleted.');
    app.navigate('rounds', { keepFlash: true });
  });
}

export function DeleteRoundPage({ app }) {
  const e = React.createElement;
  const formRef = React.useRef(null);
  const confirmRef = React.useRef(null);

  if (!app.isAdmin()) return e(DeniedPage, { app });

  const round = app.currentRound();
  if (!round) return e('div', { className: 'card' }, e('p', { className: 'muted' }, 'No round selected.'));

  React.useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    app.bindAsyncFormSubmit(form, async () => {
      if (!confirmRef.current?.checked) return app.fail('Confirm deletion to continue.');
      const r = app.currentRound();
      if (!r) return;
      await ChallengeService.deleteRound(r.id);
      app.state.selectedRoundId = null;
      await app.refresh();
      app.setMessage('Round deleted.');
      app.navigate('rounds', { keepFlash: true });
    });
  });

  return e('div', { className: 'card' },
    e('h2', null, 'Delete Challenge Round'),
    e('p', { className: 'error' }, 'This cannot be undone.'),
    e('form', { ref: formRef, action: '#' },
      e('div', null,
        e('label', { htmlFor: 'confirm-delete-del' }, 'Confirm delete'),
        e('label', { className: 'row' },
          e('input', { ref: confirmRef, id: 'confirm-delete-del', type: 'checkbox', 'data-label': 'Confirm delete', required: true, style: { width: 'auto' } }),
          ' I confirm delete ', e('strong', null, round.title)
        )
      ),
      e('div', { className: 'row', style: { marginTop: '10px' } },
        e('button', { type: 'submit', className: 'btn danger' }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'delete'), ' Delete round'),
        e('button', { type: 'button', className: 'btn secondary', onClick: () => app.navigate('overview') }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'close'), ' Cancel')
      )
    )
  );
}

