import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { ThemePicker } from '../../../shared/components/themePicker.js';
import { RuntimeConfig } from '../../../config.js';

// =============================================================================
// SERVER SETTINGS TAB component
// =============================================================================
export function renderServerSettingsTab(app, ThemeOptions) {
  if (!app.isAdmin()) return `<p class="error">Access denied.</p>`;
  const s = app.state.appSettings;
  const firebase = RuntimeConfig.firebase || {};
  const configTheme = RuntimeConfig.theme || 'teal';
  const installedAtValue = s.installedAt ? new Date(s.installedAt).toISOString().slice(0, 16) : '';
  return `<form id="server-settings-form" class="grid two">
    <div><label>Server name</label><input name="serverName" type="text" required autocomplete="organization" value="${Utils.escAttr(s.serverName)}" /></div>
    <div><label>User session duration (days)</label><input name="sessionDurationDays" type="number" min="1" max="365" required value="${Utils.safeNum(s.sessionDurationDays, 7)}" /></div>
    <div><label>Weight format</label><select name="weightFormat"><option value="lb" ${s.weightFormat==='lb'?'selected':''}>lb</option><option value="kg" ${s.weightFormat==='kg'?'selected':''}>kg</option></select></div>
    <div><label>Currency</label><select name="currency"><option value="£" ${s.currency==='£'?'selected':''}>£</option><option value="$" ${s.currency==='$'?'selected':''}>$</option><option value="€" ${s.currency==='€'?'selected':''}>€</option></select></div>
    <div><label>Install date</label><input name="installedAt" type="datetime-local" value="${Utils.escAttr(installedAtValue)}" /></div>
    <div><label>Server mode</label><input disabled value="${RuntimeConfig.serverMode}" /></div>
    <div style="grid-column:1/-1">${ThemePicker.render({ options: ThemeOptions, selectedValue: s.theme || null, defaultTheme: configTheme, inputName: 'theme' })}</div>
    <div style="grid-column:1/-1"><label>Firebase API Key</label><input disabled value="${app.isMaster() ? Utils.escAttr(firebase.apiKey || '') : ''}" placeholder="hidden for non-master users" /></div>
    <div><label>Firebase Auth Domain</label><input disabled value="${app.isMaster() ? Utils.escAttr(firebase.authDomain || '') : ''}" /></div>
    <div><label>Firebase Project ID</label><input disabled value="${app.isMaster() ? Utils.escAttr(firebase.projectId || '') : ''}" /></div>
    <div><label>Firebase Storage Bucket</label><input disabled value="${app.isMaster() ? Utils.escAttr(firebase.storageBucket || '') : ''}" /></div>
    <div><label>Firebase Messaging Sender ID</label><input disabled value="${app.isMaster() ? Utils.escAttr(firebase.messagingSenderId || '') : ''}" /></div>
    <div><label>Firebase App ID</label><input disabled value="${app.isMaster() ? Utils.escAttr(firebase.appId || '') : ''}" /></div>
    <div style="grid-column:1/-1" class="small muted">Runtime mode and Firebase settings are read from config.js and cannot be changed from UI.</div>
    <div class="row" style="align-items:flex-end">${SubmitButton.render({ text: 'Save server settings', icon: 'save', submit: true })}</div>
  </form>

  <div class="card" style="margin-top:12px">
    <h3 style="margin-top:0">Reset server</h3>
    ${app.state.currentUser.isMaster ? `<form id="server-reset-form" class="grid two">
        <div><label>Master password</label><input name="password" type="password" required autocomplete="current-password" /></div>
        <div><label for="server-reset-form-confirm-1">Confirm reset</label><label class="row"><input id="server-reset-form-confirm-1" data-label="Confirm reset" style="width:auto" type="checkbox" name="confirm" required /> Yes, uninstall this server</label></div>
        <div style="grid-column:1/-1">${SubmitButton.render({ text: 'Reset server', icon: 'warning', theme: 'danger', submit: true })}</div>
      </form>` : `<p class="error">Only the master admin can reset this server.</p>`}
  </div>`;
}
