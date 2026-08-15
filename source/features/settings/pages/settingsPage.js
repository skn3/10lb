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
import { AppStore } from '../../../shared/classes/appStore.js';

const React = window.React;

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

export function SettingsPage({ app }) {
  const e = React.createElement;
  const isAdminMode = app.isAdmin();
  const hasSyncTab = app.isMaster() && app.isFirebaseMode();
  const showAdminTabs = isAdminMode || hasSyncTab;
  const [activeTab, setActiveTab] = React.useState(app.state.settingsTab || 'server');
  const [serverTheme, setServerTheme] = React.useState(app.state.appSettings?.theme || null);
  const serverFormRef = React.useRef(null);
  const resetFormRef = React.useRef(null);
  const syncHostRef = React.useRef(null);

  React.useEffect(() => {
    app.state.settingsTab = activeTab;
  }, [app, activeTab]);

  React.useEffect(() => {
    setServerTheme(app.state.appSettings?.theme || null);
  }, [app.state.appSettings]);

  React.useEffect(() => {
    const form = serverFormRef.current;
    if (!form) return;
    app.bindAsyncFormSubmit(form, async () => {
      const rawInstalledAt = form.installedAt?.value;
      const installedAt = rawInstalledAt ? new Date(rawInstalledAt).toISOString() : (app.state.appSettings.installedAt || null);
      const next = await SettingsService.saveAppSettings(app.state.appSettings, {
        serverName: form.serverName.value.trim() || '10lb Challenge',
        weightFormat: form.weightFormat.value,
        currency: form.currency.value,
        theme: serverTheme || app.state.appSettings.theme,
        sessionDurationDays: Math.max(1, Utils.safeNum(form.sessionDurationDays.value, 7)),
        installedAt
      });
      app.state.appSettings = next;
      if (!app.isFirebaseMode() && app.state.sessionToken) {
        Utils.setCookie('tenlb_session', app.state.sessionToken, app.state.appSettings.sessionDurationDays);
      }
      app.setMessage('Server settings updated.');
      AppStore.dispatch(app, {});
    });
  }, [app, serverTheme]);

  React.useEffect(() => {
    const form = resetFormRef.current;
    if (!form) return;
    app.bindAsyncFormSubmit(form, async () => {
      if (!app.state.currentUser.isMaster) return app.fail('Only master admin can reset the server.');
      if (!form.confirm.checked) return app.fail('Confirm reset to continue.');
      if (app.isFirebaseMode()) {
        const email = app.state.currentUser?.username;
        try { await AuthService.signInWithEmail(email, form.password.value); } catch { return app.fail('Invalid master password.'); }
      } else {
        const ok = await Security.verifyPassword(form.password.value, app.state.currentUser.password);
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
      AppStore.dispatch(app, {});
    });
  }, [app]);

  React.useEffect(() => {
    if (activeTab !== 'sync' || !syncHostRef.current) return;
    const syncRetry = document.getElementById(SyncButton.BUTTON_ID);
    if (syncRetry) {
      SyncButton.bind(syncRetry, () => app._isSyncing(), async () => {
        await StorageService.retrySyncNow();
        await app.loadSyncMeta();
        AppStore.dispatch(app, {});
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
    return () => {
      if (syncRetry) SyncButton.unbind(syncRetry);
    };
  }, [activeTab, app]);

  const s = app.state.appSettings;
  const firebase = RuntimeConfig.firebase || {};
  const installedAtValue = s.installedAt ? new Date(s.installedAt).toISOString().slice(0, 16) : '';

  return e('div', { className: 'card' },
    e('h2', { style: { marginTop: 0 } }, 'Settings'),
    e('div', { className: 'card', style: { marginBottom: '12px' } },
      e('h3', { style: { marginTop: 0 } }, 'Your account'),
      e('p', { className: 'muted', style: { marginTop: 0 } }, 'Edit your profile, theme and password on your account page.'),
      e('button', { type: 'button', id: 'btn-go-user-settings', className: 'btn secondary', onClick: () => app.navigate('user', { userId: app.state.currentUser?.id }) },
        e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'person'),
        'User settings')
    ),
    showAdminTabs ? e(React.Fragment, null,
      e('div', { className: 'tabs' },
        isAdminMode ? e('button', { type: 'button', className: activeTab === 'server' ? 'active' : '', onClick: () => setActiveTab('server') }, 'Server settings') : null,
        hasSyncTab ? e('button', { type: 'button', className: activeTab === 'sync' ? 'active' : '', onClick: () => setActiveTab('sync') }, 'Storage & Sync') : null
      ),
      activeTab === 'server'
        ? e(React.Fragment, null,
          e('form', { id: 'server-settings-form', ref: serverFormRef, action: '#', className: 'grid two' },
            e('div', null, e('label', null, 'Server name'), e('input', { name: 'serverName', type: 'text', required: true, autoComplete: 'organization', defaultValue: s.serverName })),
            e('div', null, e('label', null, 'User session duration (days)'), e('input', { name: 'sessionDurationDays', type: 'number', min: '1', max: '365', required: true, defaultValue: Utils.safeNum(s.sessionDurationDays, 7) })),
            e('div', null,
              e('label', null, 'Weight format'),
              e('select', { name: 'weightFormat', defaultValue: s.weightFormat },
                e('option', { value: 'lb' }, 'lb'),
                e('option', { value: 'kg' }, 'kg'))
            ),
            e('div', null,
              e('label', null, 'Currency'),
              e('select', { name: 'currency', defaultValue: s.currency },
                e('option', { value: '£' }, '£'),
                e('option', { value: '$' }, '$'),
                e('option', { value: '€' }, '€'))
            ),
            e('div', null, e('label', null, 'Install date'), e('input', { name: 'installedAt', type: 'datetime-local', defaultValue: installedAtValue })),
            e('div', null, e('label', null, 'Server mode'), e('input', { disabled: true, value: RuntimeConfig.serverMode })),
            e('div', { style: { gridColumn: '1/-1' } }, ThemePicker.renderReact({
              options: ThemeOptions,
              selectedValue: serverTheme,
              defaultTheme: RuntimeConfig.theme || 'teal',
              inputName: 'theme',
              onChange: (value) => setServerTheme(value)
            })),
            e('div', { style: { gridColumn: '1/-1' } }, e('label', null, 'Firebase API Key'), e('input', { disabled: true, value: app.isMaster() ? (firebase.apiKey || '') : '', placeholder: 'hidden for non-master users' })),
            e('div', null, e('label', null, 'Firebase Auth Domain'), e('input', { disabled: true, value: app.isMaster() ? (firebase.authDomain || '') : '' })),
            e('div', null, e('label', null, 'Firebase Project ID'), e('input', { disabled: true, value: app.isMaster() ? (firebase.projectId || '') : '' })),
            e('div', null, e('label', null, 'Firebase Storage Bucket'), e('input', { disabled: true, value: app.isMaster() ? (firebase.storageBucket || '') : '' })),
            e('div', null, e('label', null, 'Firebase Messaging Sender ID'), e('input', { disabled: true, value: app.isMaster() ? (firebase.messagingSenderId || '') : '' })),
            e('div', null, e('label', null, 'Firebase App ID'), e('input', { disabled: true, value: app.isMaster() ? (firebase.appId || '') : '' })),
            e('div', { style: { gridColumn: '1/-1' }, className: 'small muted' }, 'Runtime mode and Firebase settings are read from config.js and cannot be changed from UI.'),
            e('div', { className: 'row', style: { alignItems: 'flex-end' } },
              e('button', { type: 'submit', className: 'btn' }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'save'), 'Save server settings'))
          ),
          e('div', { className: 'card', style: { marginTop: '12px' } },
            e('h3', { style: { marginTop: 0 } }, 'Reset server'),
            app.state.currentUser.isMaster
              ? e('form', { id: 'server-reset-form', ref: resetFormRef, action: '#', className: 'grid two' },
                e('div', null, e('label', null, 'Master password'), e('input', { name: 'password', type: 'password', required: true, autoComplete: 'current-password' })),
                e('div', null,
                  e('label', { htmlFor: 'server-reset-form-confirm-1' }, 'Confirm reset'),
                  e('label', { className: 'row' },
                    e('input', { id: 'server-reset-form-confirm-1', 'data-label': 'Confirm reset', style: { width: 'auto' }, type: 'checkbox', name: 'confirm', required: true }),
                    ' Yes, uninstall this server'
                  )
                ),
                e('div', { style: { gridColumn: '1/-1' } },
                  e('button', { type: 'submit', className: 'btn danger' }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'warning'), 'Reset server'))
              )
              : e('p', { className: 'error' }, 'Only the master admin can reset this server.')
          )
        )
        : e('div', { ref: syncHostRef, dangerouslySetInnerHTML: { __html: renderSyncSettingsTab(app) } })
    ) : null
  );
}
