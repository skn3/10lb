import { Utils } from '../../../shared/utils/utils.js';
import { Security } from '../../../shared/classes/security.js';
import { SyncButton } from '../components/syncButton.js';
import { SyncEngine } from '../../storage/classes/syncEngine.js';
import { FirestoreAdapter } from '../../storage/classes/firestoreAdapter.js';
import { AuthController } from '../../authentication/classes/authController.js';
import { SettingsService } from '../classes/settingsService.js';
import { renderUserSettingsTab } from '../components/userSettingsTab.js';
import { renderServerSettingsTab } from '../components/serverSettingsTab.js';
import { renderSyncSettingsTab } from '../components/syncSettingsTab.js';
import { RuntimeConfig } from '../../../config.js';

// =============================================================================
// SETTINGS PAGE
// =============================================================================

// ThemeOptions kept local so settings page stays self-contained
const ThemeOptions = [
  { key: 'system', label: 'System default' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' }
];

export function renderSettingsPage(app) {
  const tab = app.state.settingsTab || 'user';
  return `<div class="card"><h2 style="margin-top:0">Settings</h2>
    <div class="tabs">
      <button data-settings-tab="user" class="${tab === 'user' ? 'active' : ''}">User settings</button>
      ${app.isAdmin() ? `<button data-settings-tab="server" class="${tab === 'server' ? 'active' : ''}">Server settings</button>` : ''}
      ${(app.isMaster() && app.isFirebaseMode()) ? `<button data-settings-tab="sync" class="${tab === 'sync' ? 'active' : ''}">Storage &amp; Sync</button>` : ''}
    </div>

    ${tab === 'user' ? renderUserSettingsTab(app) : tab === 'server' ? renderServerSettingsTab(app, ThemeOptions) : renderSyncSettingsTab(app)}
  </div>`;
}

export function bindSettingsEvents(app) {
  document.querySelectorAll('[data-settings-tab]').forEach((b) => b.onclick = () => {
    app.state.settingsTab = b.dataset.settingsTab;
    app.render();
  });

  const userSettingsForm = document.getElementById('user-settings-form');
  if (userSettingsForm) {
    app.bindAsyncFormSubmit(userSettingsForm, async () => {
      const firstName = userSettingsForm.firstName.value.trim();
      const lastName = userSettingsForm.lastName.value.trim();
      if (!firstName || !lastName) return app.fail('First and last name are required.');
      const ok = await app._saveWithConflictResolver('User', { ...app.state.currentUser, firstName, lastName }, (payload) => SettingsService.saveUserProfile(payload, payload.firstName, payload.lastName));
      if (!ok) return;
      await app.refresh();
      app.setMessage('Profile updated.');
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
        try { await FirestoreAdapter.signInWithEmail(email, currentPassword); } catch { return app.fail('Current password is incorrect.'); }
        try { await FirestoreAdapter.updatePassword(newPassword); } catch (err) { return app.fail(`Password update failed: ${err.message || err}`); }
        app.setMessage('Password changed.');
        app.render();
        return;
      }

      const ok = await Security.verifyPassword(currentPassword, app.state.currentUser.password);
      if (!ok) return app.fail('Current password is incorrect.');
      const hash = await Security.createPasswordRecord(newPassword);
      const saved = await app._saveWithConflictResolver('User', { ...app.state.currentUser, password: hash }, (payload) => SettingsService.saveUserProfile(payload, payload.firstName, payload.lastName));
      if (!saved) return;
      await app.refresh();
      app.setMessage('Password changed.');
      app.render();
    });
  }

  const serverSettingsForm = document.getElementById('server-settings-form');
  if (serverSettingsForm) {
    app.bindAsyncFormSubmit(serverSettingsForm, async () => {
      const next = await SettingsService.saveAppSettings(app.state.appSettings, {
        serverName: serverSettingsForm.serverName.value.trim() || '10lb Challenge',
        weightFormat: serverSettingsForm.weightFormat.value,
        currency: serverSettingsForm.currency.value,
        theme: serverSettingsForm.theme.value,
        sessionDurationDays: Math.max(1, Utils.safeNum(serverSettingsForm.sessionDurationDays.value, 7))
      });
      app.state.appSettings = next;
      if (!app.isFirebaseMode() && app.state.sessionToken) {
        Utils.setCookie('tenlb_session', app.state.sessionToken, app.state.appSettings.sessionDurationDays);
      }
      app.setMessage('Server settings updated.');
      app.render();
    });
  }

  const resetForm = document.getElementById('server-reset-form');
  if (resetForm) {
    app.bindAsyncFormSubmit(resetForm, async () => {
      if (!app.state.currentUser.isMaster) return app.fail('Only master admin can reset the server.');
      if (!resetForm.confirm.checked) return app.fail('Confirm reset to continue.');

      if (app.isFirebaseMode()) {
        const email = app.state.currentUser?.username;
        try { await FirestoreAdapter.signInWithEmail(email, resetForm.password.value); } catch { return app.fail('Invalid master password.'); }
      } else {
        const ok = await Security.verifyPassword(resetForm.password.value, app.state.currentUser.password);
        if (!ok) return app.fail('Invalid master password.');
      }

      await SettingsService.resetServer(app.isFirebaseMode(), FirestoreAdapter, SyncEngine);
      app.state.currentUser = null;
      app.state.sessionToken = null;
      app.state.pendingInviteCode = '';
      app.state.redirectAfterLogin = 'overview';
      app.state.inviteDetail = null;
      app.state.selectedUserId = null;
      app.state.selectedUsers = [];
      app.setMessage('Server reset complete.');
      history.replaceState(null, '', window.location.pathname);
      app._applyRouteFromHash();
      app.render();
    });
  }

  const syncRetry = document.getElementById(SyncButton.BUTTON_ID);
  if (syncRetry) {
    SyncButton.bind(syncRetry, () => app._isSyncing(), async () => {
      await SyncEngine.retryNow();
      await app.loadSyncMeta();
      app.render();
    });
  }

  const firebaseTestBtn = document.getElementById('btn-firebase-test');
  if (firebaseTestBtn) {
    firebaseTestBtn.onclick = async () => {
      const cfg = RuntimeConfig.firebase;
      const resultEl = document.getElementById('firebase-test-result');
      if (!cfg?.apiKey || !cfg?.authDomain || !cfg?.projectId) {
        if (resultEl) resultEl.innerHTML = '<span class="error">Incomplete firebase config in config.js.</span>';
        return;
      }
      firebaseTestBtn.disabled = true;
      app.setButtonLabel(firebaseTestBtn, 'Testing…');
      if (resultEl) resultEl.innerHTML = '';
      const result = await AuthController.testFirebaseConnection(cfg);
      firebaseTestBtn.disabled = false;
      app.setButtonLabel(firebaseTestBtn, 'Test Connection');
      if (resultEl) {
        resultEl.innerHTML = result.ok
          ? '<span class="ok">✓ Connection successful</span>'
          : `<span class="error">✗ ${Utils.esc(result.error)}</span>`;
      }
    };
  }
}
