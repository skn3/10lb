import { ThemeOptions } from '../../../constants.js';
import { Utils } from '../../../shared/utils/utils.js';
import { Security } from '../../../shared/classes/security.js';
import { SyncButton } from '../components/syncButton.js';
import { AuthService } from '../../authentication/classes/authService.js';
import { StorageService } from '../../storage/classes/storageService.js';
import { SettingsService } from '../classes/settingsService.js';
import { renderServerSettingsTab, renderResetServerTab } from '../components/serverSettingsTab.js';
import { renderSyncSettingsTab, SyncSettingsTab } from '../components/syncSettingsTab.js';
import { RuntimeConfig } from '../../../config.js';
import { ThemePicker } from '../../../shared/components/themePicker.js';
import { AppStore } from '../../../shared/classes/appStore.js';
import { Tabs } from '../../../shared/components/tabs.js';

const React = window.React;

// =============================================================================
// SETTINGS PAGE
// =============================================================================

function _buildSettingsTabs(app) {
  const tabs = [];
  if (app.isAdmin()) {
    tabs.push({ key: 'server', label: 'Server settings', content: renderServerSettingsTab(app, ThemeOptions) });
    tabs.push({ key: 'reset', label: 'Reset server', content: renderResetServerTab(app) });
  }
  if (app.isMaster() && app.isFirebaseMode()) {
    tabs.push({ key: 'sync', label: 'Storage & Sync', content: renderSyncSettingsTab(app) });
  }
  if (app.isMaster()) {
    tabs.push({ key: 'devtools', label: 'Dev Tools', content: _renderDevToolsTab() });
  }
  return tabs;
}

function _renderDevToolsTab() {
  return `<div class="card">
    <h3 style="margin-top:0"><span class="material-symbols-rounded" aria-hidden="true" style="vertical-align:middle;margin-right:6px">bomb</span>Flush Browser Cache</h3>
    <p class="muted">Forcing a cache flush will cause all website resources (scripts, fonts, styles) to be reloaded from the server on the next page load. The page will refresh automatically.</p>
    <button type="button" id="btn-flush-cache" class="btn danger">
      <span class="material-symbols-rounded" aria-hidden="true">bomb</span>Flush
    </button>
  </div>`;
}

export function renderSettingsPage(app) {
  const tabs = _buildSettingsTabs(app);
  if (!tabs.length) return `<div class="card"><h2 style="margin-top:0">Settings</h2><p class="muted">No settings available for your account level.</p></div>`;

  const activeTab = app.state.settingsTab || tabs[0].key;
  return `<div class="card">
    <h2 style="margin-top:0">Settings</h2>
    ${Tabs.render(tabs, activeTab)}
  </div>`;
}

export function bindSettingsEvents(app) {
  const container = document.querySelector('.tabs-component');
  if (container) {
    Tabs.bind(container, (key) => {
      app.state.settingsTab = key;
      Tabs.pushTabToUrl('settings', key);
      app.render();
    });
  }

  const serverSettingsForm = document.getElementById('server-settings-form');
  if (serverSettingsForm) {
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

  const flushBtn = document.getElementById('btn-flush-cache');
  if (flushBtn) {
    flushBtn.onclick = () => app.flushBrowserCache();
  }
}

function DevToolsTab({ app }) {
  const e = React.createElement;
  return e('div', { className: 'card' },
    e('h3', { style: { marginTop: 0 } },
      e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true', style: { verticalAlign: 'middle', marginRight: '6px' } }, 'bomb'),
      'Flush Browser Cache'
    ),
    e('p', { className: 'muted' }, 'Forcing a cache flush will cause all website resources (scripts, fonts, styles) to be reloaded from the server on the next page load. The page will refresh automatically.'),
    e('button', {
      type: 'button',
      className: 'btn danger',
      onClick: () => app.flushBrowserCache()
    },
    e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'bomb'),
    'Flush')
  );
}

export function SettingsPage({ app }) {
  const e = React.createElement;
  const isAdminMode = app.isAdmin();
  const isMaster = app.isMaster();
  const hasSyncTab = isMaster && app.isFirebaseMode();
  const showAdminTabs = isAdminMode || hasSyncTab || isMaster;
  const defaultTab = isAdminMode ? 'server' : (hasSyncTab ? 'sync' : 'devtools');
  const [activeTab, setActiveTab] = React.useState(app.state.settingsTab || defaultTab);
  const [serverTheme, setServerTheme] = React.useState(app.state.appSettings?.theme || null);
  const serverFormRef = React.useRef(null);
  const resetFormRef = React.useRef(null);

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
        hasSyncTab ? e('button', { type: 'button', className: activeTab === 'sync' ? 'active' : '', onClick: () => setActiveTab('sync') }, 'Storage & Sync') : null,
        isMaster ? e('button', { type: 'button', className: activeTab === 'devtools' ? 'active' : '', onClick: () => setActiveTab('devtools') }, 'Dev Tools') : null
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
        : activeTab === 'sync'
          ? e(SyncSettingsTab, { app })
          : activeTab === 'devtools'
            ? e(DevToolsTab, { app })
            : null
    ) : null
  );
}

