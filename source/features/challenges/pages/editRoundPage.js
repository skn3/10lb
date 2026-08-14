import { Domain } from '../../../domain.js';
import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { ChallengeService } from '../classes/challengeService.js';

// =============================================================================
// EDIT ROUND PAGE
// =============================================================================
export function renderEditRoundPage(app) {
  if (!app.isAdmin()) return app._renderDenied();
  const round = app.currentRound();
  if (!round) return `<div class="card"><p class="muted">No round selected.</p></div>`;
  const totalPrize = Utils.round2(round.entryFee * round.participantIds.length);
  const sum = Utils.round2((round.prizeSplits || []).reduce((a, b) => a + Utils.safeNum(b), 0));
  return `<div class="card"><h2 style="margin-top:0">Edit Challenge Round</h2>
    <form id="edit-form" class="grid two">
      <div><label>Title</label><input name="title" type="text" required value="${Utils.escAttr(round.title)}" /></div>
      <div><label>Prize total</label><input disabled value="${Utils.money(totalPrize, app.state.appSettings.currency)}" /></div>
      <div class="card" style="grid-column:1/-1"><strong>Prize splits</strong>
        <div class="grid three" style="margin-top:8px">${(round.prizeSplits || []).map((v, i) => `<div><label>Rank ${i + 1}</label><input type="number" step="0.01" min="0" name="split-${i}" value="${Utils.safeNum(v)}"/></div>`).join('')}</div>
        <p class="small ${sum > totalPrize ? 'error' : 'muted'}">Entered: ${Utils.money(sum, app.state.appSettings.currency)}</p>
      </div>
      <div class="row" style="grid-column:1/-1">${SubmitButton.render({ text: 'Save', icon: 'save', submit: true })}${SubmitButton.render({ text: 'Cancel', icon: 'close', theme: 'secondary', attrs: { 'type': 'button', 'data-go': 'overview' } })}</div>
    </form></div>`;
}

export function bindEditRoundEvents(app) {
  const editForm = document.getElementById('edit-form');
  if (!editForm) return;
  app.bindAsyncFormSubmit(editForm, async () => {
    const round = app.currentRound();
    if (!round) return;
    const title = editForm.title.value.trim();
    const prizeSplits = (round.prizeSplits || []).map((_, i) => Utils.round2(Utils.safeNum(editForm[`split-${i}`].value)));
    const totalPrize = Utils.round2(round.entryFee * round.participantIds.length);
    const sum = Utils.round2(prizeSplits.reduce((a, b) => a + b, 0));
    if (sum > totalPrize) return app.fail('Prize splits cannot exceed total prize pool.');
    const roundUpdate = { ...round, title, prizeSplits };
    const ok = await app._saveWithConflictResolver('Round', roundUpdate, (payload) => ChallengeService.updateRound(payload));
    if (!ok) return;
    await app.refresh();
    app.setMessage('Round updated.');
    app.navigate('overview', { keepFlash: true });
  });
}
