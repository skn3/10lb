import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { RuntimeConfig } from '../../../config.js';

// =============================================================================
// USER SETTINGS TAB component
// =============================================================================
export function renderUserSettingsTab(app) {
  const u = app.state.currentUser;
  return `<form id="user-settings-form" class="grid two">
    <div><label>First name</label><input name="firstName" type="text" required autocomplete="given-name" value="${Utils.escAttr(u.firstName || '')}" /></div>
    <div><label>Last name</label><input name="lastName" type="text" required autocomplete="family-name" value="${Utils.escAttr(u.lastName || '')}" /></div>
    <div style="grid-column:1/-1"><label>Email</label><input disabled type="email" value="${Utils.escAttr(u.username)}" /></div>
    <div style="grid-column:1/-1">${SubmitButton.render({ text: 'Save profile', icon: 'save', submit: true })}</div>
  </form>

  <form id="user-password-form" class="grid two" style="margin-top:12px">
    <div><label>Current password</label><input name="currentPassword" type="password" required autocomplete="current-password" /></div>
    <div></div>
    <div><label>New password</label><input name="newPassword" type="password" required ${Utils.passwordInputAttrs('new-password')} /></div>
    <div><label>Confirm new password</label><input name="confirmPassword" type="password" required ${Utils.passwordInputAttrs('new-password')} /></div>
    <div style="grid-column:1/-1">${SubmitButton.render({ text: 'Change password', icon: 'password', theme: 'secondary', submit: true })}</div>
  </form>`;
}
