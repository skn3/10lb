import { ThemeOptions } from '../../../constants.js';
import { Utils } from '../../../shared/utils/utils.js';
import { Security } from '../../../shared/classes/security.js';
import { SyncButton } from '../components/syncButton.js';
import { AuthService } from '../../authentication/classes/authService.js';
import { StorageService } from '../../storage/classes/storageService.js';
import { SettingsService } from '../classes/settingsService.js';
import { renderServerSettingsTab } from '../components/serverSettingsTab.js';
import { renderSyncSettingsTab } from '../components/syncSettingsTab.js';
import { RuntimeConfig } from '../../../config.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { ThemePicker } from '../../../shared/components/themePicker.js';

// =============================================================================
// SETTINGS PAGE
// =============================================================================

export function renderSettingsPage(app) {
  const isAdminMode = app.isAdmin();
  const hasSyncTab = app.isMaster() && app.isFirebaseMode();
  const showAdminTabs = isAdminMode || hasSyncTab;

  const tab = app.state.settingsTab || 'server';
  return `<div class="card">
    <h2 style="margin-top:0">Settings</h2>

    <div class="card" style="margin-bottom:12px">
      <h3 style="margin-top:0">Your account</h3>
      <p class="muted" style="margin-top:0">Edit your profile, theme and password on your account page.</p>
      ${SubmitButton.render({ text: 'User settings', icon: 'person', theme: 'secondary', attrs: { 'type': 'button', 'id': 'btn-go-user-settings' } })}
    </div>

    ${showAdminTabs ? `<div class="tabs">
      ${isAdminMode ? `<button data-settings-tab="server" class="${tab === 'server' ? 'active' : ''}">Server settings</button>` : ''}
      ${hasSyncTab ? `<button data-settings-tab="sync" class="${tab === 'sync' ? 'active' : ''}">Storage &amp; Sync</button>` : ''}
    </div>
    ${tab === 'server' ? renderServerSettingsTab(app, ThemeOptions) : renderSyncSettingsTab(app)}` : ''}
  </div>`;
}

export function bindSettingsEvents(app) {
  const goUserSettings = document.getElementById('btn-go-user-settings');
  if (goUserSettings) goUserSettings.onclick = () => app.navigate('user', { userId: app.state.currentUser?.id });

  document.querySelectorAll('[data-settings-tab]').forEach((b) => b.onclick = () => {
    app.state.settingsTab = b.dataset.settingsTab;
    app.render();
  });

  const serverSettingsForm = document.getElementById('server-settings-form');
  if (serverSettingsForm) {
    // Wire ThemePicker live preview within the form
    ThemePicker.bind(serverSettingsForm);
    app.bindAsyncFormSubmit(serverSettingsForm, async () => {
      const rawInstalledAt = serverSettingsForm.installedAt?.value;
      const installedAt = rawInstalledAt ? new Date(rawInstalledAt).toISOString() : (app.state.appSettings.installedAt || null);
      const next = await SettingsService.saveAppSettings(app.state.appSettings, {
        serverName: serverSettingsForm.serverName.value.trim() || '10lb Challenge',
        weightFormat: serverSettingsForm.weightFormat.value,
        currency: serverSettingsForm.currency.value,
        theme: serverSettingsForm.theme?.value || app.state.appSettings.theme,
        sessionDurationDays: Math.max(1, Utils.safeNum(serverSettingsForm.sessionDurationDays.value, 7)),
        installedAt
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
        try { await AuthService.signInWithEmail(email, resetForm.password.value); } catch { return app.fail('Invalid master password.'); }
      } else {
        const ok = await Security.verifyPassword(resetForm.password.value, app.state.currentUser.password);
        if (!ok) return app.fail('Invalid master password.');
      }

      await SettingsService.resetServer(app.isFirebaseMode());
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
      await StorageService.retrySyncNow();
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
      const result = await AuthService.testFirebaseConnection(cfg);
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
