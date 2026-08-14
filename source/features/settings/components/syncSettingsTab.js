import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { SyncButton } from '../components/syncButton.js';
import { RuntimeConfig } from '../../../config.js';

// =============================================================================
// SYNC SETTINGS TAB component
// =============================================================================
export function renderSyncSettingsTab(app) {
  if (!app.isMaster() || !app.isFirebaseMode()) return `<p class="error">Access denied.</p>`;
  const meta = app.state.syncMeta || {};
  const mode = meta.storageMode || 'local';
  const syncStatus = meta.syncStatus || 'idle';
  const lastSync = meta.lastSyncAt ? Utils.dateTime(meta.lastSyncAt) : 'Never';
  const syncError = meta.syncError || null;
  const cfg = RuntimeConfig.firebase || {};
  const networkOnline = navigator.onLine;

  const statusLabel = { idle: '— Idle', syncing: '↻ Syncing…', synced: '✓ Synced', pending: '⚠ Changes pending', error: '✗ Error' };
  const statusClass = { idle: 'muted', syncing: '', synced: 'ok', pending: 'warn', error: 'error' };
  const syncBadge = `<span class="${statusClass[syncStatus] || ''}">${statusLabel[syncStatus] || syncStatus}</span>`;

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
