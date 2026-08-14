import { Domain } from '../../../domain.js';
import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { ChallengeService } from '../classes/challengeService.js';

// =============================================================================
// CREATE ROUND PAGE
// =============================================================================
export function renderCreateRoundPage(app) {
  if (!app.isAdmin()) return app._renderDenied();
  const active = Domain.activeRound(app.state.rounds);
  if (active) {
    return `<div class="card"><p class="error">A challenge is already active.</p>${SubmitButton.render({ text: 'Go to round list', icon: 'list_alt', theme: 'secondary', attrs: { 'data-go': 'rounds' } })}</div>`;
  }
  if (!app.state.createDraft) app.state.createDraft = ChallengeService.buildCreateDefaults(app.state.rounds, app.state.users);
  const d = app.state.createDraft;
  const count = d.selectedNames.length;
  const totalPrize = Utils.round2(Utils.safeNum(d.entryFee) * count);
  const rows = (d.payoutMode === 'custom' ? d.customMemory : d.presetCurrent);
  const sum = Utils.round2(rows.reduce((a, b) => a + Utils.safeNum(b), 0));
  const over = sum > totalPrize;

  return `<div class="card"><h2 style="margin-top:0">Create Challenge Round</h2>
    <form id="create-form" class="grid two">
      <div><label>Round title</label><input name="title" type="text" value="${Utils.escAttr(d.title)}" required /></div>
      <div><label>Number of weeks</label><input type="number" min="1" max="52" name="weeksCount" value="${d.weeksCount}" required /></div>
      <div><label>Number of holidays</label><input type="number" min="0" max="12" name="holidaysAllowed" value="${d.holidaysAllowed}" required /></div>
      <div><label>Entry fee (${app.state.appSettings.currency})</label><input type="number" step="0.01" min="0" name="entryFee" value="${d.entryFee}" required /></div>
      <div><label>Start date</label><input type="date" name="startDate" value="${d.startDate}" required /></div>
      <div><label>Weigh day</label><select name="weighDay">${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((x, i) => `<option value="${i}" ${String(i) === String(d.weighDay) ? 'selected' : ''}>${x}</option>`).join('')}</select></div>

      <div class="card" style="grid-column:1/-1"><div class="row between"><strong>Users (${count})</strong><div class="row">${SubmitButton.render({ text: 'Toggle all', icon: 'select_all', theme: 'secondary small', attrs: { 'type': 'button', 'data-user-toggle': 'all' } })}</div></div>
        <div class="grid three" style="margin-top:8px">${d.allNames.map((n) => `<label class="row"><input type="checkbox" data-user-name="${Utils.escAttr(n)}" data-label="${Utils.escAttr(n)}" ${d.selectedNames.includes(n) ? 'checked' : ''} style="width:auto"/> ${Utils.esc(n)}</label>`).join('') || '<p class="muted">No users yet.</p>'}</div>
        <div style="margin-top:8px">
          <label for="new-user-name">Add user full name</label>
          <div class="row"><input id="new-user-name" type="text" autocomplete="name" placeholder="Add new user full name" value="${Utils.escAttr(d.newName || '')}"/>${SubmitButton.render({ text: 'Add', icon: 'person_add', attrs: { 'type': 'button', 'data-add-user': '1' } })}</div>
        </div>
      </div>

      <div class="card" style="grid-column:1/-1">
        <div class="row between"><strong>Prize payout calculator</strong><span class="tag">Pool ${Utils.money(totalPrize, app.state.appSettings.currency)}</span></div>
        <label>Mode</label><select name="payoutMode" id="payout-mode">
          <option value="preset3" ${d.payoutMode === 'preset3' ? 'selected' : ''}>Pay top 3</option>
          <option value="preset5" ${d.payoutMode === 'preset5' ? 'selected' : ''}>Pay top 5</option>
          <option value="preset7" ${d.payoutMode === 'preset7' ? 'selected' : ''}>Pay top 7</option>
          <option value="custom" ${d.payoutMode === 'custom' ? 'selected' : ''}>Custom</option>
        </select>
        <div id="payout-rows" class="grid three" style="margin-top:8px">
        ${rows.map((v, i) => `<div><label>Rank ${i + 1}</label><div class="row">${SubmitButton.render({ text: '-', icon: 'remove', theme: 'secondary', attrs: { 'type': 'button', 'data-pay-adjust': '-1', 'data-pay-index': String(i) } })}<input type="number" step="0.01" data-pay-index="${i}" value="${Utils.safeNum(v)}"/>${SubmitButton.render({ text: '+', icon: 'add', theme: 'secondary', attrs: { 'type': 'button', 'data-pay-adjust': '1', 'data-pay-index': String(i) } })}</div></div>`).join('')}
        </div>
        <p class="small ${over ? 'error' : 'muted'}">Entered total: ${Utils.money(sum, app.state.appSettings.currency)} ${over ? '(cannot exceed pool)' : ''}</p>
      </div>

      <div style="grid-column:1/-1" class="row">
        ${SubmitButton.render({ text: 'Create Round', icon: 'add_circle', submit: true })}
        ${SubmitButton.render({ text: 'Cancel', icon: 'close', theme: 'secondary', attrs: { 'type': 'button', 'data-go': 'rounds' } })}
      </div>
    </form></div>`;
}

export function bindCreateRoundEvents(app) {
  const createForm = document.getElementById('create-form');
  if (!createForm) return;

  createForm.oninput = (e) => {
    const d = app.state.createDraft;
    if (!d) return;
    if (['title', 'weeksCount', 'holidaysAllowed', 'entryFee', 'startDate', 'weighDay'].includes(e.target.name)) d[e.target.name] = e.target.value;
    if (e.target.name === 'payoutMode') {
      d.payoutMode = e.target.value;
      const size = d.payoutMode === 'preset3' ? 3 : d.payoutMode === 'preset5' ? 5 : d.payoutMode === 'preset7' ? 7 : d.customMemory.length || 3;
      if (d.payoutMode !== 'custom') {
        const pool = Utils.round2(Utils.safeNum(d.entryFee) * d.selectedNames.length);
        const even = size ? Utils.round2(pool / size) : 0;
        d.presetCurrent = Array.from({ length: size }, (_, i) => i === size - 1 ? String(Utils.round2(pool - (even * (size - 1)))) : String(even));
      }
      app.render();
    }
    if (e.target.dataset.payIndex !== undefined) {
      const idx = Number(e.target.dataset.payIndex);
      const arr = d.payoutMode === 'custom' ? d.customMemory : d.presetCurrent;
      arr[idx] = e.target.value;
    }
  };

  createForm.querySelectorAll('[data-user-name]').forEach((c) => c.onchange = () => {
    const d = app.state.createDraft;
    const name = c.dataset.userName;
    if (c.checked) d.selectedNames = [...new Set([...d.selectedNames, name])];
    else d.selectedNames = d.selectedNames.filter((x) => x !== name);
    app.render();
  });

  const toggle = createForm.querySelector('[data-user-toggle="all"]');
  if (toggle) toggle.onclick = () => {
    const d = app.state.createDraft;
    d.selectedNames = d.selectedNames.length === d.allNames.length ? [] : [...d.allNames];
    app.render();
  };

  const addUser = createForm.querySelector('[data-add-user="1"]');
  if (addUser) addUser.onclick = () => {
    const d = app.state.createDraft;
    const val = document.getElementById('new-user-name').value.trim();
    if (!val) return;
    if (!d.allNames.includes(val)) d.allNames.push(val);
    if (!d.selectedNames.includes(val)) d.selectedNames.push(val);
    d.newName = '';
    app.render();
  };

  createForm.querySelectorAll('[data-pay-adjust]').forEach((b) => b.onclick = () => {
    const d = app.state.createDraft;
    const i = Number(b.dataset.payIndex);
    const inc = Number(b.dataset.payAdjust);
    const arr = d.payoutMode === 'custom' ? d.customMemory : d.presetCurrent;
    arr[i] = String(Math.max(0, Utils.round2(Utils.safeNum(arr[i]) + inc)));
    app.render();
  });

  app.bindAsyncFormSubmit(createForm, async () => {
    const d = app.state.createDraft;
    const payout = (d.payoutMode === 'custom' ? d.customMemory : d.presetCurrent).map((v) => Utils.round2(Utils.safeNum(v)));
    const totalPrize = Utils.round2(Utils.safeNum(d.entryFee) * d.selectedNames.length);
    const sum = Utils.round2(payout.reduce((a, b) => a + b, 0));
    if (!d.selectedNames.length) return app.fail('Select at least one participant.');
    if (sum > totalPrize) return app.fail('Prize splits cannot exceed prize pool.');
    if (Domain.activeRound(app.state.rounds)) return app.fail('Only one active round is allowed.');
    await ChallengeService.createRound({
      title: d.title.trim(),
      weeksCount: Utils.safeNum(d.weeksCount),
      holidaysAllowed: Utils.safeNum(d.holidaysAllowed),
      entryFee: Utils.safeNum(d.entryFee),
      startDate: d.startDate,
      weighDay: Utils.safeNum(d.weighDay),
      userNames: d.selectedNames,
      payoutMode: d.payoutMode,
      prizeSplits: payout
    });
    app.state.createDraft = null;
    await app.refresh();
    app.setMessage('Challenge round created.');
    app.navigate('overview', { keepFlash: true });
  });
}
