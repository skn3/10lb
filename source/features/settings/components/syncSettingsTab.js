import { SyncStatus, SyncStatusClass, SyncStatusLabel } from '../../../constants.js';
import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { SyncButton } from '../components/syncButton.js';
import { RuntimeConfig } from '../../../config.js';
import { AuthService } from '../../authentication/classes/authService.js';
import { StorageService } from '../../storage/classes/storageService.js';
import { AppStore } from '../../../shared/classes/appStore.js';

// =============================================================================
// SYNC SETTINGS TAB component
// =============================================================================
export function renderSyncSettingsTab(app) {
  if (!app.isMaster() || !app.isFirebaseMode()) return `<p class="error">Access denied.</p>`;
  const meta = app.state.syncMeta || {};
  const mode = meta.storageMode || 'local';
  const syncStatus = meta.syncStatus || SyncStatus.IDLE;
  const lastSync = meta.lastSyncAt ? Utils.dateTime(meta.lastSyncAt) : 'Never';
  const syncError = meta.syncError || null;
  const cfg = RuntimeConfig.firebase || {};
  const networkOnline = navigator.onLine;

  const syncBadge = `<span class="${SyncStatusClass[syncStatus] || ''}">${SyncStatusLabel[syncStatus] || syncStatus}</span>`;

  return `
  <div class="card" style="margin-bottom:12px">
    <h3 style="margin-top:0">Storage &amp; Sync</h3>
    <div class="grid two" style="gap:6px;margin-bottom:10px">
      <div><strong>Mode</strong><br/><span class="tag">${mode === 'online' ? 'ONLINE' : 'LOCAL'}</span></div>
      <div><strong>Network</strong><br/><span class="${networkOnline ? 'ok' : 'error'}">${networkOnline ? 'Connected' : 'Disconnected'}</span></div>
      <div><strong>Synchronisation</strong><br/>${syncBadge}</div>
      <div><strong>Last sync</strong><br/><span class="muted">${lastSync}</span></div>
    </div>
    ${syncError ? `<p class="error small">Error: ${Utils.esc(syncError)}</p>` : ''}
    ${mode === 'local' ? `<p class="muted small">Changes are stored only on this device.</p>` : ''}
    ${app.isFirebaseMode() ? `<p class="small muted" style="margin-top:8px">Tracked active Firebase sessions: ${app.state.sessions.length}</p>` : ''}

    <div class="row" style="margin-top:8px">
      ${mode === 'online' ? SyncButton.render() : ''}
    </div>
  </div>

  <div class="card" id="firebase-config-card">
    <h3 style="margin-top:0">Firebase Configuration (read-only)</h3>
    <p class="muted small">This configuration is read from <code>config.js</code>. UI changes are disabled.</p>
    <form id="firebase-config-form" class="grid two">
      <div><label>API Key</label><input disabled name="apiKey" value="${Utils.escAttr(cfg.apiKey || '')}" placeholder="AIza…" /></div>
      <div><label>Auth Domain</label><input disabled name="authDomain" value="${Utils.escAttr(cfg.authDomain || '')}" placeholder="project.firebaseapp.com" /></div>
      <div><label>Project ID</label><input disabled name="projectId" value="${Utils.escAttr(cfg.projectId || '')}" placeholder="my-project" /></div>
      <div><label>Storage Bucket</label><input disabled name="storageBucket" value="${Utils.escAttr(cfg.storageBucket || '')}" placeholder="project.appspot.com" /></div>
      <div><label>Messaging Sender ID</label><input disabled name="messagingSenderId" value="${Utils.escAttr(cfg.messagingSenderId || '')}" /></div>
      <div><label>App ID</label><input disabled name="appId" value="${Utils.escAttr(cfg.appId || '')}" placeholder="1:123:web:abc" /></div>
      <div style="grid-column:1/-1" class="row">
        ${SubmitButton.render({ text: 'Test Connection', icon: 'wifi', theme: 'secondary', id: 'btn-firebase-test', attrs: { 'type': 'button' } })}
      </div>
      <div id="firebase-test-result" style="grid-column:1/-1"></div>
    </form>
  </div>`;
}

// =============================================================================
// SYNC SETTINGS TAB — React component
// =============================================================================
export function SyncSettingsTab({ app }) {
  const React = window.React;
  if (!React) return null;
  const e = React.createElement;

  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState(null); // { ok, error } | null
  const syncBtnRef = React.useRef(null);

  React.useEffect(() => {
    const btn = syncBtnRef.current;
    if (!btn) return;
    SyncButton.bind(btn, () => app._isSyncing(), async () => {
      await StorageService.retrySyncNow();
      await app.loadSyncMeta();
      AppStore.dispatch(app, {});
    });
    return () => SyncButton.unbind(btn);
  }, [app]);

  if (!app.isMaster() || !app.isFirebaseMode()) {
    return e('p', { className: 'error' }, 'Access denied.');
  }

  const meta = app.state.syncMeta || {};
  const mode = meta.storageMode || 'local';
  const syncStatus = meta.syncStatus || SyncStatus.IDLE;
  const lastSync = meta.lastSyncAt ? Utils.dateTime(meta.lastSyncAt) : 'Never';
  const syncError = meta.syncError || null;
  const cfg = RuntimeConfig.firebase || {};
  const networkOnline = navigator.onLine;

  const handleTestConnection = async () => {
    const config = RuntimeConfig.firebase;
    if (!config?.apiKey || !config?.authDomain || !config?.projectId) {
      setTestResult({ ok: false, error: 'Incomplete firebase config in config.js.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    const result = await AuthService.testFirebaseConnection(config);
    setTesting(false);
    setTestResult(result);
  };

  return e(React.Fragment, null,
    e('div', { className: 'card', style: { marginBottom: '12px' } },
      e('h3', { style: { marginTop: 0 } }, 'Storage & Sync'),
      e('div', { className: 'grid two', style: { gap: '6px', marginBottom: '10px' } },
        e('div', null, e('strong', null, 'Mode'), e('br'), e('span', { className: 'tag' }, mode === 'online' ? 'ONLINE' : 'LOCAL')),
        e('div', null, e('strong', null, 'Network'), e('br'), e('span', { className: networkOnline ? 'ok' : 'error' }, networkOnline ? 'Connected' : 'Disconnected')),
        e('div', null, e('strong', null, 'Synchronisation'), e('br'), e('span', { className: SyncStatusClass[syncStatus] || '' }, SyncStatusLabel[syncStatus] || syncStatus)),
        e('div', null, e('strong', null, 'Last sync'), e('br'), e('span', { className: 'muted' }, lastSync))
      ),
      syncError ? e('p', { className: 'error small' }, `Error: ${syncError}`) : null,
      mode === 'local' ? e('p', { className: 'muted small' }, 'Changes are stored only on this device.') : null,
      app.isFirebaseMode() ? e('p', { className: 'small muted', style: { marginTop: '8px' } }, `Tracked active Firebase sessions: ${app.state.sessions.length}`) : null,
      mode === 'online' ? e('div', { className: 'row', style: { marginTop: '8px' } },
        e('button', { ref: syncBtnRef, type: 'button', className: 'btn secondary', id: SyncButton.BUTTON_ID },
          e('span', { className: 'btn-icon material-symbols-rounded', 'aria-hidden': 'true' }, 'sync'),
          e('span', { className: 'btn-label' }, 'Retry sync')
        )
      ) : null
    ),
    e('div', { className: 'card', id: 'firebase-config-card' },
      e('h3', { style: { marginTop: 0 } }, 'Firebase Configuration (read-only)'),
      e('p', { className: 'muted small' }, 'This configuration is read from ', e('code', null, 'config.js'), '. UI changes are disabled.'),
      e('div', { className: 'grid two' },
        e('div', null, e('label', null, 'API Key'), e('input', { disabled: true, value: cfg.apiKey || '', placeholder: 'AIza…', readOnly: true })),
        e('div', null, e('label', null, 'Auth Domain'), e('input', { disabled: true, value: cfg.authDomain || '', placeholder: 'project.firebaseapp.com', readOnly: true })),
        e('div', null, e('label', null, 'Project ID'), e('input', { disabled: true, value: cfg.projectId || '', placeholder: 'my-project', readOnly: true })),
        e('div', null, e('label', null, 'Storage Bucket'), e('input', { disabled: true, value: cfg.storageBucket || '', placeholder: 'project.appspot.com', readOnly: true })),
        e('div', null, e('label', null, 'Messaging Sender ID'), e('input', { disabled: true, value: cfg.messagingSenderId || '', readOnly: true })),
        e('div', null, e('label', null, 'App ID'), e('input', { disabled: true, value: cfg.appId || '', placeholder: '1:123:web:abc', readOnly: true })),
        e('div', { style: { gridColumn: '1/-1' }, className: 'row' },
          e('button', { type: 'button', className: 'btn secondary', disabled: testing, onClick: handleTestConnection },
            e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'wifi'),
            testing ? ' Testing…' : ' Test Connection'
          )
        ),
        testResult != null ? e('div', { style: { gridColumn: '1/-1' } },
          testResult.ok
            ? e('span', { className: 'ok' }, '✓ Connection successful')
            : e('span', { className: 'error' }, `✗ ${testResult.error}`)
        ) : null
      )
    )
  );
}

