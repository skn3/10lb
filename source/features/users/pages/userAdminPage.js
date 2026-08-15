import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { ThemePicker } from '../../../shared/components/themePicker.js';
import { ThemeOptions } from '../../../constants.js';
import { SubmissionService } from '../../submission/classes/submissionService.js';
import { UsersService } from '../classes/usersService.js';
import { InvitesService } from '../../invites/classes/invitesService.js';
import { AuthService } from '../../authentication/classes/authService.js';
import { Security } from '../../../shared/classes/security.js';
import { generateInviteCode } from '../../invites/utils/inviteCodeUtils.js';
import { AppStore } from '../../../shared/classes/appStore.js';
import { Tabs } from '../../../shared/components/tabs.js';
import { DeniedPage } from '../../app/pages/deniedPage.js';

const React = window.React;

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
    </div>`;
  }
  const isOwnAccount = user.id === app.state.currentUser?.id;
  const stats = SubmissionService.userStats(user, app.state.rounds, app.state.submissions, app.state.users);
  const typeOptions = UsersService.managedUserTypeOptions(user);
  const pendingInvites = app.isFirebaseMode() ? app.state.invites.filter((invite) => !invite.usedAt && invite.userId === user.id) : [];
  const typeLocked = typeOptions.length === 1;
  const canDelete = !user.isMaster && !isOwnAccount;
  const showUserTypeCard = app.isAdmin() && !isOwnAccount;
  const showResetPassword = !isOwnAccount && ((!app.isFirebaseMode() && user.canLogin !== false) || (app.isFirebaseMode() && !!user.firebaseUid));
  const serverDefaultTheme = app.state.appSettings?.theme || 'teal';
  const currency = app.state.appSettings?.currency || '£';
  const weightFormat = app.state.appSettings?.weightFormat || 'lb';

  const infoContent = `
    <div style="margin-bottom:12px">
      <h2 style="margin:0">${Utils.esc(Utils.fullName(user))}</h2>
      <div class="small muted">${Utils.esc(UsersService.roleLabel(user))} • ${Utils.esc(UsersService.userLoginLabel(user))}</div>
    </div>
    <div class="grid two" style="margin-bottom:12px">
      <div class="card"><strong>Rounds participated</strong><div>${stats.roundsParticipated}</div></div>
      <div class="card"><strong>Current challenge</strong><div>${stats.inCurrentRound ? 'In current round' : 'Not in current round'}</div></div>
      <div class="card"><strong>Total cash won</strong><div>${Utils.money(stats.totalCashWon, currency)}</div></div>
      <div class="card"><strong>Total weight lost/gained</strong><div>${stats.totalWeightDelta}${weightFormat}</div></div>
    </div>
    ${showUserTypeCard ? `<div style="margin-bottom:12px">
      <h3 style="margin-top:0">User type</h3>
      <form id="user-type-form" class="grid two">
        <div><label>Type</label><select name="userType" ${typeLocked ? 'disabled' : ''}>${typeOptions.map((option) => `<option value="${option.value}" ${option.value === (user.userType || 'user') ? 'selected' : ''}>${option.label}</option>`).join('')}</select></div>
        <div class="small muted" style="align-self:end">${user.isMaster ? 'Master type is locked.' : typeLocked ? 'This participant cannot be promoted from this page.' : 'Changing to participant removes login access.'}</div>
        <div style="grid-column:1/-1" class="row">${SubmitButton.render({ text: 'Save type', icon: 'manage_accounts', theme: 'secondary', submit: true, attrs: typeLocked ? { disabled: 'true' } : {} })}</div>
      </form>
    </div>` : ''}
    <div>
      <h3 style="margin-top:0">Actions</h3>
      <div class="row" style="flex-wrap:wrap">
        ${showResetPassword ? SubmitButton.render({ text: 'Reset password', icon: 'password', theme: 'secondary', id: 'btn-reset-user-password', attrs: { 'type': 'button' } }) : ''}
        ${(app.isFirebaseMode() && user.userType === 'participant' && !user.firebaseUid) ? `${SubmitButton.render({ text: 'Invite as user', icon: 'person_add', theme: 'secondary', attrs: { 'type': 'button', 'data-user-invite': 'user' } })}${SubmitButton.render({ text: 'Invite as admin', icon: 'person_add', theme: 'secondary', attrs: { 'type': 'button', 'data-user-invite': 'admin' } })}` : ''}
        ${pendingInvites.map((invite) => SubmitButton.render({ text: `View ${Utils.esc(invite.inviteType || 'user')} invite`, icon: 'qr_code', theme: 'secondary', attrs: { 'type': 'button', 'data-view-invite': invite.id } })).join('')}
        ${canDelete ? SubmitButton.render({ text: 'Delete user', icon: 'delete', theme: 'danger', id: 'btn-delete-user', attrs: { 'type': 'button' } }) : ''}
        ${isOwnAccount ? SubmitButton.render({ text: 'Logout', icon: 'logout', theme: 'secondary', id: 'btn-logout-user', attrs: { 'type': 'button' } }) : ''}
      </div>
    </div>`;

  const detailsContent = `<form id="edit-user-form" class="grid two">
    <div><label>First name</label><input name="firstName" type="text" required autocomplete="given-name" value="${Utils.escAttr(user.firstName || '')}" /></div>
    <div><label>Last name</label><input name="lastName" type="text" autocomplete="family-name" value="${Utils.escAttr(user.lastName || '')}" /></div>
    <div style="grid-column:1/-1"><label>Email / login</label><input name="username" type="text" disabled value="${Utils.escAttr(user.username || '')}" placeholder="No login email" /></div>
    <div style="grid-column:1/-1" class="row">${SubmitButton.render({ text: 'Save user', icon: 'save', submit: true })}</div>
  </form>`;

  const tabs = [
    { key: 'info', label: 'Info', content: infoContent },
    { key: 'details', label: 'User Details', content: detailsContent }
  ];

  if (isOwnAccount) {
    tabs.push({ key: 'settings', label: 'Settings', content: `<form id="user-settings-form" class="grid two">
      <div style="grid-column:1/-1">${ThemePicker.render({ options: ThemeOptions, selectedValue: user.theme || null, defaultTheme: serverDefaultTheme, inputName: 'theme' })}</div>
      <div style="grid-column:1/-1" class="row">${SubmitButton.render({ text: 'Save settings', icon: 'save', theme: 'secondary', submit: true })}</div>
    </form>` });
    tabs.push({ key: 'password', label: 'Change Password', content: `<form id="user-password-form" class="grid two">
      <div><label>Current password</label><input name="currentPassword" type="password" required autocomplete="current-password" /></div>
      <div></div>
      <div><label>New password</label><input name="newPassword" type="password" required ${Utils.passwordInputAttrs('new-password')} /></div>
      <div><label>Confirm new password</label><input name="confirmPassword" type="password" required ${Utils.passwordInputAttrs('new-password')} /></div>
      <div style="grid-column:1/-1">${SubmitButton.render({ text: 'Change password', icon: 'password', theme: 'secondary', submit: true })}</div>
    </form>` });
  }

  const activeTab = app.state.userAdminTab || 'info';
  return `<div style="max-width:760px;margin:0 auto">
    <div class="card">
      ${Tabs.render(tabs, activeTab)}
    </div>
  </div>`;
}

export function bindUserAdminEvents(app) {
  const container = document.querySelector('.tabs-component');
  if (container) {
    Tabs.bind(container, (key) => {
      app.state.userAdminTab = key;
      const userId = app.state.selectedUserId;
      const rawHash = String(window.location.hash || '').replace(/^#\/?/, '');
      const [, queryPart = ''] = rawHash.split('?');
      const params = new URLSearchParams(queryPart);
      params.set('tab', key);
      history.replaceState(null, '', `${window.location.pathname}#/user?${params.toString()}`);
      app.render();
    });
  }

  // Wire ThemePicker live preview for own account settings tab
  const settingsForm = document.getElementById('user-settings-form');
  if (settingsForm) {
    ThemePicker.bind(settingsForm);
  }

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

  const userSettingsForm = document.getElementById('user-settings-form');
  if (userSettingsForm && app.state.selectedUserId) {
    app.bindAsyncFormSubmit(userSettingsForm, async () => {
      const user = app.state.users.find((u) => u.id === app.state.selectedUserId) || null;
      if (!user) return app.fail('User not found.');
      const theme = userSettingsForm.theme?.value || null;
      const ok = await app._saveWithConflictResolver('User', { ...user, theme: theme || null }, (payload) => UsersService.updateUser(payload));
      if (!ok) return;
      await app.refresh();
      app.setMessage('Settings saved.');
      app.render();
    });
  }

  const userPwdForm = document.getElementById('user-password-form');
  if (userPwdForm) {
    app.bindAsyncFormSubmit(userPwdForm, async () => {
      const currentPassword = userPwdForm.currentPassword.value;
      const newPassword = userPwdForm.newPassword.value;
      const confirmPassword = userPwdForm.confirmPassword.value;
      if (!Utils.validPassword(newPassword)) return app.fail('New password must include 8+ chars, letter, number and symbol.');
      if (newPassword !== confirmPassword) return app.fail('Passwords do not match.');

      if (app.isFirebaseMode()) {
        const email = app.state.currentUser?.username;
        try { await AuthService.signInWithEmail(email, currentPassword); } catch { return app.fail('Current password is incorrect.'); }
        try { await AuthService.updateFirebasePassword(newPassword); } catch (err) { return app.fail(`Password update failed: ${err.message || err}`); }
        app.setMessage('Password changed.');
        app.render();
        return;
      }

      const ok = await Security.verifyPassword(currentPassword, app.state.currentUser.password);
      if (!ok) return app.fail('Current password is incorrect.');
      const hash = await Security.createPasswordRecord(newPassword);
      const saved = await app._saveWithConflictResolver('User', { ...app.state.currentUser, password: hash }, (payload) => UsersService.updateUser(payload));
      if (!saved) return;
      await app.refresh();
      app.setMessage('Password changed.');
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

  const logoutBtn = document.getElementById('btn-logout-user');
  if (logoutBtn) logoutBtn.onclick = () => app.logout();

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

export function UserAdminPage({ app }) {
  const e = React.createElement;

  // Compute user before hooks (hooks must be called unconditionally)
  const user = app.state.users.find((entry) => entry.id === app.state.selectedUserId) || null;

  // ── All hooks must be at the top, before any conditional returns ──────────
  const editFormRef = React.useRef(null);
  const settingsFormRef = React.useRef(null);
  const passwordFormRef = React.useRef(null);
  const typeFormRef = React.useRef(null);
  const [theme, setTheme] = React.useState(user?.theme || null);
  const [typeValue, setTypeValue] = React.useState(user?.userType || 'user');

  React.useEffect(() => { setTheme(user?.theme || null); }, [user?.id, user?.theme]);
  React.useEffect(() => { setTypeValue(user?.userType || 'user'); }, [user?.id, user?.userType]);

  React.useEffect(() => {
    const form = editFormRef.current;
    if (!form) return;
    app.bindAsyncFormSubmit(form, async () => {
      const current = app.state.users.find((entry) => entry.id === app.state.selectedUserId) || null;
      if (!current) return app.fail('User not found.');
      const firstName = form.firstName.value.trim();
      const lastName = form.lastName.value.trim();
      if (!firstName) return app.fail('First name is required.');
      const ok = await app._saveWithConflictResolver('User', { ...current, firstName, lastName }, (payload) => UsersService.updateUser(payload));
      if (!ok) return;
      await app.refresh();
      app.setMessage('User update saved.');
      AppStore.dispatch(app, {});
    });
  }, [app]);

  React.useEffect(() => {
    const form = settingsFormRef.current;
    if (!form) return;
    app.bindAsyncFormSubmit(form, async () => {
      const current = app.state.users.find((entry) => entry.id === app.state.selectedUserId) || null;
      if (!current) return app.fail('User not found.');
      const ok = await app._saveWithConflictResolver('User', { ...current, theme: theme || null }, (payload) => UsersService.updateUser(payload));
      if (!ok) return;
      await app.refresh();
      app.setMessage('Settings saved.');
      AppStore.dispatch(app, {});
    });
  }, [app, theme]);

  React.useEffect(() => {
    const form = passwordFormRef.current;
    if (!form) return;
    app.bindAsyncFormSubmit(form, async () => {
      const currentPassword = form.currentPassword.value;
      const newPassword = form.newPassword.value;
      const confirmPassword = form.confirmPassword.value;
      if (!Utils.validPassword(newPassword)) return app.fail('New password must include 8+ chars, letter, number and symbol.');
      if (newPassword !== confirmPassword) return app.fail('Passwords do not match.');
      if (app.isFirebaseMode()) {
        const email = app.state.currentUser?.username;
        try { await AuthService.signInWithEmail(email, currentPassword); } catch { return app.fail('Current password is incorrect.'); }
        try { await AuthService.updateFirebasePassword(newPassword); } catch (err) { return app.fail(`Password update failed: ${err.message || err}`); }
        app.setMessage('Password changed.');
        AppStore.dispatch(app, {});
        return;
      }
      const ok = await Security.verifyPassword(currentPassword, app.state.currentUser.password);
      if (!ok) return app.fail('Current password is incorrect.');
      const hash = await Security.createPasswordRecord(newPassword);
      const saved = await app._saveWithConflictResolver('User', { ...app.state.currentUser, password: hash }, (payload) => UsersService.updateUser(payload));
      if (!saved) return;
      await app.refresh();
      app.setMessage('Password changed.');
      AppStore.dispatch(app, {});
    });
  }, [app]);

  React.useEffect(() => {
    const form = typeFormRef.current;
    if (!form) return;
    app.bindAsyncFormSubmit(form, async () => {
      const current = app.state.users.find((entry) => entry.id === app.state.selectedUserId) || null;
      if (!current) return app.fail('User not found.');
      const allowed = UsersService.managedUserTypeOptions(current).map((option) => option.value);
      if (!allowed.includes(typeValue)) return app.fail('This user type cannot be set from this page.');
      if (current.isMaster || typeValue === 'master') return app.fail('Master role cannot be changed.');
      if (current.id === app.state.currentUser.id && typeValue !== 'admin') return app.fail('You cannot remove your own admin access.');
      const ok = await app._saveWithConflictResolver('User', {
        ...current,
        userType: typeValue,
        isAdmin: typeValue === 'admin',
        isMaster: false,
        canLogin: typeValue !== 'participant'
      }, (payload) => UsersService.updateUser(payload));
      if (!ok) return;
      await app.refresh();
      app.setMessage('User type updated.');
      AppStore.dispatch(app, {});
    });
  }, [app, typeValue]);

  // ── Early returns (after all hooks) ──────────────────────────────────────
  if (!app.isAdmin()) return e(DeniedPage, { app });
  if (!user) {
    return e('div', { className: 'card', style: { maxWidth: '640px', margin: '0 auto' } },
      e('h2', { style: { marginTop: 0 } }, 'User not found'),
      e('p', { className: 'muted' }, 'The selected user no longer exists.')
    );
  }

  const isOwnAccount = user.id === app.state.currentUser?.id;
  const stats = SubmissionService.userStats(user, app.state.rounds, app.state.submissions, app.state.users);
  const typeOptions = UsersService.managedUserTypeOptions(user);
  const pendingInvites = app.isFirebaseMode() ? app.state.invites.filter((invite) => !invite.usedAt && invite.userId === user.id) : [];
  const typeLocked = typeOptions.length === 1;
  const canDelete = !user.isMaster && !isOwnAccount;
  const showUserTypeCard = app.isAdmin() && !isOwnAccount;
  const showResetPassword = !isOwnAccount && ((!app.isFirebaseMode() && user.canLogin !== false) || (app.isFirebaseMode() && !!user.firebaseUid));
  const serverDefaultTheme = app.state.appSettings?.theme || 'teal';

  return e('div', { style: { maxWidth: '760px', margin: '0 auto' } },
    e('div', { className: 'card', style: { marginBottom: '12px' } },
      e('div', { style: { marginBottom: '12px' } },
        e('h2', { style: { margin: 0 } }, Utils.fullName(user)),
        e('div', { className: 'small muted' }, `${UsersService.roleLabel(user)} • ${UsersService.userLoginLabel(user)}`)
      ),
      e('div', { className: 'grid two', style: { marginBottom: 0 } },
        e('div', { className: 'card' }, e('strong', null, 'Rounds participated'), e('div', null, String(stats.roundsParticipated))),
        e('div', { className: 'card' }, e('strong', null, 'Current challenge'), e('div', null, stats.inCurrentRound ? 'In current round' : 'Not in current round')),
        e('div', { className: 'card' }, e('strong', null, 'Total cash won'), e('div', null, Utils.money(stats.totalCashWon, app.state.appSettings.currency))),
        e('div', { className: 'card' }, e('strong', null, 'Total weight lost/gained'), e('div', null, `${stats.totalWeightDelta}${app.state.appSettings.weightFormat}`))
      )
    ),
    e('div', { className: 'card', style: { marginBottom: '12px' } },
      e('h3', { style: { marginTop: 0 } }, 'User details'),
      e('form', { id: 'edit-user-form', ref: editFormRef, action: '#', className: 'grid two' },
        e('div', null, e('label', null, 'First name'), e('input', { name: 'firstName', type: 'text', required: true, autoComplete: 'given-name', defaultValue: user.firstName || '' })),
        e('div', null, e('label', null, 'Last name'), e('input', { name: 'lastName', type: 'text', autoComplete: 'family-name', defaultValue: user.lastName || '' })),
        e('div', { style: { gridColumn: '1/-1' } }, e('label', null, 'Email / login'), e('input', { name: 'username', type: 'text', disabled: true, defaultValue: user.username || '', placeholder: 'No login email' })),
        e('div', { style: { gridColumn: '1/-1' }, className: 'row' },
          e('button', { type: 'submit', className: 'btn' }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'save'), 'Save user'))
      )
    ),
    isOwnAccount
      ? e('div', { className: 'card', style: { marginBottom: '12px' } },
        e('h3', { style: { marginTop: 0 } }, 'Settings'),
        e('form', { id: 'user-settings-form', ref: settingsFormRef, action: '#', className: 'grid two' },
          e('div', { style: { gridColumn: '1/-1' } }, ThemePicker.renderReact({
            options: ThemeOptions,
            selectedValue: theme,
            defaultTheme: serverDefaultTheme,
            inputName: 'theme',
            onChange: (value) => setTheme(value)
          })),
          e('div', { style: { gridColumn: '1/-1' }, className: 'row' },
            e('button', { type: 'submit', className: 'btn secondary' }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'save'), 'Save settings'))
        )
      )
      : null,
    isOwnAccount
      ? e('div', { className: 'card', style: { marginBottom: '12px' } },
        e('h3', { style: { marginTop: 0 } }, 'Change password'),
        e('form', { id: 'user-password-form', ref: passwordFormRef, action: '#', className: 'grid two' },
          e('div', null, e('label', null, 'Current password'), e('input', { name: 'currentPassword', type: 'password', required: true, autoComplete: 'current-password' })),
          e('div'),
          e('div', null, e('label', null, 'New password'), e('input', { name: 'newPassword', type: 'password', required: true, minLength: 8, pattern: '(?=.*[A-Za-z])(?=.*\\d)(?=.*[^A-Za-z\\d]).{8,}', title: 'Use at least 8 characters including a letter, a number, and a symbol.', autoComplete: 'new-password' })),
          e('div', null, e('label', null, 'Confirm new password'), e('input', { name: 'confirmPassword', type: 'password', required: true, minLength: 8, pattern: '(?=.*[A-Za-z])(?=.*\\d)(?=.*[^A-Za-z\\d]).{8,}', title: 'Use at least 8 characters including a letter, a number, and a symbol.', autoComplete: 'new-password' })),
          e('div', { style: { gridColumn: '1/-1' } }, e('button', { type: 'submit', className: 'btn secondary' }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'password'), 'Change password'))
        )
      )
      : null,
    showUserTypeCard
      ? e('div', { className: 'card', style: { marginBottom: '12px' } },
        e('h3', { style: { marginTop: 0 } }, 'User type'),
        e('form', { id: 'user-type-form', ref: typeFormRef, action: '#', className: 'grid two' },
          e('div', null,
            e('label', null, 'Type'),
            e('select', {
              name: 'userType',
              disabled: typeLocked,
              value: typeValue,
              onChange: (event) => setTypeValue(event.target.value)
            }, ...typeOptions.map((option) => e('option', { key: option.value, value: option.value }, option.label)))
          ),
          e('div', { className: 'small muted', style: { alignSelf: 'end' } }, user.isMaster ? 'Master type is locked.' : typeLocked ? 'This participant cannot be promoted from this page.' : 'Changing to participant removes login access.'),
          e('div', { style: { gridColumn: '1/-1' }, className: 'row' },
            e('button', { type: 'submit', className: 'btn secondary', disabled: typeLocked }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'manage_accounts'), 'Save type'))
        )
      )
      : null,
    e('div', { className: 'card' },
      e('h3', { style: { marginTop: 0 } }, 'Actions'),
      e('div', { className: 'row', style: { flexWrap: 'wrap' } },
        showResetPassword ? e('button', {
          type: 'button',
          className: 'btn secondary',
          onClick: async () => {
            const current = app.state.users.find((entry) => entry.id === app.state.selectedUserId) || null;
            if (!current) return app.fail('User not found.');
            if (app.isFirebaseMode()) {
              const email = current.username;
              if (!email) return app.fail('No email address on record for this user.');
              try {
                await AuthService.sendPasswordResetEmail(email);
                app.setMessage(`Password reset email sent to ${email}.`);
                AppStore.dispatch(app, {});
              } catch (err) {
                app.fail(`Failed to send reset email: ${err.message || err}`);
              }
              return;
            }
            const password = prompt(`New password for ${Utils.fullName(current)}:`);
            if (password === null) return;
            if (!Utils.validPassword(password)) return app.fail('Password must include 8+ chars, letter, number and symbol.');
            const confirmPwd = prompt('Confirm new password:');
            if (confirmPwd !== password) return app.fail('Passwords do not match.');
            const hash = await Security.createPasswordRecord(password);
            const ok = await app._saveWithConflictResolver('User', { ...current, password: hash }, (payload) => UsersService.updateUser(payload));
            if (!ok) return;
            await app.refresh();
            app.setMessage('Password updated.');
            AppStore.dispatch(app, {});
          }
        }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'password'), 'Reset password') : null,
        (app.isFirebaseMode() && user.userType === 'participant' && !user.firebaseUid)
          ? ['user', 'admin'].map((inviteType) => e('button', {
            key: inviteType,
            type: 'button',
            className: 'btn secondary',
            onClick: async () => {
              if (!app.isFirebaseMode()) return app.fail('Invites are unavailable in offline mode.');
              const current = app.state.users.find((entry) => entry.id === app.state.selectedUserId) || null;
              if (!current) return app.fail('User not found.');
              const existing = app.state.invites.find((invite) => !invite.usedAt && invite.userId === current.id && invite.inviteType === inviteType);
              const code = existing?.code || generateInviteCode();
              const invite = {
                id: existing?.id || code,
                code,
                userId: current.id,
                inviteType,
                createdAt: new Date().toISOString(),
                usedAt: null,
                usedBy: null
              };
              await InvitesService.createInvite(invite);
              const ok = await app._saveWithConflictResolver('User', {
                ...current,
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
            }
          }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'person_add'), `Invite as ${inviteType}`))
          : null,
        ...pendingInvites.map((invite) => e('button', {
          key: invite.id,
          type: 'button',
          className: 'btn secondary',
          onClick: () => {
            app.state.inviteDetail = invite;
            app.navigate('invite-detail');
          }
        }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'qr_code'), `View ${invite.inviteType || 'user'} invite`)),
        canDelete ? e('button', {
          type: 'button',
          className: 'btn danger',
          onClick: async () => {
            const current = app.state.users.find((entry) => entry.id === app.state.selectedUserId) || null;
            if (!current) return app.fail('User not found.');
            if (current.isMaster) return app.fail('Master admin cannot be deleted.');
            if (current.id === app.state.currentUser.id) return app.fail('You cannot delete your own account.');
            if (!confirm(`Delete ${Utils.fullName(current)}? This cannot be undone.`)) return;
            await UsersService.deleteUser(current.id);
            app.state.selectedUsers = app.state.selectedUsers.filter((id) => id !== current.id);
            app.state.selectedUserId = null;
            await app.refresh();
            app.setMessage('User deleted.');
            app.navigate('users', { keepFlash: true, replace: true });
          }
        }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'delete'), 'Delete user') : null,
        isOwnAccount ? e('button', { type: 'button', className: 'btn secondary', onClick: () => app.logout() }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'logout'), 'Logout') : null
      )
    )
  );
}
