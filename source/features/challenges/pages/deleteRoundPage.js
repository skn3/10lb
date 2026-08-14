import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { ChallengeService } from '../classes/challengeService.js';

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
