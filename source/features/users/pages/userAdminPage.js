import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { SubmissionService } from '../../submission/classes/submissionService.js';
import { UsersService } from '../classes/usersService.js';
import { InvitesService } from '../../invites/classes/invitesService.js';
import { AuthService } from '../../authentication/classes/authService.js';
import { Security } from '../../../shared/classes/security.js';
import { generateInviteCode } from '../../invites/utils/inviteCodeUtils.js';

// =============================================================================
// USER ADMIN PAGE — View/edit individual user, manage type, invite, delete
// =============================================================================
export function renderUserAdminPage(app) {
  if (!app.isAdmin()) return app._renderDenied();
  const user = app.state.users.find((u) => u.id === app.state.selectedUserId) || null;
  if (!user) {
    return `<div class="card" style="max-width:640px;margin:0 auto">
      <h2 style="margin-top:0">User not found</h2>
      <p class="muted">The selected user no longer exists.</p>
      ${SubmitButton.render({ text: 'Back to users', icon: 'arrow_back', theme: 'secondary', attrs: { 'type': 'button', 'data-go': 'users' } })}
    </div>`;
  }
  const stats = SubmissionService.userStats(user, app.state.rounds, app.state.submissions, app.state.users);
  const typeOptions = UsersService.managedUserTypeOptions(user);
  const pendingInvites = app.isFirebaseMode() ? app.state.invites.filter((invite) => !invite.usedAt && invite.userId === user.id) : [];
  const typeLocked = typeOptions.length === 1;
  const canDelete = !user.isMaster && user.id !== app.state.currentUser?.id;
  return `<div class="card" style="max-width:760px;margin:0 auto">
    <div class="row between" style="margin-bottom:12px">
      <div>
        <h2 style="margin:0">${Utils.esc(Utils.fullName(user))}</h2>
        <div class="small muted">${Utils.esc(UsersService.roleLabel(user))} • ${Utils.esc(UsersService.userLoginLabel(user))}</div>
      </div>
      ${SubmitButton.render({ text: 'Back to users', icon: 'arrow_back', theme: 'secondary', attrs: { 'type': 'button', 'data-go': 'users' } })}
    </div>

    <div class="grid two" style="margin-bottom:12px">
      <div class="card"><strong>Rounds participated</strong><div>${stats.roundsParticipated}</div></div>
      <div class="card"><strong>Current challenge</strong><div>${stats.inCurrentRound ? 'In current round' : 'Not in current round'}</div></div>
      <div class="card"><strong>Total cash won</strong><div>${Utils.money(stats.totalCashWon, app.state.appSettings.currency)}</div></div>
      <div class="card"><strong>Total weight lost/gained</strong><div>${stats.totalWeightDelta}${app.state.appSettings.weightFormat}</div></div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <h3 style="margin-top:0">User details</h3>
      <form id="edit-user-form" class="grid two">
        <div><label>First name</label><input name="firstName" type="text" required autocomplete="given-name" value="${Utils.escAttr(user.firstName || '')}" /></div>
        <div><label>Last name</label><input name="lastName" type="text" autocomplete="family-name" value="${Utils.escAttr(user.lastName || '')}" /></div>
        <div style="grid-column:1/-1"><label>Email / login</label><input name="username" type="text" disabled value="${Utils.escAttr(user.username || '')}" placeholder="No login email" /></div>
        <div style="grid-column:1/-1" class="row">${SubmitButton.render({ text: 'Save user', icon: 'save', submit: true })}</div>
      </form>
    </div>

    <div class="card" style="margin-bottom:12px">
      <h3 style="margin-top:0">User type</h3>
      <form id="user-type-form" class="grid two">
        <div><label>Type</label><select name="userType" ${typeLocked ? 'disabled' : ''}>${typeOptions.map((option) => `<option value="${option.value}" ${option.value === (user.userType || 'user') ? 'selected' : ''}>${option.label}</option>`).join('')}</select></div>
        <div class="small muted" style="align-self:end">${user.isMaster ? 'Master type is locked.' : typeLocked ? 'This participant cannot be promoted from this page.' : 'Changing to participant removes login access.'}</div>
        <div style="grid-column:1/-1" class="row">${SubmitButton.render({ text: 'Save type', icon: 'manage_accounts', theme: 'secondary', submit: true, attrs: typeLocked ? { disabled: 'true' } : {} })}</div>
      </form>
    </div>

    <div class="card">
      <h3 style="margin-top:0">Actions</h3>
      <div class="row" style="flex-wrap:wrap">
        ${((!app.isFirebaseMode() && user.canLogin !== false) || (app.isFirebaseMode() && !!user.firebaseUid)) ? SubmitButton.render({ text: 'Reset password', icon: 'password', theme: 'secondary', id: 'btn-reset-user-password', attrs: { 'type': 'button' } }) : ''}
        ${(app.isFirebaseMode() && user.userType === 'participant' && !user.firebaseUid) ? `${SubmitButton.render({ text: 'Invite as user', icon: 'person_add', theme: 'secondary', attrs: { 'type': 'button', 'data-user-invite': 'user' } })}${SubmitButton.render({ text: 'Invite as admin', icon: 'person_add', theme: 'secondary', attrs: { 'type': 'button', 'data-user-invite': 'admin' } })}` : ''}
        ${pendingInvites.map((invite) => SubmitButton.render({ text: `View ${Utils.esc(invite.inviteType || 'user')} invite`, icon: 'qr_code', theme: 'secondary', attrs: { 'type': 'button', 'data-view-invite': invite.id } })).join('')}
        ${canDelete ? SubmitButton.render({ text: 'Delete user', icon: 'delete', theme: 'danger', id: 'btn-delete-user', attrs: { 'type': 'button' } }) : ''}
      </div>
    </div>
  </div>`;
}

export function bindUserAdminEvents(app) {
  const editUserForm = document.getElementById('edit-user-form');
  if (editUserForm && app.state.selectedUserId) {
    app.bindAsyncFormSubmit(editUserForm, async () => {
      const user = app.state.users.find((u) => u.id === app.state.selectedUserId) || null;
      if (!user) return app.fail('User not found.');
      const firstName = editUserForm.firstName.value.trim();
      const lastName = editUserForm.lastName.value.trim();
      if (!firstName) return app.fail('First name is required.');
      const ok = await app._saveWithConflictResolver('User', { ...user, firstName, lastName }, (payload) => UsersService.updateUser(payload));
      if (!ok) return;
      await app.refresh();
      app.setMessage('User update saved.');
      app.render();
    });
  }

  const userTypeForm = document.getElementById('user-type-form');
  if (userTypeForm && app.state.selectedUserId) {
    app.bindAsyncFormSubmit(userTypeForm, async () => {
      const user = app.state.users.find((u) => u.id === app.state.selectedUserId) || null;
      if (!user) return app.fail('User not found.');
      const nextType = userTypeForm.userType.value;
      const allowed = UsersService.managedUserTypeOptions(user).map((option) => option.value);
      if (!allowed.includes(nextType)) return app.fail('This user type cannot be set from this page.');
      if (user.isMaster || nextType === 'master') return app.fail('Master role cannot be changed.');
      if (user.id === app.state.currentUser.id && nextType !== 'admin') return app.fail('You cannot remove your own admin access.');
      const ok = await app._saveWithConflictResolver('User', {
        ...user,
        userType: nextType,
        isAdmin: nextType === 'admin',
        isMaster: false,
        canLogin: nextType !== 'participant'
      }, (payload) => UsersService.updateUser(payload));
      if (!ok) return;
      await app.refresh();
      app.setMessage('User type updated.');
      app.render();
    });
  }

  const resetUserPassword = document.getElementById('btn-reset-user-password');
  if (resetUserPassword) resetUserPassword.onclick = async () => {
    const user = app.state.users.find((u) => u.id === app.state.selectedUserId) || null;
    if (!user) return app.fail('User not found.');
    if (app.isFirebaseMode()) {
      const email = user.username;
      if (!email) return app.fail('No email address on record for this user.');
      try {
        await AuthService.sendPasswordResetEmail(email);
        app.setMessage(`Password reset email sent to ${email}.`);
        app.render();
      } catch (err) {
        app.fail(`Failed to send reset email: ${err.message || err}`);
      }
      return;
    }
    const password = prompt(`New password for ${Utils.fullName(user)}:`);
    if (password === null) return;
    if (!Utils.validPassword(password)) return app.fail('Password must include 8+ chars, letter, number and symbol.');
    const confirmPwd = prompt('Confirm new password:');
    if (confirmPwd !== password) return app.fail('Passwords do not match.');
    const hash = await Security.createPasswordRecord(password);
    const ok = await app._saveWithConflictResolver('User', { ...user, password: hash }, (payload) => UsersService.updateUser(payload));
    if (!ok) return;
    await app.refresh();
    app.setMessage('Password updated.');
    app.render();
  };

  document.querySelectorAll('[data-user-invite]').forEach((button) => button.onclick = async () => {
    const user = app.state.users.find((u) => u.id === app.state.selectedUserId) || null;
    if (!user) return app.fail('User not found.');
    if (!app.isFirebaseMode()) return app.fail('Invites are unavailable in offline mode.');
    const inviteType = button.dataset.userInvite;
    const existing = app.state.invites.find((invite) => !invite.usedAt && invite.userId === user.id && invite.inviteType === inviteType);
    const code = existing?.code || generateInviteCode();
    const invite = {
      id: existing?.id || code,
      code,
      userId: user.id,
      inviteType,
      createdAt: new Date().toISOString(),
      usedAt: null,
      usedBy: null
    };
    await InvitesService.createInvite(invite);
    const ok = await app._saveWithConflictResolver('User', {
      ...user,
      userType: inviteType,
      isAdmin: inviteType === 'admin',
      canLogin: true,
      inviteCode: code,
      invitedAt: invite.createdAt,
      inviteAcceptedAt: null
    }, (payload) => UsersService.updateUser(payload));
    if (!ok) return;
    await app.refresh();
    app.state.inviteDetail = invite;
    app.navigate('invite-detail', { keepFlash: true });
  });

  const deleteUserButton = document.getElementById('btn-delete-user');
  if (deleteUserButton) deleteUserButton.onclick = async () => {
    const user = app.state.users.find((u) => u.id === app.state.selectedUserId) || null;
    if (!user) return app.fail('User not found.');
    if (user.isMaster) return app.fail('Master admin cannot be deleted.');
    if (user.id === app.state.currentUser.id) return app.fail('You cannot delete your own account.');
    if (!confirm(`Delete ${Utils.fullName(user)}? This cannot be undone.`)) return;
    await UsersService.deleteUser(user.id);
    app.state.selectedUsers = app.state.selectedUsers.filter((id) => id !== user.id);
    app.state.selectedUserId = null;
    await app.refresh();
    app.setMessage('User deleted.');
    app.navigate('users', { keepFlash: true, replace: true });
  };
}
