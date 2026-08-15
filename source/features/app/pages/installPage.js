import { ThemeOptions } from '../../../constants.js';
import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { Data } from '../../storage/models/data.js';
import { AuthService } from '../../authentication/classes/authService.js';

// =============================================================================
// INSTALL PAGE
// =============================================================================

export function renderInstallPage(app) {
  const s = app.state.appSettings || {};
  const firebase = RuntimeConfig.firebase || {};
  return `<div class="card"><h2 style="margin-top:0">Install server</h2>
    <p class="muted">Configure the server before first use.</p>
    <form id="install-form" class="grid two">
      <div><label>Server mode (config.js)</label><input disabled value="${Utils.escAttr(RuntimeConfig.serverMode || '')}" /></div>
      <div><label>Firebase API Key (config.js)</label><input disabled value="${Utils.escAttr(firebase.apiKey || '')}" /></div>
      <div><label>Firebase Auth Domain (config.js)</label><input disabled value="${Utils.escAttr(firebase.authDomain || '')}" /></div>
      <div><label>Firebase Project ID (config.js)</label><input disabled value="${Utils.escAttr(firebase.projectId || '')}" /></div>
      <div><label>Firebase Storage Bucket (config.js)</label><input disabled value="${Utils.escAttr(firebase.storageBucket || '')}" /></div>
      <div><label>Firebase Messaging Sender ID (config.js)</label><input disabled value="${Utils.escAttr(firebase.messagingSenderId || '')}" /></div>
      <div><label>Firebase App ID (config.js)</label><input disabled value="${Utils.escAttr(firebase.appId || '')}" /></div>
      <div style="grid-column:1/-1" class="small muted">These values are read-only previews from config.js and are not saved by this form.</div>
      <div><label>Server name</label><input name="serverName" type="text" required autocomplete="organization" value="${Utils.escAttr(s.serverName || '10lb Challenge')}" /></div>
      <div><label>Email</label><input name="username" type="email" inputmode="email" required autocomplete="email" autocapitalize="none" spellcheck="false" /></div>
      <div><label>Password</label><input name="password" type="password" required ${Utils.passwordInputAttrs('new-password')} /></div>
      <div><label>Confirm password</label><input name="confirmPassword" type="password" required ${Utils.passwordInputAttrs('new-password')} /></div>
      <div><label>First name</label><input name="firstName" type="text" required autocomplete="given-name" /></div>
      <div><label>Last name</label><input name="lastName" type="text" required autocomplete="family-name" /></div>
      <div><label>Weight format</label><select name="weightFormat"><option value="lb" selected>lb</option><option value="kg">kg</option></select></div>
      <div><label>Currency</label><select name="currency"><option value="£" selected>£</option><option value="$">$</option><option value="€">€</option></select></div>
      <div><label>Theme</label><select name="theme">${ThemeOptions.map((t) => `<option value="${t.key}" ${t.key === (s.theme || 'teal') ? 'selected' : ''}>${t.label}</option>`).join('')}</select></div>
      <div><label>User session duration (days)</label><input name="sessionDurationDays" type="number" min="1" max="365" value="${Utils.safeNum(s.sessionDurationDays, 7)}" required /></div>
      <div style="grid-column:1/-1" class="small muted">Password must contain at least 8 characters, including a number, letter, and symbol.</div>
      <div style="grid-column:1/-1" class="row">${SubmitButton.render({ text: 'Install server', icon: 'install_desktop', submit: true })}</div>
    </form>
    <div id="install-log" style="display:none;margin-top:16px;padding:12px;background:var(--surface2,#1a1a2e);border:1px solid var(--border,#333);border-radius:6px;font-family:monospace;font-size:12px;line-height:1.6;color:var(--text,#ccc);max-height:300px;overflow-y:auto;white-space:pre-wrap;word-break:break-all"></div>
  </div>`;
}

export function bindInstallEvents(app) {
  const installForm = document.getElementById('install-form');
  if (!installForm) return;
  app.bindAsyncFormSubmit(installForm, async () => {
    const installAllowed = await app.plugin.canInstall();
    if (!installAllowed) return app.fail('Installation is locked. This server has already been configured.');
    const serverName = installForm.serverName.value.trim() || '10lb Challenge';
    const username = installForm.username.value.trim();
    const password = installForm.password.value;
    const confirmPassword = installForm.confirmPassword.value;
    const firstName = installForm.firstName.value.trim();
    const lastName = installForm.lastName.value.trim();
    const weightFormat = installForm.weightFormat.value;
    const currency = installForm.currency.value;
    const theme = installForm.theme.value;
    const sessionDurationDays = Math.max(1, Utils.safeNum(installForm.sessionDurationDays.value, 7));

    const logEl = document.getElementById('install-log');
    if (logEl) { logEl.innerHTML = ''; logEl.style.display = 'block'; }
    app.installLog('Install started.');
    app.installLog(`Server mode: ${app.isFirebaseMode() ? 'firebase' : 'local'}`);

    if (!username || !firstName || !lastName) return app.fail('Complete all required fields.');
    if (!Utils.validEmail(username)) return app.fail('Enter a valid email address.');
    if (!Utils.validPassword(password)) return app.fail('Password must include 8+ chars, a letter, a number and a symbol.');
    if (password !== confirmPassword) return app.fail('Passwords do not match.');

    app.installLog('Checking for existing user…');
    const exists = await Data.adapter.getUserByUsername(username);
    if (exists) return app.fail('Email already exists.');
    app.installLog('No existing user found.');

    const { Security } = await import('../../../shared/classes/security.js');
    const hash = app.isFirebaseMode() ? null : await Security.createPasswordRecord(password);
    const masterUserId = Utils.id();
    let firebaseProvision = null;
    if (app.isFirebaseMode()) {
      app.installLog('Firebase mode: provisioning master account…');
      try {
        firebaseProvision = await AuthService.provisionFirebaseMaster(username, password, masterUserId, (msg, type) => app.installLog(msg, type));
        app.installLog(`Firebase master account created. UID: ${firebaseProvision?.uid || '(none)'}`, 'ok');
      } catch (err) {
        app.installLog(`Firebase provision error (${err.code || 'unknown'}): ${err.message || err}`, 'error');
        return app.fail(`Firebase install failed: ${err.message || err}`);
      }
      app.installLog('Initialising FirestoreAdapter for sign-in…');
      try {
        await AuthService.initializeFirebase();
        app.installLog('FirestoreAdapter initialised.', 'ok');
      } catch (err) {
        app.installLog(`FirestoreAdapter init error: ${err.message || err}`, 'error');
      }
      app.installLog(`Signing in as ${firebaseProvision?.email || username}…`);
      try {
        const email = firebaseProvision?.email || username;
        await AuthService.signInWithEmail(email, password);
        app.installLog('Firebase sign-in successful.', 'ok');
      } catch (err) {
        app.installLog(`Firebase sign-in error (${err.code || 'unknown'}): ${err.message || err}`, 'error');
        return app.fail(`Firebase sign-in after install failed: ${err.message || err}`);
      }
    }
    app.installLog('Creating local master user record…');
    await Data.adapter.createUser({
      id: masterUserId,
      username,
      firstName,
      lastName,
      password: hash,
      userType: 'master',
      isAdmin: true,
      isMaster: true,
      canLogin: true,
      firebaseUid: firebaseProvision?.uid || null,
      lastLoginAt: null
    });
    app.installLog('Master user record created.', 'ok');

    app.installLog('Saving app settings…');
    app.state.appSettings = {
      ...app.state.appSettings,
      installed: true,
      serverName,
      weightFormat,
      currency,
      theme,
      sessionDurationDays,
      installedAt: new Date().toISOString(),
      installLockedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await Data.adapter.saveAppSettings(app.state.appSettings);
    app.installLog('App settings saved.', 'ok');

    app.installLog('Loading settings and refreshing…');
    await app.loadSettings();
    await app.refresh();

    app.installLog('Logging in as master user…');
    const user = await Data.adapter.getUserByUsername(username);
    await app.loginAs(user);
    app.installLog('Login successful. Redirecting…', 'ok');
    app.setMessage('Server installed successfully.');
    app.navigate('overview', { keepFlash: true, replace: true });
  });
}
