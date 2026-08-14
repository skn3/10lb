import { Domain } from '../../../domain.js';
import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { SubmissionStatusPanel } from '../../../shared/components/submissionStatusPanel.js';
import { SubmissionService } from '../classes/submissionService.js';
import { ChallengeService } from '../../challenges/classes/challengeService.js';

// =============================================================================
// SUBMIT PAGE — Weekly weight/holiday/forfeit submission
// =============================================================================
export function renderSubmitPage(app) {
  const round = Domain.activeRound(app.state.rounds);
  if (!round) return `<div class="card"><p class="error">Weekly submissions are only available when a challenge is active.</p></div>`;
  const subs = Domain.submissionsByRound(app.state.submissions, round.id);
  const week = Domain.calcCurrentWeek(round, app.state.users, subs);
  const unit = app.state.appSettings.weightFormat || 'lb';

  const statusPanel = app.isAdmin()
    ? SubmissionStatusPanel.render(round, app.state.users, subs, week, { hideSubmitButton: true })
    : '';

  // Normal (non-admin) user view
  if (!app.isAdmin()) {
    const userId = app.state.currentUser.id;

    if (Domain.isForfeit(subs, userId, week)) {
      return `<div class="card"><h2 style="margin-top:0">User Weekly Submission</h2>
        <p class="small muted">Active round: ${Utils.esc(round.title)} • Week ${week}</p>
        <p class="error">You have forfeited this challenge round. You can no longer submit weights.</p>
      </div>`;
    }

    const existing = Domain.submissionFor(subs, week, userId);
    if (existing) {
      let submittedMsg = '';
      if (existing.type === 'weight') {
        submittedMsg = `<p>Your submitted weight for week ${week}: <strong>${existing.weight}${unit}</strong></p>`;
      } else if (existing.type === 'holiday') {
        submittedMsg = `<p>You are on holiday this week (week ${week}).</p>`;
      } else {
        submittedMsg = `<p>Submission recorded for week ${week}: <strong>${Utils.esc(existing.type)}</strong></p>`;
      }
      const canEdit = !Domain.isWeekFinished(round, week);
      return `<div class="card"><h2 style="margin-top:0">User Weekly Submission</h2>
        <p class="small muted">Active round: ${Utils.esc(round.title)} • Week ${week}</p>
        ${submittedMsg}
        ${canEdit ? `<p class="small muted">The week has not been finalised yet. You may edit your submission.</p>
        ${SubmitButton.render({ text: 'Edit Submission', icon: 'edit', theme: 'secondary', attrs: { 'data-edit-submission': existing.id } })}` : `<p class="small muted">This week has been finalised and can no longer be edited.</p>`}
      </div>`;
    }
  }

  // Admin all-submitted check
  if (app.isAdmin()) {
    const allDone = Domain.isWeekComplete(round, app.state.users, subs, week);
    if (allDone) {
      return `<div class="card"><h2 style="margin-top:0">User Weekly Submission</h2>
        <p class="small muted">Active round: ${Utils.esc(round.title)} • Week ${week}</p>
        ${statusPanel}
        <p class="muted">All submissions for week ${week} have been completed.</p>
        ${SubmitButton.render({ text: 'Finish Week', icon: 'task_alt', attrs: { 'data-go': 'finish-week' } })}
      </div>`;
    }
  }

  let users = Domain.roundUsers(round, app.state.users)
    .filter((u) => (!u.invitedAt || !!u.inviteAcceptedAt))
    .filter((u) => !Domain.isForfeit(subs, u.id, week));
  users = users.filter((u) => !Domain.submissionFor(subs, week, u.id));
  if (!app.isAdmin()) users = users.filter((u) => u.id === app.state.currentUser.id);

  return `<div class="card"><h2 style="margin-top:0">User Weekly Submission</h2>
    <p class="small muted">Active round: ${Utils.esc(round.title)} • Week ${week}</p>
    ${statusPanel}
    <form id="submit-form" class="grid two">
      <div><label>User</label><select name="userId" ${!app.isAdmin() ? 'disabled' : ''} required>
        ${users.length ? users.map((u) => `<option value="${u.id}" ${u.id === app.state.currentUser.id ? 'selected' : ''}>${Utils.esc(Utils.fullName(u))}</option>`).join('') : '<option value="">No user available</option>'}
      </select>
      ${!app.isAdmin() ? `<input type="hidden" name="userId" value="${Utils.escAttr(app.state.currentUser.id)}" />` : ''}
      </div>
      <div><label>Action</label><select name="action" required><option value="weight">Upload weight</option><option value="holiday">Holiday</option><option value="forfeit">Forfeit</option></select></div>
      <div id="weight-fields" style="grid-column:1/-1" class="grid two">
        <div><label>Scale photo</label><input name="photo" type="file" accept="image/*" /></div>
        <div><label>Weight (${app.state.appSettings.weightFormat})</label><input name="weight" type="number" step="0.01" min="1" inputmode="decimal" /></div>
      </div>
      <div id="holiday-note" class="small muted" style="grid-column:1/-1"></div>
      <div id="forfeit-confirm-wrap" class="hidden" style="grid-column:1/-1">
        <label for="forfeit-confirm">Confirm forfeit</label>
        <label class="row"><input type="checkbox" id="forfeit-confirm" data-label="Confirm forfeit" style="width:auto"/> Confirm user forfeit</label>
      </div>
      <div style="grid-column:1/-1" class="row">${SubmitButton.render({ text: 'Submit', icon: 'publish', submit: true })}</div>
    </form></div>`;
}

export function bindSubmitEvents(app) {
  const submitForm = document.getElementById('submit-form');
  if (!submitForm) return;

  const updateSubmitUI = () => {
    const round = Domain.activeRound(app.state.rounds);
    if (!round) return;
    const userId = submitForm.userId.value || app.state.currentUser?.id;
    const action = submitForm.action.value;
    const subs = Domain.submissionsByRound(app.state.submissions, round.id);
    const week = Domain.calcCurrentWeek(round, app.state.users, subs);
    const holidayNote = document.getElementById('holiday-note');
    const weightFields = document.getElementById('weight-fields');
    const forfeitWrap = document.getElementById('forfeit-confirm-wrap');
    const weightInput = submitForm.querySelector('[name="weight"]');
    const forfeitConfirm = document.getElementById('forfeit-confirm');
    weightFields.classList.toggle('hidden', action !== 'weight');
    forfeitWrap.classList.toggle('hidden', action !== 'forfeit');
    if (weightInput) weightInput.required = action === 'weight';
    if (forfeitConfirm) forfeitConfirm.required = action === 'forfeit';
    if (action === 'holiday' && userId) {
      const used = Domain.holidaysUsed(subs, userId, week);
      holidayNote.textContent = `Holidays used: ${used} / ${round.holidaysAllowed}`;
      holidayNote.className = used >= round.holidaysAllowed ? 'small error' : 'small muted';
    } else holidayNote.textContent = '';
  };
  submitForm.onchange = updateSubmitUI;
  updateSubmitUI();

  app.bindAsyncFormSubmit(submitForm, async () => {
    const round = Domain.activeRound(app.state.rounds);
    if (!round) return app.fail('No active challenge.');
    const subs = Domain.submissionsByRound(app.state.submissions, round.id);
    const week = Domain.calcCurrentWeek(round, app.state.users, subs);
    const userId = submitForm.userId.value || app.state.currentUser.id;
    const action = submitForm.action.value;
    if (!userId) return app.fail('Select a user.');
    if (!app.isAdmin() && userId !== app.state.currentUser.id) return app.fail('You can only submit weights for yourself.');
    if (Domain.isForfeit(subs, userId, week)) return app.fail('User has already forfeited.');
    if (Domain.submissionFor(subs, week, userId)) return app.fail('User already submitted this week.');

    let weight = null;
    let photoName = null;
    if (action === 'weight') {
      weight = Utils.round2(Utils.safeNum(submitForm.weight.value));
      if (!weight || weight <= 0) return app.fail('Enter a valid weight.');
      photoName = submitForm.photo.files?.[0]?.name || null;
    }
    if (action === 'holiday') {
      const used = Domain.holidaysUsed(subs, userId, week);
      if (used >= round.holidaysAllowed) return app.fail('No holidays remaining for this user.');
    }
    if (action === 'forfeit') {
      if (!document.getElementById('forfeit-confirm').checked) return app.fail('Confirm forfeit first.');
    }

    const submission = {
      id: Utils.id(), roundId: round.id, weekNumber: week, userId,
      type: action, weight, photoName,
      createdAt: new Date().toISOString()
    };

    const nextSubs = [...subs, submission];
    const snapshotData = Domain.weekView(round, app.state.users, nextSubs, week);
    const snapshot = {
      id: `${round.id}:${week}`,
      roundId: round.id,
      weekNumber: week,
      generatedAt: new Date().toISOString(),
      data: snapshotData
    };

    await SubmissionService.recordSubmission(submission, snapshot);
    const finalComplete = Domain.isWeekComplete(round, app.state.users, nextSubs, round.weeksCount);
    if (finalComplete && round.status === 'active') {
      await app._saveWithConflictResolver('Round', { ...round, status: 'completed' }, (payload) => ChallengeService.updateRound(payload));
    }

    await app.refresh();
    app.setMessage('Submission saved.');
    app.render();
  });
}
