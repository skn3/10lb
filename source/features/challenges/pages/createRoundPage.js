import { Domain } from '../../../domain.js';
import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { ChallengeService } from '../classes/challengeService.js';
import { DeniedPage } from '../../app/pages/deniedPage.js';

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

const React = window.React;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function CreateRoundPage({ app }) {
  const e = React.createElement;
  const formRef = React.useRef(null);

  React.useEffect(() => {
    if (!app.isAdmin() || Domain.activeRound(app.state.rounds)) return;
    const form = formRef.current;
    if (!form) return;

    app.bindAsyncFormSubmit(form, async () => {
      const d = app.state.createDraft;
      if (!d) return;
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
  });

  if (!app.isAdmin()) return e(DeniedPage, { app });

  const active = Domain.activeRound(app.state.rounds);
  if (active) {
    return e('div', { className: 'card' },
      e('p', { className: 'error' }, 'A challenge is already active.'),
      e('button', { type: 'button', className: 'btn secondary', onClick: () => app.navigate('rounds') },
        e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'list_alt'), ' Go to round list')
    );
  }

  if (!app.state.createDraft) app.state.createDraft = ChallengeService.buildCreateDefaults(app.state.rounds, app.state.users);
  const d = app.state.createDraft;

  const currency = app.state.appSettings?.currency || '£';
  const count = d.selectedNames.length;
  const totalPrize = Utils.round2(Utils.safeNum(d.entryFee) * count);
  const rows = d.payoutMode === 'custom' ? d.customMemory : d.presetCurrent;
  const sum = Utils.round2(rows.reduce((a, b) => a + Utils.safeNum(b), 0));
  const over = sum > totalPrize;

  const handleFieldChange = (ev) => {
    const t = ev.target;
    if (['title', 'weeksCount', 'holidaysAllowed', 'entryFee', 'startDate', 'weighDay'].includes(t.name)) d[t.name] = t.value;
    if (t.name === 'payoutMode') {
      d.payoutMode = t.value;
      const size = d.payoutMode === 'preset3' ? 3 : d.payoutMode === 'preset5' ? 5 : d.payoutMode === 'preset7' ? 7 : d.customMemory.length || 3;
      if (d.payoutMode !== 'custom') {
        const pool = Utils.round2(Utils.safeNum(d.entryFee) * d.selectedNames.length);
        const even = size ? Utils.round2(pool / size) : 0;
        d.presetCurrent = Array.from({ length: size }, (_, i) => i === size - 1 ? String(Utils.round2(pool - (even * (size - 1)))) : String(even));
      }
      app.render();
      return;
    }
    if (t.dataset.payIndex !== undefined && t.type === 'number') {
      const idx = Number(t.dataset.payIndex);
      const arr = d.payoutMode === 'custom' ? d.customMemory : d.presetCurrent;
      arr[idx] = t.value;
    }
  };

  const handleUserCheck = (name, checked) => {
    if (checked) d.selectedNames = [...new Set([...d.selectedNames, name])];
    else d.selectedNames = d.selectedNames.filter((x) => x !== name);
    app.render();
  };

  const handleToggleAll = () => {
    d.selectedNames = d.selectedNames.length === d.allNames.length ? [] : [...d.allNames];
    app.render();
  };

  const handleAddUser = () => {
    const input = formRef.current?.querySelector('#new-user-name');
    const val = input?.value.trim();
    if (!val) return;
    if (!d.allNames.includes(val)) d.allNames.push(val);
    if (!d.selectedNames.includes(val)) d.selectedNames.push(val);
    d.newName = '';
    app.render();
  };

  const handlePayAdjust = (idx, inc) => {
    const arr = d.payoutMode === 'custom' ? d.customMemory : d.presetCurrent;
    arr[idx] = String(Math.max(0, Utils.round2(Utils.safeNum(arr[idx]) + inc)));
    app.render();
  };

  return e('div', { className: 'card' },
    e('h2', { style: { marginTop: 0 } }, 'Create Challenge Round'),
    e('form', { ref: formRef, action: '#', className: 'grid two', onChange: handleFieldChange },
      e('div', null, e('label', null, 'Round title'), e('input', { name: 'title', type: 'text', required: true, defaultValue: d.title })),
      e('div', null, e('label', null, 'Number of weeks'), e('input', { type: 'number', min: '1', max: '52', name: 'weeksCount', defaultValue: d.weeksCount, required: true })),
      e('div', null, e('label', null, 'Number of holidays'), e('input', { type: 'number', min: '0', max: '12', name: 'holidaysAllowed', defaultValue: d.holidaysAllowed, required: true })),
      e('div', null, e('label', null, `Entry fee (${currency})`), e('input', { type: 'number', step: '0.01', min: '0', name: 'entryFee', defaultValue: d.entryFee, required: true })),
      e('div', null, e('label', null, 'Start date'), e('input', { type: 'date', name: 'startDate', defaultValue: d.startDate, required: true })),
      e('div', null, e('label', null, 'Weigh day'),
        e('select', { name: 'weighDay' },
          ...DAYS.map((day, i) => e('option', { key: i, value: String(i), selected: String(i) === String(d.weighDay) || undefined }, day))
        )
      ),
      e('div', { className: 'card', style: { gridColumn: '1/-1' } },
        e('div', { className: 'row between' },
          e('strong', null, `Users (${count})`),
          e('div', { className: 'row' },
            e('button', { type: 'button', className: 'btn secondary small', onClick: handleToggleAll }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'select_all'), ' Toggle all')
          )
        ),
        e('div', { className: 'grid three', style: { marginTop: '8px' } },
          d.allNames.length
            ? d.allNames.map((n) => e('label', { key: n, className: 'row' },
                e('input', { type: 'checkbox', 'data-user-name': n, 'data-label': n, checked: d.selectedNames.includes(n), style: { width: 'auto' }, onChange: (ev) => handleUserCheck(n, ev.target.checked) }),
                ' ', n
              ))
            : e('p', { className: 'muted' }, 'No users yet.')
        ),
        e('div', { style: { marginTop: '8px' } },
          e('label', { htmlFor: 'new-user-name' }, 'Add user full name'),
          e('div', { className: 'row' },
            e('input', { id: 'new-user-name', type: 'text', autoComplete: 'name', placeholder: 'Add new user full name', defaultValue: d.newName || '' }),
            e('button', { type: 'button', className: 'btn', onClick: handleAddUser }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'person_add'), ' Add')
          )
        )
      ),
      e('div', { className: 'card', style: { gridColumn: '1/-1' } },
        e('div', { className: 'row between' },
          e('strong', null, 'Prize payout calculator'),
          e('span', { className: 'tag' }, `Pool ${Utils.money(totalPrize, currency)}`)
        ),
        e('label', null, 'Mode'),
        e('select', { name: 'payoutMode' },
          e('option', { value: 'preset3', selected: d.payoutMode === 'preset3' || undefined }, 'Pay top 3'),
          e('option', { value: 'preset5', selected: d.payoutMode === 'preset5' || undefined }, 'Pay top 5'),
          e('option', { value: 'preset7', selected: d.payoutMode === 'preset7' || undefined }, 'Pay top 7'),
          e('option', { value: 'custom', selected: d.payoutMode === 'custom' || undefined }, 'Custom')
        ),
        e('div', { className: 'grid three', style: { marginTop: '8px' } },
          ...rows.map((v, i) =>
            e('div', { key: i },
              e('label', null, `Rank ${i + 1}`),
              e('div', { className: 'row' },
                e('button', { type: 'button', className: 'btn secondary', onClick: () => handlePayAdjust(i, -1) }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'remove')),
                e('input', { type: 'number', step: '0.01', 'data-pay-index': String(i), defaultValue: Utils.safeNum(v) }),
                e('button', { type: 'button', className: 'btn secondary', onClick: () => handlePayAdjust(i, 1) }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'add'))
              )
            )
          )
        ),
        e('p', { className: `small ${over ? 'error' : 'muted'}` }, `Entered total: ${Utils.money(sum, currency)}${over ? ' (cannot exceed pool)' : ''}`)
      ),
      e('div', { style: { gridColumn: '1/-1' }, className: 'row' },
        e('button', { type: 'submit', className: 'btn' }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'add_circle'), ' Create Round'),
        e('button', { type: 'button', className: 'btn secondary', onClick: () => app.navigate('rounds') }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'close'), ' Cancel')
      )
    )
  );
}
