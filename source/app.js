import { Config, RuntimeConfig, loadRuntimeConfig } from './config.js';
import { ThemeOptions } from './constants.js';
import { Utils } from './shared/utils/utils.js';
import { Security } from './shared/classes/security.js';
import { Device } from './shared/classes/device.js';
import { Data } from './features/storage/models/data.js';
import { OfflineAdapter } from './features/storage/classes/offlineAdapter.js';
import { FirestoreAdapter } from './features/storage/classes/firestoreAdapter.js';
import { SyncEngine } from './features/storage/classes/syncEngine.js';
import { Domain } from './domain.js';
import { OfflinePlugin } from './features/auth/classes/offlinePlugin.js';
import { FirebasePlugin } from './features/auth/classes/firebasePlugin.js';
import { SubmissionStatusPanel } from './shared/components/submissionStatusPanel.js';

// =============================================================================
// APP — Main application object
// =============================================================================
export const App = {
  plugin: null, // set in App.init() — OfflinePlugin or FirebasePlugin
  react: {
    enabled: false,
    navRoot: null,
    authRoot: null,
    syncRoot: null,
    appRoot: null,
    snackbarRoot: null
  },
  messageTimer: null,
  stickyOffsetTimer: null,
  state: {
    route: 'overview',
    message: '',
    error: '',
    rounds: [],
    users: [],
    submissions: [],
    invites: [],
    sessions: [],
    selectedRoundId: null,
    weekCursor: {},
    createDraft: null,
    settingsTab: 'user',
    currentUser: null,
    appSettings: null,
    sessionToken: null,
    redirectAfterLogin: 'overview',
    selectedUsers: [],
    selectedUserId: null,
    syncMeta: null,        // device/sync metadata (from getDeviceMeta)
    inviteDetail: null,    // current invite being viewed
    pendingInviteCode: '', // invite code from hash route/query import
    userFilters: {
      type: 'all',
      status: 'all', // all|confirmed|invited
      currentChallengeOnly: false,
      sort: 'a-z',
      search: ''
    }
  },

  isInstalled() { return this.plugin ? this.plugin.isInstalled() : !!this.state.appSettings?.installed; },
  isAuthenticated() { return !!this.state.currentUser; },
  isAdmin(user = this.state.currentUser) { return !!(user && (user.isAdmin || user.isMaster)); },
  isMaster(user = this.state.currentUser) { return !!(user && user.isMaster); },
  isFirebaseMode() { return RuntimeConfig.serverMode === 'firebase'; },
  roleLabel(user) {
    const type = user?.userType || (user?.isMaster ? 'master' : (user?.isAdmin ? 'admin' : 'user'));
    return type[0].toUpperCase() + type.slice(1);
  },
  firebaseSessionId(user = this.state.currentUser) {
    if (!user?.id) return null;
    return `${user.id}:${Device.getId()}`;
  },
  activeSessionsForUser(userId) {
    return this.state.sessions.filter((session) => session?.userId === userId);
  },
  selectedUser() {
    return this.state.users.find((user) => user.id === this.state.selectedUserId) || null;
  },
  userLoginLabel(user) {
    if (!user) return '';
    if (user.username) return user.username;
    return user.canLogin !== false ? 'No login email' : 'Participant only';
  },
  managedUserTypeOptions(user) {
    if (!user) return [];
    if (user.isMaster || user.userType === 'master') return [{ value: 'master', label: 'Master' }];
    const hasLocalLogin = !!user.password && Utils.validEmail(user.username || '');
    const hasFirebaseLogin = !!user.firebaseUid;
    const canPromote = user.userType !== 'participant' || hasLocalLogin || hasFirebaseLogin;
    const options = [{ value: 'participant', label: 'Participant' }];
    if (canPromote) options.push({ value: 'user', label: 'User' }, { value: 'admin', label: 'Admin' });
    return options;
  },
  async _loadVisibleInvites() {
    if (!this.isFirebaseMode()) return Data.adapter.listInvites();
    if (!this.state.currentUser || !this.isAdmin() || !FirestoreAdapter.isReady()) return [];
    const invites = await FirestoreAdapter.downloadAll('invites');
    return invites
      .filter((invite) => invite && !invite.deletedAt)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  },
  async _loadVisibleSessions() {
    if (!this.isFirebaseMode() || !this.state.currentUser || !this.isAdmin() || !FirestoreAdapter.isReady()) return [];
    const sessions = await FirestoreAdapter.downloadAll('sessions');
    return sessions
      .filter((session) => session && !session.deletedAt)
      .sort((a, b) => new Date(b.lastSeenAt || b.startedAt || 0).getTime() - new Date(a.lastSeenAt || a.startedAt || 0).getTime());
  },
  async _getFirebaseInvite(code) {
    if (!this.isFirebaseMode()) return null;
    if (!FirestoreAdapter.isReady()) {
      await this._loadFirebaseSDK();
      await FirestoreAdapter.init(RuntimeConfig.firebase, 'default');
    }
    const invite = await FirestoreAdapter.getRecord('invites', code);
    if (!invite || invite.deletedAt) return null;
    return invite;
  },
  async _saveFirebaseInvite(invite) {
    if (!this.isFirebaseMode()) return;
    if (!FirestoreAdapter.isReady()) {
      await this._loadFirebaseSDK();
      await FirestoreAdapter.init(RuntimeConfig.firebase, 'default');
    }
    await FirestoreAdapter.writeRecord('invites', invite);
  },
  async _deleteFirebaseInvite(inviteId) {
    if (!this.isFirebaseMode() || !FirestoreAdapter.isReady()) return;
    await FirestoreAdapter.removeRecord('invites', inviteId);
  },
  // Resolve a local user by Firebase UID, querying Firestore as authoritative
  // source if the record is absent from the IndexedDB cache.
  // Also supports legacy users that were created before firebaseUid was set by
  // falling back to username/email matching.
  async _resolveFirebaseUser(firebaseUserOrUid) {
    const uid = typeof firebaseUserOrUid === 'string'
      ? firebaseUserOrUid
      : (firebaseUserOrUid?.uid || null);
    const email = typeof firebaseUserOrUid === 'string'
      ? null
      : String(firebaseUserOrUid?.email || '').trim().toLowerCase();
    if (!uid) return null;

    let user = await Data.adapter.getUserByFirebaseUid(uid);
    if (!user) {
      const remoteUsers = await FirestoreAdapter.queryRecords('users', 'firebaseUid', uid);
      if (remoteUsers.length > 0) {
        await Data.adapter.mergeRemoteRecord('users', remoteUsers[0]);
        user = await Data.adapter.getUserByFirebaseUid(uid);
      }
    }
    if (user) return user;

    if (!email) return null;

    user = await Data.adapter.getUserByUsername(email);
    if (user) return user;

    const remoteByEmail = await FirestoreAdapter.queryRecords('users', 'username', email);
    const match = remoteByEmail[0];
    if (!match) return null;

    const hydrated = match.firebaseUid === uid
      ? match
      : {
          ...match,
          firebaseUid: uid,
          version: (match.version || 1) + 1,
          updatedAt: new Date().toISOString()
        };

    await Data.adapter.mergeRemoteRecord('users', hydrated);
    return await Data.adapter.getUserByFirebaseUid(uid);
  },
  async _registerFirebaseAdmin(user = this.state.currentUser) {
    if (!this.isFirebaseMode() || !user || !FirestoreAdapter.isReady() || !(user.isAdmin || user.isMaster)) return;
    const uid = FirestoreAdapter.getUid();
    if (!uid) return;
    try {
      const app = window.firebase.app('tenlb-app');
      await app.firestore()
        .collection('challenges').doc('default')
        .collection('admins').doc(uid)
        .set({ grantedAt: new Date().toISOString(), localUserId: user.id, isAdmin: user.isAdmin, isMaster: user.isMaster }, { merge: true });
    } catch (e) {
      console.warn('Could not write admin entry to Firestore:', e.message);
    }
  },
  async _upsertFirebaseSession(user = this.state.currentUser) {
    if (!this.isFirebaseMode() || !user || !FirestoreAdapter.isReady()) return;
    const uid = FirestoreAdapter.getUid();
    if (!uid) return;
    const now = new Date();
    const session = {
      id: this.firebaseSessionId(user),
      userId: user.id,
      firebaseUid: uid,
      email: user.username,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      role: user.userType || (user.isMaster ? 'master' : (user.isAdmin ? 'admin' : 'user')),
      clientId: Device.getId(),
      startedAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ((this.state.appSettings?.sessionDurationDays || 7) * 86400000)).toISOString()
    };
    await FirestoreAdapter.writeRecord('sessions', session);
  },
  async _deleteFirebaseSession(user = this.state.currentUser) {
    if (!this.isFirebaseMode() || !user || !FirestoreAdapter.isReady()) return;
    const sessionId = this.firebaseSessionId(user);
    if (!sessionId) return;
    try {
      await FirestoreAdapter.removeRecord('sessions', sessionId);
    } catch (e) {
      console.warn('Could not remove Firebase session:', e.message);
    }
  },
  async _ensureFirebaseAuthenticatedState(user = this.state.currentUser) {
    if (!this.isFirebaseMode() || !user || !FirestoreAdapter.isReady()) return;
    await this._registerFirebaseAdmin(user);
    await this._upsertFirebaseSession(user);
    if (!SyncEngine.isRunning()) await SyncEngine.start();
    await this.loadSyncMeta();
  },

  _sanitizeRoute(route) {
    const value = String(route || '').replace(/^\/+/, '').trim();
    const normalized = value || 'overview';
    const allowed = new Set(['install', 'denied', 'login', 'join', 'overview', 'rounds', 'create', 'create_participant', 'edit', 'delete', 'submit', 'users', 'user', 'settings', 'invite-detail', 'finish-week']);
    return allowed.has(normalized) ? normalized : 'overview';
  },

  _buildHashRoute(route, options = {}) {
    const target = this._sanitizeRoute(route);
    const params = new URLSearchParams();
    if (target === 'join') {
      const invite = (options.inviteCode || this.state.pendingInviteCode || '').trim().toUpperCase();
      if (invite) params.set('invite', invite);
    }
    if (target === 'user') {
      const userId = String(options.userId || this.state.selectedUserId || '').trim();
      if (userId) params.set('id', userId);
    }
    const q = params.toString();
    return `#/${target}${q ? `?${q}` : ''}`;
  },

  _readHashRoute() {
    const rawHash = String(window.location.hash || '').replace(/^#\/?/, '');
    const [pathPart, queryPart = ''] = rawHash.split('?');
    return {
      route: pathPart ? this._sanitizeRoute(pathPart) : '',
      params: new URLSearchParams(queryPart)
    };
  },

  _defaultRoute() {
    return this.plugin ? this.plugin.defaultRoute() : 'login';
  },

  _guardRoute(route) {
    const requested = this._sanitizeRoute(route);
    return this.plugin ? this.plugin.guardRoute(requested) : 'denied';
  },

  _applyRouteFromHash() {
    const parsed = this._readHashRoute();
    const invite = parsed.params.get('invite');
    const selectedUserId = parsed.route === 'user' ? String(parsed.params.get('id') || '').trim() : '';
    if (invite) this.state.pendingInviteCode = invite.toUpperCase();
    this.state.selectedUserId = selectedUserId || null;
    const requested = parsed.route || this._defaultRoute();
    if (this.isInstalled() && !this.isAuthenticated() && !['login', 'join', 'install'].includes(requested)) {
      this.state.redirectAfterLogin = requested;
    }
    const resolved = this._guardRoute(requested);
    if (!this.isInstalled() && resolved === 'denied') {
      this.setMessage('', 'Server not installed. Open #/install to complete first-time setup.');
    } else if (this.isInstalled() && requested === 'install' && resolved !== 'install') {
      this.setMessage('', 'Installation is locked. #/install is no longer available.');
    }
    this.state.route = resolved;
    const expectedHash = this._buildHashRoute(resolved);
    if (window.location.hash !== expectedHash) {
      history.replaceState(null, '', `${window.location.pathname}${expectedHash}`);
    }
  },

  setupReact() {
    if (!window.React || !window.ReactDOM?.createRoot || !window.ReactRouterDOM?.HashRouter) return;
    const nav = document.getElementById('nav');
    const authChip = document.getElementById('auth-chip');
    const syncBar = document.getElementById('sync-bar');
    const app = document.getElementById('app');
    const snackbar = document.getElementById('snackbar-root');
    if (!nav || !authChip || !syncBar || !app || !snackbar) return;
    this.react = {
      enabled: true,
      navRoot: window.ReactDOM.createRoot(nav),
      authRoot: window.ReactDOM.createRoot(authChip),
      syncRoot: window.ReactDOM.createRoot(syncBar),
      appRoot: window.ReactDOM.createRoot(app),
      snackbarRoot: window.ReactDOM.createRoot(snackbar)
    };
  },

  async init() {
    await loadRuntimeConfig();
    await Data.init();
    await this.loadSettings();
    await this.loadSyncMeta();
    this.setupPwa();
    this.setupReact();

    // Instantiate the mode plugin — all mode-specific behaviour is delegated here.
    this.plugin = RuntimeConfig.serverMode === 'firebase' ? new FirebasePlugin(this) : new OfflinePlugin(this);

    // Import invite code from query once, then move to hash routing
    const urlParams = new URLSearchParams(window.location.search);
    const inviteCode = (urlParams.get('invite') || '').trim().toUpperCase();
    if (inviteCode) this.state.pendingInviteCode = inviteCode;
    if (window.location.search) {
      history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
    }

    await this.plugin.restoreSession();
    await this.refresh();
    this._applyRouteFromHash();
    this.applyTheme();
    this.attachNav();
    this.render();
    window.addEventListener('hashchange', () => {
      this._applyRouteFromHash();
      this.render();
    });
    window.addEventListener('resize', () => {
      if (this.stickyOffsetTimer) clearTimeout(this.stickyOffsetTimer);
      this.stickyOffsetTimer = setTimeout(() => this.updateStickyOffsets(), 80);
    });

    // Plugin-specific startup side effects (e.g. starting Firestore sync).
    await this.plugin.onInit();

    // Listen for remote changes to refresh UI
    window.addEventListener('tenlb:remotechange', () => this.refresh().then(() => this.render()));
    window.addEventListener('tenlb:syncstate', () => this.loadSyncMeta().then(() => this.render()));
  },

  async loadSyncMeta() {
    this.state.syncMeta = await Data.adapter.getDeviceMeta();
  },

  async loadSettings() {
    this.state.appSettings = await Data.adapter.getAppSettings();
    document.getElementById('server-title').textContent = this.state.appSettings.serverName || '10lb Challenge';
  },

  applyTheme() {
    document.body.setAttribute('data-theme', this.state.appSettings?.theme || 'teal');
  },

  async restoreSessionFromCookie() {
    // Kept for compatibility; delegates to the active plugin.
    if (this.plugin) return this.plugin.restoreSession();
    // Legacy fallback (plugin not yet initialised — should not occur in normal flow).
    if (this.isFirebaseMode()) {
      if (!FirestoreAdapter.isReady()) {
        try {
          await this._loadFirebaseSDK();
          await FirestoreAdapter.init(RuntimeConfig.firebase, 'default');
        } catch (e) {
          console.warn('Firebase SDK init failed during session restore:', e.message);
          return;
        }
      }
      const fbUser = await FirestoreAdapter.getCurrentFirebaseUser();
      if (!fbUser || fbUser.isAnonymous) return;
      const user = await this._resolveFirebaseUser(fbUser);
      if (!user) return;
      this.state.currentUser = user;
      await this._upsertFirebaseSession(user);
      return;
    }
    const token = Utils.getCookie('tenlb_session');
    if (!token) return;
    const session = await Data.adapter.getSession(token);
    if (!session) { Utils.clearCookie('tenlb_session'); return; }
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      await Data.adapter.deleteSession(token);
      Utils.clearCookie('tenlb_session');
      this.setMessage('', 'Your session expired. Please log in again.');
      return;
    }
    const user = await Data.adapter.getUserById(session.userId);
    if (!user) { await Data.adapter.deleteSession(token); Utils.clearCookie('tenlb_session'); return; }
    this.state.currentUser = user;
    this.state.sessionToken = token;
    await Data.adapter.touchSession(token, this.state.appSettings.sessionDurationDays || 7);
    Utils.setCookie('tenlb_session', token, this.state.appSettings.sessionDurationDays || 7);
  },

  async loginAs(user) {
    const updated = { ...user, lastLoginAt: new Date().toISOString() };
    await this._saveWithConflictResolver('User', updated, (payload) => Data.adapter.updateUser(payload));
    this.state.currentUser = updated;
    await this.plugin.onLogin(updated);
  },

  async logout() {
    await this.plugin.onLogout();
    this.state.currentUser = null;
    this.state.sessionToken = null;
    this.state.pendingInviteCode = '';
    this.state.selectedUserId = null;
    this.state.redirectAfterLogin = 'overview';
    this.navigate(this._defaultRoute(), { replace: true });
  },

  // ---------------------------------------------------------------------------
  // Online Mode management
  // ---------------------------------------------------------------------------
  async _initOnlineMode(firebaseConfig) {
    if (!this.isFirebaseMode()) return;
    // Lazily load Firebase SDK scripts if not yet loaded
    await this._loadFirebaseSDK();

    await FirestoreAdapter.init(firebaseConfig, 'default');
    Data.mode = 'online';

    const meta = await Data.adapter.getDeviceMeta();
    await Data.adapter.saveDeviceMeta({ ...meta, storageMode: 'online' });

    if (this.state.currentUser) await this._ensureFirebaseAuthenticatedState(this.state.currentUser);
    await this.loadSyncMeta();
    await this.refresh();
    this.render();
  },

  async _loadFirebaseSDK() {
    if (window.firebase?.firestore) return; // compat bundles already loaded
    const loadScript = (src) => new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) return res();
      const s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = () => rej(new Error(`Failed to load Firebase SDK from ${src}`));
      document.head.appendChild(s);
    });
    // Use Firebase 10 compat bundles — these expose window.firebase with v8-style API
    const CDN = 'https://www.gstatic.com/firebasejs/10.12.0';
    await loadScript(`${CDN}/firebase-app-compat.js`);
    await loadScript(`${CDN}/firebase-auth-compat.js`);
    await loadScript(`${CDN}/firebase-firestore-compat.js`);
  },

  async _provisionFirebaseMaster(username, password, localUserId) {
    if (!this.isFirebaseMode()) return null;
    this.installLog('Loading Firebase SDK…');
    await this._loadFirebaseSDK();
    const installName = 'tenlb-install';
    let app;
    try {
      app = window.firebase.app(installName);
      this.installLog('Re-using existing tenlb-install Firebase app.');
    } catch {
      app = window.firebase.initializeApp(RuntimeConfig.firebase, installName);
      this.installLog('Initialised tenlb-install Firebase app.');
    }
    const auth = app.auth();
    const email = String(username).includes('@') ? String(username) : `${username}@tenlb.local`;
    this.installLog(`Creating Firebase Auth account for ${email}…`);
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid = cred?.user?.uid || null;
    this.installLog(`Firebase Auth account created. UID: ${uid || '(none)'}`, uid ? 'ok' : 'warn');
    // Force token refresh so the Firestore request carries a valid auth token immediately.
    if (cred?.user) {
      this.installLog('Refreshing auth token before Firestore writes…');
      await cred.user.getIdToken(true);
      this.installLog('Auth token ready.', 'ok');
    }
    const db = app.firestore();
    if (uid) {
      this.installLog('Writing admin record to Firestore (challenges/default/admins)…');
      await db.collection('challenges').doc('default').collection('admins').doc(uid)
        .set({ grantedAt: new Date().toISOString(), localUserId, isAdmin: true, isMaster: true }, { merge: true });
      this.installLog('Admin record written.', 'ok');
      this.installLog('Writing challenge root document (challenges/default)…');
      await db.collection('challenges').doc('default').set({
        installedAt: new Date().toISOString(),
        installedBy: localUserId,
        mode: 'firebase'
      }, { merge: true });
      this.installLog('Challenge document written.', 'ok');
    }
    return { uid, email };
  },

  async enableOnlineMode(firebaseConfig) {
    if (!this.isFirebaseMode()) return this.fail('Server mode is offline in config.js. Set serverMode to "firebase" to enable online mode.');
    await this._initOnlineMode(firebaseConfig || RuntimeConfig.firebase);
    this.setMessage('Online Mode enabled. Synchronising…');
  },

  async disableOnlineMode() {
    return this.fail('Mode is controlled by deployed config.js and cannot be changed from UI.');
  },

  async testFirebaseConnection(firebaseConfig) {
    try {
      await this._loadFirebaseSDK();
      // Use a temporary named app to test connectivity without touching the main session
      const testName = `tenlb-test-${Date.now()}`;
      const tempApp = window.firebase.initializeApp(firebaseConfig, testName);
      const tempDb = tempApp.firestore();
      await tempDb.collection('challenges').doc('default').get();
      try { await tempApp.delete(); } catch (_) {}
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  },

  setupPwa() {
    const manifest = {
      name: '10lb Challenge',
      short_name: '10lb',
      start_url: './',
      display: 'standalone',
      background_color: '#f6f8fb',
      theme_color: '#0f766e',
      icons: [{ src: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 180 180%22%3E%3Crect width=%22180%22 height=%22180%22 rx=%2232%22 fill=%22%230f766e%22/%3E%3Ctext x=%2290%22 y=%22112%22 font-size=%2272%22 text-anchor=%22middle%22 fill=%22white%22%3E10%3C/text%3E%3C/svg%3E', sizes: '180x180', type: 'image/svg+xml' }]
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = URL.createObjectURL(blob);
    document.head.appendChild(link);

    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  },

  canAccess(route) {
    if (this.plugin) return this.plugin.canAccess(route);
    route = route || 'overview';
    if (!this.isInstalled()) return route === 'install';
    if (!this.isAuthenticated()) return route === 'login' || (route === 'join' && this.isFirebaseMode());
    if (['overview', 'rounds', 'submit', 'settings'].includes(route)) return true;
    return this.isAdmin();
  },

  _baseNavModel() {
    return { items: [], authName: '', authRole: '', syncVisible: false, syncText: '' };
  },

  _syncNavVisibility(nav, hasItems) {
    if (!nav) return;
    nav.classList.toggle('has-items', !!hasItems);
  },


  _teardownNavBurger() {
    const nb = this._navBurger;
    if (!nb) return;
    if (nb.ro) nb.ro.disconnect();
    if (nb.burger && !this.react.enabled) nb.burger.removeEventListener('click', nb.onBurgerClick);
    this._navBurger = null;
  },

  _checkNavOverflow() {
    const nb = this._navBurger;
    if (!nb?.nav || !nb.track) return;
    if (nb.nav.classList.contains('is-open')) {
      nb.nav.classList.add('needs-burger');
      return;
    }
    nb.nav.classList.toggle('needs-burger', nb.track.scrollWidth > nb.track.clientWidth + 2);
  },

  _openNavMenu(nb) {
    const nav = nb.nav;
    nb.collapsedHeight = nav.offsetHeight;
    nav.classList.add('is-open');
    nav.style.height = nb.collapsedHeight + 'px';
    void nav.offsetHeight;
    nav.style.height = nav.scrollHeight + 'px';
    const onEnd = () => { nav.style.height = ''; nav.removeEventListener('transitionend', onEnd); };
    nav.addEventListener('transitionend', onEnd);
    nb.burger.querySelector('.material-symbols-rounded').textContent = 'close';
    nb.burger.setAttribute('aria-label', 'Close menu');
    nb.burger.setAttribute('aria-expanded', 'true');
    this._checkNavOverflow();
  },

  _closeNavMenu(nb) {
    const nav = nb.nav;
    const currentH = nav.offsetHeight;
    const collapsedH = nb.collapsedHeight || currentH;
    nav.style.height = currentH + 'px';
    nav.classList.remove('is-open');
    this._checkNavOverflow();
    void nav.offsetHeight;
    nav.style.height = collapsedH + 'px';
    const onEnd = () => { nav.style.height = ''; nav.removeEventListener('transitionend', onEnd); };
    nav.addEventListener('transitionend', onEnd);
    nb.burger.querySelector('.material-symbols-rounded').textContent = 'menu';
    nb.burger.setAttribute('aria-label', 'Open menu');
    nb.burger.setAttribute('aria-expanded', 'false');
  },

  _setupNavBurger() {
    const nav = document.getElementById('nav');
    if (!nav || !nav.classList.contains('has-items')) {
      this._teardownNavBurger();
      return;
    }
    const track = nav.querySelector('.menu-track');
    const burger = nav.querySelector('.menu-burger');
    if (!track || !burger) {
      this._teardownNavBurger();
      return;
    }
    if (this._navBurger?.nav === nav && this._navBurger?.track === track) {
      this._checkNavOverflow();
      return;
    }
    this._teardownNavBurger();
    const nb = { nav, track, burger, collapsedHeight: 0 };
    nb.onBurgerClick = () => {
      if (nav.classList.contains('is-open')) this._closeNavMenu(nb);
      else this._openNavMenu(nb);
    };
    nb.ro = new ResizeObserver(() => this._checkNavOverflow());
    nb.ro.observe(nav);
    if (!this.react.enabled) burger.addEventListener('click', nb.onBurgerClick);
    this._navBurger = nb;
    this._checkNavOverflow();
  },

  _buildSyncStatus(syncMeta) {
    if (!syncMeta) return { syncVisible: false, syncText: '' };
    const mode = syncMeta.storageMode || 'local';
    if (mode !== 'online') return { syncVisible: false, syncText: '' };
    const status = syncMeta.syncStatus || 'idle';
    const statusIcons = { idle: '', syncing: '↻', synced: '✓', pending: '⚠', error: '✗' };
    const statusText = {
      idle: '',
      syncing: 'Syncing…',
      synced: `Synced ${syncMeta.lastSyncAt ? Utils.dateTime(syncMeta.lastSyncAt) : ''}`,
      pending: 'Changes pending',
      error: 'Sync error'
    };
    return {
      syncVisible: true,
      syncText: `${statusIcons[status] || ''} ONLINE — ${statusText[status] || status}`
    };
  },

  attachNav() {
    const nav = document.getElementById('nav');
    const authChip = document.getElementById('auth-chip');
    const syncBar = document.getElementById('sync-bar');
    const model = this._baseNavModel();

    if (!this.isInstalled() || !this.isAuthenticated()) {
      if (!this.react.enabled) {
        nav.innerHTML = '';
        authChip.innerHTML = '';
        if (syncBar) syncBar.style.display = 'none';
      }
      this._syncNavVisibility(nav, false);
      return model;
    }

    model.items = [
      { key: 'overview', label: 'Current Round', icon: 'dashboard' },
      { key: 'rounds', label: 'Rounds', icon: 'calendar_month' },
      { key: 'submit', label: 'Submit', icon: 'monitor_weight' }
    ];
    if (this.isAdmin()) model.items.push(
      { key: 'create', label: 'Create', icon: 'add_circle' },
      { key: 'users', label: 'Users', icon: 'group' }
    );
    model.items.push({ key: 'settings', label: 'Settings', icon: 'settings' });
    model.authName = Utils.fullName(this.state.currentUser);
    model.authRole = this.roleLabel(this.state.currentUser);

    if (!this.react.enabled) {
      nav.innerHTML = `<div class="nav-inner"><div class="menu-track" role="menubar">${model.items.map((item) => `<a href="${this._buildHashRoute(item.key)}" class="menu-item ${this.state.route === item.key ? 'active' : ''}" role="menuitem" data-route="${item.key}" aria-current="${this.state.route === item.key ? 'page' : 'false'}"><span class="material-symbols-rounded" aria-hidden="true">${item.icon}</span><span>${Utils.esc(item.label)}</span></a>`).join('')}</div><button class="menu-burger" type="button" aria-label="Open menu" aria-expanded="false"><span class="material-symbols-rounded" aria-hidden="true">menu</span></button></div>`;
      nav.onclick = (e) => {
        const b = e.target.closest('[data-route]');
        if (!b) return;
        e.preventDefault();
        this.navigate(b.dataset.route);
      };
      authChip.innerHTML = `${Utils.esc(model.authName)} <span class="tag">${model.authRole}</span> <button class="btn secondary small" id="btn-logout">Logout</button>`;
      const logoutBtn = document.getElementById('btn-logout');
      if (logoutBtn) logoutBtn.onclick = () => this.logout();
    }

    const syncStatus = this._buildSyncStatus(this.state.syncMeta);
    model.syncVisible = syncStatus.syncVisible;
    model.syncText = syncStatus.syncText;
    if (syncBar && !this.react.enabled) {
      syncBar.style.display = model.syncVisible ? 'block' : 'none';
      syncBar.textContent = model.syncVisible ? model.syncText : '';
    }
    this._syncNavVisibility(nav, model.items.length > 0);
    return model;
  },

  renderWithReact(navModel, screen) {
    if (!this.react.enabled) return false;
    const React = window.React;
    const Router = window.ReactRouterDOM;
    if (!Router?.HashRouter || !Router?.Link) return false;
    const { HashRouter, Link } = Router;
    const e = React.createElement;
    const syncBar = document.getElementById('sync-bar');
    if (syncBar) syncBar.style.display = navModel.syncVisible ? 'block' : 'none';
    this._syncNavVisibility(document.getElementById('nav'), navModel.items.length > 0);
    this.react.navRoot.render(e(HashRouter, null, e('div', { className: 'nav-inner' },
      e('div', { className: 'menu-track', role: 'menubar' },
        ...navModel.items.map((item) => e(Link, {
          key: item.key,
          to: `/${item.key}`,
          className: `menu-item ${this.state.route === item.key ? 'active' : ''}`,
          role: 'menuitem',
          'aria-current': this.state.route === item.key ? 'page' : 'false',
          onClick: (event) => {
            event.preventDefault();
            this.navigate(item.key);
          }
        }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, item.icon), e('span', null, item.label)))
      ),
      e('button', { className: 'menu-burger', type: 'button', 'aria-label': 'Open menu', 'aria-expanded': 'false', onClick: () => this._navBurger?.onBurgerClick?.() },
        e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'menu')
      )
    )));
    this.react.authRoot.render(navModel.authName
      ? e(React.Fragment, null,
        navModel.authName,
        ' ',
        e('span', { className: 'tag' }, navModel.authRole),
        ' ',
        e('button', { className: 'btn secondary small', type: 'button', onClick: () => this.logout() }, 'Logout'))
      : null);
    this.react.syncRoot.render(navModel.syncVisible ? navModel.syncText : null);
    this.react.appRoot.render(e('div', { dangerouslySetInnerHTML: { __html: screen } }));
    return true;
  },

  async refresh() {
    this.state.rounds = await Data.adapter.listRounds();
    this.state.users = await Data.adapter.listUsers();
    this.state.submissions = await Data.adapter.listSubmissions();
    this.state.invites = await this._loadVisibleInvites();
    this.state.sessions = await this._loadVisibleSessions();
    const active = Domain.activeRound(this.state.rounds);
    if (!this.state.selectedRoundId) this.state.selectedRoundId = active?.id || this.state.rounds[0]?.id || null;
    if (this.state.currentUser) {
      this.state.currentUser = this.state.users.find((u) => u.id === this.state.currentUser.id) || this.state.currentUser;
    }
  },

  renderSnackbar() {
    const host = document.getElementById('snackbar-root');
    if (!host) return;
    if (!this._snacks) this._snacks = [];
    host.innerHTML = '';
    for (const item of this._snacks) {
      const bar = document.createElement('div');
      bar.className = `snackbar ${item.kind}`;
      bar.setAttribute('role', 'status');
      bar.dataset.snackId = item.id;
      const txt = document.createElement('span');
      txt.className = 'snackbar-text';
      txt.textContent = item.text;
      bar.appendChild(txt);
      const closeBtn = document.createElement('button');
      closeBtn.className = 'snackbar-close';
      closeBtn.setAttribute('aria-label', 'Dismiss');
      closeBtn.textContent = '✕';
      closeBtn.addEventListener('click', () => this._removeSnack(item.id));
      bar.appendChild(closeBtn);
      host.appendChild(bar);
    }
  },

  _snackCounter: 0,
  _snacks: [],

  _pushSnack(text, kind) {
    if (!text) return;
    if (!this._snacks) this._snacks = [];
    const id = ++this._snackCounter;
    const item = { id, text, kind };
    this._snacks.push(item);
    this.renderSnackbar();
    if (kind === 'success') {
      item._timer = setTimeout(() => this._removeSnack(id), 7000);
    }
  },

  _removeSnack(id) {
    if (!this._snacks) return;
    const item = this._snacks.find((s) => s.id === id);
    if (item?._timer) clearTimeout(item._timer);
    this._snacks = this._snacks.filter((s) => s.id !== id);
    this.renderSnackbar();
  },

  setMessage(msg = '', err = '') {
    this.state.message = msg;
    this.state.error = err;
    if (msg) this._pushSnack(msg, 'success');
    if (err) this._pushSnack(err, 'error');
  },

  errorMessage(err) {
    return err?.message || String(err || 'Something went wrong.');
  },

  updateStickyOffsets() {
    const header = document.querySelector('header');
    document.documentElement.style.setProperty('--header-offset', `${header?.offsetHeight || 0}px`);
  },

  enhanceButtons() {
    document.querySelectorAll('button').forEach((button) => {
      if (button.dataset.iconSkip === '1') return;
      const iconName = this.iconForButton(button);
      if (!iconName) return;
      button.dataset.iconDefault = iconName;
      let label = button.querySelector('.btn-label');
      if (!label) {
        const labelText = this.buttonLabelText(button);
        if (!labelText && button.dataset.weekNav) button.setAttribute('aria-label', button.dataset.weekNav === 'prev' ? 'Previous week' : 'Next week');
        if (!labelText && button.dataset.payAdjust !== undefined) button.setAttribute('aria-label', Number(button.dataset.payAdjust) < 0 ? 'Decrease amount' : 'Increase amount');
        if (labelText) button.setAttribute('aria-label', button.getAttribute('aria-label') || labelText);
        label = document.createElement('span');
        label.className = 'btn-label';
        label.textContent = labelText;
        button.textContent = '';
        button.appendChild(label);
      }
      let icon = button.querySelector('.btn-icon');
      if (!icon) {
        icon = document.createElement('span');
        icon.className = 'btn-icon material-symbols-rounded';
        icon.setAttribute('aria-hidden', 'true');
        button.prepend(icon);
      }
      if (!button.dataset.busy) icon.textContent = iconName;
    });
  },

  buttonLabelText(button) {
    if (!button) return '';
    if (button.dataset.weekNav !== undefined || button.dataset.payAdjust !== undefined) return '';
    return (button.querySelector('.btn-label')?.textContent || button.textContent || '').replace(/^[←↻◀▶]+\s*/, '').trim();
  },

  setButtonLabel(button, label) {
    if (!button) return;
    const labelEl = button.querySelector('.btn-label');
    if (labelEl) labelEl.textContent = label;
    else button.textContent = label;
    this.enhanceButtons();
  },

  setButtonBusy(button, busy) {
    if (!button) return () => {};
    this.enhanceButtons();
    const icon = button.querySelector('.btn-icon');
    button.dataset.busy = busy ? '1' : '';
    button.disabled = !!busy;
    if (icon) {
      icon.classList.toggle('material-symbols-rounded', !busy);
      if (busy) {
        icon.textContent = '';
        icon.classList.add('btn-spinner');
      } else {
        icon.classList.remove('btn-spinner');
        icon.classList.add('material-symbols-rounded');
        icon.textContent = button.dataset.iconDefault || this.iconForButton(button) || 'check';
      }
    }
    return () => this.setButtonBusy(button, false);
  },

  iconForButton(button) {
    if (!button) return '';
    if (button.id === 'btn-logout') return 'logout';
    if (button.id === 'btn-go-login') return 'login';
    if (button.id === 'btn-create-invite') return 'person_add';
    if (button.id === 'btn-delete-all-invites') return 'delete_sweep';
    if (button.id === 'btn-copy-invite-link') return 'content_copy';
    if (button.id === 'btn-create-new-invite') return 'add_link';
    if (button.id === 'btn-delete-this-invite') return 'delete';
    if (button.id === 'btn-sync-retry') return 'sync';
    if (button.id === 'btn-firebase-test') return 'network_check';
    if (button.dataset.go) {
      return {
        overview: 'home',
        rounds: 'list_alt',
        create: 'add_circle',
        create_participant: 'person_add',
        edit: 'edit',
        delete: 'delete',
        submit: 'publish',
        users: 'groups',
        user: 'person',
        settings: 'settings',
        'invite-detail': 'qr_code',
        login: 'login',
        join: 'person_add'
      }[button.dataset.go] || 'arrow_forward';
    }
    if (button.dataset.viewInvite !== undefined) return 'visibility';
    if (button.dataset.deleteInvite !== undefined || button.dataset.bulkDelete !== undefined) return 'delete';
    if (button.dataset.userActionApply !== undefined) return 'task_alt';
    if (button.dataset.userToggle === 'all') return 'select_all';
    if (button.dataset.addUser !== undefined) return 'person_add';
    if (button.dataset.payAdjust !== undefined) return Number(button.dataset.payAdjust) < 0 ? 'remove' : 'add';
    if (button.dataset.openRound !== undefined) return 'emoji_events';
    if (button.dataset.weekNav === 'prev') return 'chevron_left';
    if (button.dataset.weekNav === 'next') return 'chevron_right';
    if (button.dataset.settingsTab) {
      return { user: 'person', server: 'settings', sync: 'sync' }[button.dataset.settingsTab] || 'tune';
    }
    const formId = button.form?.id;
    if (button.type === 'submit' && formId) {
      return {
        'install-form': 'install_desktop',
        'login-form': 'login',
        'join-form': 'person_add',
        'create-participant-form': 'person_add',
        'edit-user-form': 'save',
        'user-type-form': 'manage_accounts',
        'create-form': 'add_circle',
        'edit-form': 'save',
        'delete-form': 'delete',
        'submit-form': 'publish',
        'user-settings-form': 'save',
        'user-password-form': 'password',
        'server-settings-form': 'save',
        'server-reset-form': 'restart_alt'
      }[formId] || 'send';
    }
    const text = (button.querySelector('.btn-label')?.textContent || button.textContent).trim().toLowerCase();
    if (text.includes('cancel')) return 'close';
    if (text.includes('delete')) return 'delete';
    if (text.includes('save')) return 'save';
    if (text.includes('login')) return 'login';
    if (text.includes('submit')) return 'publish';
    if (text.includes('create')) return 'add_circle';
    if (text.includes('copy')) return 'content_copy';
    if (text.includes('back')) return 'arrow_back';
    return button.classList.contains('danger') ? 'warning' : 'arrow_forward';
  },

  applyFormCustomValidity(form) {
    if (!form) return;
    this.prepareFormFields(form);
    form.querySelectorAll('input, select, textarea').forEach((field) => {
      if (typeof field.setCustomValidity === 'function') field.setCustomValidity('');
    });
    form.querySelectorAll('input[required], select[required], textarea[required]').forEach((field) => {
      const type = (field.getAttribute('type') || 'text').toLowerCase();
      if (field.disabled) return;
      if (['checkbox', 'radio'].includes(type)) {
        if (!field.checked) field.setCustomValidity(`${this.fieldLabel(field)} is required.`);
        return;
      }
      if (type === 'file') return;
      if (!String(field.value || '').trim()) field.setCustomValidity(`${this.fieldLabel(field)} is required.`);
    });
    const password = form.querySelector('[name="password"]');
    const newPassword = form.querySelector('[name="newPassword"]');
    const confirmPassword = form.querySelector('[name="confirmPassword"]');
    const passwordSource = newPassword || password;
    if (passwordSource && confirmPassword && confirmPassword.value && passwordSource.value !== confirmPassword.value) {
      confirmPassword.setCustomValidity(`${this.fieldLabel(confirmPassword)} must match ${this.fieldLabel(passwordSource)}.`);
    }
  },

  prepareFormFields(form) {
    if (!form) return;
    const fields = form.querySelectorAll('input, select, textarea');
    fields.forEach((field, index) => {
      const type = (field.getAttribute('type') || '').toLowerCase();
      if (['hidden', 'button', 'submit', 'reset'].includes(type)) return;
      if (!field.id) {
        const safeName = (field.name || field.type || `field-${index}`).replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
        field.id = `${form.id || 'form'}-${safeName}-${index}`;
      }
      const label = Array.from(field.parentElement?.children || []).find((node) => node.tagName === 'LABEL' && !node.contains(field));
      if (label && !label.getAttribute('for')) label.setAttribute('for', field.id);
      this.fieldErrorSlot(field);
    });
  },

  fieldLabel(field) {
    if (!field) return 'This field';
    const explicit = field.getAttribute('data-label') || field.getAttribute('aria-label');
    if (explicit) return explicit.trim();
    if (field.id) {
      const linked = field.form?.querySelector(`label[for="${CSS.escape(field.id)}"]`);
      if (linked) return linked.textContent.replace(/\s+/g, ' ').trim();
    }
    const wrapping = field.closest('label');
    if (wrapping) {
      const text = wrapping.textContent.replace(/\s+/g, ' ').trim();
      if (text) return text;
    }
    return (field.name || 'This field').replace(/([A-Z])/g, ' $1').replace(/[-_]+/g, ' ').trim().replace(/^./, (x) => x.toUpperCase());
  },

  fieldErrorSlot(field) {
    if (!field?.form) return null;
    const type = (field.getAttribute('type') || '').toLowerCase();
    if (['hidden', 'button', 'submit', 'reset'].includes(type)) return null;
    const id = `${field.id}-error`;
    let slot = document.getElementById(id);
    if (!slot) {
      slot = document.createElement('div');
      slot.id = id;
      slot.className = 'field-error';
      const anchor = ['checkbox', 'radio'].includes(type) ? (field.closest('label') || field) : field;
      anchor.insertAdjacentElement('afterend', slot);
    }
    field.setAttribute('aria-describedby', id);
    return slot;
  },

  fieldValidationMessage(field) {
    const label = this.fieldLabel(field);
    if (field.validationMessage && field.validity.customError) return field.validationMessage;
    if (field.validity.valueMissing) return `${label} is required.`;
    if (field.validity.typeMismatch) {
      const type = (field.getAttribute('type') || '').toLowerCase();
      if (type === 'email') return `Enter a valid ${label.toLowerCase()}.`;
      return `${label} is invalid.`;
    }
    if (field.validity.patternMismatch && field.title) return `${label}: ${field.title}`;
    if (field.validity.tooShort) return `${label} is too short.`;
    if (field.validity.tooLong) return `${label} is too long.`;
    if (field.validity.rangeUnderflow) return `${label} must be at least ${field.min}.`;
    if (field.validity.rangeOverflow) return `${label} must be no more than ${field.max}.`;
    if (field.validity.stepMismatch) return `${label} has an invalid value.`;
    if (field.validity.badInput) return `${label} has an invalid value.`;
    return field.validationMessage || `${label} is invalid.`;
  },

  setFieldValidation(field, message = '') {
    if (!field || !field.willValidate) return;
    const slot = this.fieldErrorSlot(field);
    if (!slot) return;
    const hasError = !!message;
    field.classList.toggle('is-invalid', hasError);
    field.setAttribute('aria-invalid', hasError ? 'true' : 'false');
    slot.classList.toggle('visible', hasError);
    slot.textContent = message;
  },

  clearFormValidation(form) {
    if (!form) return;
    form.querySelectorAll('input, select, textarea').forEach((field) => this.setFieldValidation(field, ''));
  },

  enhanceFormValidation(form) {
    if (!form || form.dataset.validationBound === '1') return;
    form.dataset.validationBound = '1';
    this.prepareFormFields(form);
    const update = (event) => {
      this.applyFormCustomValidity(form);
      if (event?.target) this.setFieldValidation(event.target, '');
      const confirmPassword = form.querySelector('[name="confirmPassword"]');
      if (confirmPassword && event?.target && ['password', 'newPassword', 'confirmPassword'].includes(event.target.name)) {
        this.setFieldValidation(confirmPassword, '');
      }
    };
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    update();
  },

  validateForm(form) {
    this.clearFormValidation(form);
    this.applyFormCustomValidity(form);
    const invalidFields = Array.from(form.querySelectorAll('input, select, textarea'))
      .filter((field) => field.willValidate && !field.disabled && !field.checkValidity());
    if (!invalidFields.length) return true;
    invalidFields.forEach((field) => this.setFieldValidation(field, this.fieldValidationMessage(field)));
    invalidFields[0]?.focus();
    this.fail('Form validation failed.');
    return false;
  },

  bindAsyncFormSubmit(form, handler) {
    if (!form) return;
    this.enhanceFormValidation(form);
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!this.validateForm(form)) return;
      const release = this.setButtonBusy(e.submitter || form.querySelector('button[type="submit"]'), true);
      try {
        await handler(e);
      } catch (err) {
        console.error(err);
        this.fail(this.errorMessage(err));
      } finally {
        release();
      }
    };
  },

  async navigate(route, options = {}) {
    const target = this._sanitizeRoute(route || this._defaultRoute());
    if (!options.keepFlash) {
      this.state.error = '';
      this.state.message = '';
    }
    if (!this.isAuthenticated() && this.isInstalled() && !['login', 'join'].includes(target)) {
      this.state.redirectAfterLogin = target;
    }
    if (target === 'join' && options.inviteCode) this.state.pendingInviteCode = String(options.inviteCode).toUpperCase();
    const nextHash = this._buildHashRoute(target, options);
    if (window.location.hash === nextHash) {
      this._applyRouteFromHash();
      this.render();
      return;
    }
    history[options.replace ? 'replaceState' : 'pushState'](null, '', `${window.location.pathname}${nextHash}`);
    this._applyRouteFromHash();
    this.render();
  },

  routeLink(route, options = {}) {
    return `${window.location.origin}${window.location.pathname}${this._buildHashRoute(route, options)}`;
  },

  _ensureJsOnlyFormHandling() {
    document.querySelectorAll('form').forEach((form) => {
      if (!form.dataset.jsSubmitBound) {
        form.setAttribute('method', 'post');
        form.removeAttribute('action');
        form.dataset.jsSubmitBound = '1';
        form.addEventListener('submit', (e) => e.preventDefault());
      }
    });
  },

  redirectToPostLogin(route) {
    const target = route && route !== 'login' ? route : (this.state.redirectAfterLogin || 'overview');
    return this._guardRoute(target);
  },

  currentRound() {
    if (this.state.selectedRoundId) {
      const exact = this.state.rounds.find((r) => r.id === this.state.selectedRoundId);
      if (exact) return exact;
    }
    return Domain.activeRound(this.state.rounds) || this.state.rounds[0] || null;
  },

  _renderAuthenticatedRoute(route) {
    const routeScreens = {
      denied: () => this.renderDenied(),
      overview: () => this.renderOverview(),
      rounds: () => this.renderRoundList(),
      create: () => this.renderCreate(),
      create_participant: () => this.renderCreateParticipant(),
      edit: () => this.renderEdit(),
      delete: () => this.renderDelete(),
      submit: () => this.renderSubmit(),
      users: () => this.renderUsers(),
      user: () => this.renderUserAdmin(),
      settings: () => this.renderSettings(),
      'invite-detail': () => this.renderInviteDetail(),
      'finish-week': () => this.renderFinishWeek()
    };
    const renderRoute = routeScreens[route];
    return renderRoute ? renderRoute() : '';
  },

  resolveScreen() {
    // Install route is always rendered when the guard has allowed it, regardless
    // of isInstalled() — this is necessary for firebase mode where isInstalled()
    // is always true but the install page must still be reachable before setup.
    if (this.state.route === 'install') return this.renderInstall();
    if (!this.isInstalled()) {
      if (this.state.route === 'denied') return this.renderDenied();
      return this.renderJoin();
    }
    if (!this.isAuthenticated()) {
      if (this.state.route === 'join') return this.renderJoin();
      return this.renderLogin();
    }
    return this._renderAuthenticatedRoute(this.state.route);
  },

  render() {
    const navModel = this.attachNav();
    this.applyTheme();
    document.getElementById('server-title').textContent = this.state.appSettings?.serverName || '10lb Challenge';

    const app = document.getElementById('app');
    const screen = this.resolveScreen();

    if (!this.renderWithReact(navModel, screen)) app.innerHTML = screen;
    this._setupNavBurger();
    this.updateStickyOffsets();
    this.renderSnackbar();

    this.bindScreenEvents();
  },

  renderDenied() {
    return `<div class="card"><h2>Access denied</h2><p class="error">You do not have permission to view this page.</p><button class="btn secondary" data-go="overview">Go back</button></div>`;
  },

  renderInstall() {
    const s = this.state.appSettings || {};
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
        <div style="grid-column:1/-1" class="row"><button class="btn" type="submit">Install server</button></div>
      </form>
      <div id="install-log" style="display:none;margin-top:16px;padding:12px;background:var(--surface2,#1a1a2e);border:1px solid var(--border,#333);border-radius:6px;font-family:monospace;font-size:12px;line-height:1.6;color:var(--text,#ccc);max-height:300px;overflow-y:auto;white-space:pre-wrap;word-break:break-all"></div>
    </div>`;
  },

  renderLogin() {
    return `<div class="card" style="max-width:560px;margin:0 auto"><h2 style="margin-top:0">Login</h2>
      <p class="muted">Enter your account details to continue.</p>
      <form id="login-form" class="grid">
        <div><label>Email</label><input name="username" type="email" inputmode="email" required autocomplete="email" autocapitalize="none" spellcheck="false" /></div>
        <div><label>Password</label><input name="password" type="password" required autocomplete="current-password" /></div>
        <input name="redirect" type="hidden" value="${Utils.escAttr(this.state.redirectAfterLogin || 'overview')}" />
        <button class="btn" type="submit">Login</button>
      </form>
      ${this.isFirebaseMode() ? '<p class="small muted" style="margin-top:12px">Have an invite code? <a href="#" id="link-to-join" style="color:var(--brand)">Click here to register</a></p>' : ''}
    </div>`;
  },

  renderJoin() {
    if (!this.isFirebaseMode()) {
      return `<div class="card" style="max-width:560px;margin:0 auto"><h2 style="margin-top:0">Registration unavailable</h2><p class="muted">This server is running in offline mode. Ask the master admin to create participant accounts.</p><button class="btn secondary" type="button" id="btn-go-login">Go to login</button></div>`;
    }
    const code = this.state.pendingInviteCode || '';
    const serverName = this.state.appSettings?.serverName || '10lb Challenge';
    return `<div class="card" style="max-width:560px;margin:0 auto">
      <h2 style="margin-top:0">Join ${Utils.esc(serverName)}</h2>
      <p class="muted">Enter your invite code and create your account.</p>
      <form id="join-form" class="grid">
        <div><label>Invite code</label><input name="inviteCode" type="text" required autocomplete="off" autocapitalize="characters" spellcheck="false" minlength="8" maxlength="8" pattern="[A-HJ-NP-Z2-9]{8}" title="Enter the 8-character invite code." value="${Utils.escAttr(code)}" placeholder="e.g. ABCD1234" style="text-transform:uppercase;letter-spacing:.1em" /></div>
        <div><label>Email</label><input name="username" type="email" required autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" /></div>
        <div><label>Password</label><input name="password" type="password" required ${Utils.passwordInputAttrs('new-password')} /></div>
        <div><label>Confirm password</label><input name="confirmPassword" type="password" required ${Utils.passwordInputAttrs('new-password')} /></div>
        <div><label>First name</label><input name="firstName" type="text" required autocomplete="given-name" /></div>
        <div><label>Last name</label><input name="lastName" type="text" required autocomplete="family-name" /></div>
        <div style="grid-column:1/-1" class="small muted">Password must contain at least 8 characters, including a number, letter, and symbol.</div>
        <div style="grid-column:1/-1" class="row">
          <button class="btn" type="submit">Create account</button>
          <button class="btn secondary" type="button" id="btn-go-login">Already have an account</button>
        </div>
      </form>
    </div>`;
  },

  renderInvites() {
    if (!this.isAdmin()) return this.renderDenied();
    const pending = this.state.invites.filter((i) => !i.usedAt);
    const used = this.state.invites.filter((i) => !!i.usedAt);
    const pendingRows = pending.map((inv) => `<tr>
      <td><code style="font-size:.9rem;letter-spacing:.1em">${Utils.esc(inv.code)}</code></td>
      <td>${Utils.dateTime(inv.createdAt)}</td>
      <td><span class="pill warn">Pending</span></td>
      <td>
        <div class="row">
          <button class="btn secondary small" data-view-invite="${Utils.escAttr(inv.id)}">View</button>
          <button class="btn danger small" data-delete-invite="${Utils.escAttr(inv.id)}">Delete</button>
        </div>
      </td>
    </tr>`).join('');
    const usedRows = used.map((inv) => {
      const user = this.state.users.find((u) => u.id === inv.usedBy);
      return `<tr>
        <td><code style="font-size:.9rem;letter-spacing:.1em">${Utils.esc(inv.code)}</code></td>
        <td>${Utils.dateTime(inv.createdAt)}</td>
        <td><span class="pill ok">Used</span></td>
        <td>${user ? Utils.esc(Utils.fullName(user)) : '<span class="muted">Unknown</span>'}</td>
        <td>${Utils.dateTime(inv.usedAt)}</td>
        <td><button class="btn danger small" data-delete-invite="${Utils.escAttr(inv.id)}">Delete</button></td>
      </tr>`;
    }).join('');
    return `<div class="card">
      <div class="row between" style="margin-bottom:12px">
        <h2 style="margin:0">Invites</h2>
        <div class="row">
          <button class="btn" id="btn-create-invite">Create invite</button>
          ${pending.length ? `<button class="btn danger" id="btn-delete-all-invites">Delete all pending</button>` : ''}
        </div>
      </div>
      <h3 style="margin-top:0">Pending (${pending.length})</h3>
      ${pending.length ? `<div style="overflow:auto"><table class="table"><thead><tr><th>Code</th><th>Issued</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${pendingRows}</tbody></table></div>` : `<p class="muted">No pending invites. Create one to invite someone.</p>`}
      ${used.length ? `<h3 style="margin-top:16px">Used (${used.length})</h3>
        <div style="overflow:auto"><table class="table"><thead><tr><th>Code</th><th>Issued</th><th>Status</th><th>Used by</th><th>Used at</th><th>Actions</th></tr></thead>
        <tbody>${usedRows}</tbody></table></div>` : ''}
    </div>`;
  },

  renderInviteDetail() {
    if (!this.isAdmin()) return this.renderDenied();
    const inv = this.state.inviteDetail;
    if (!inv) return this.renderUsers();
    const inviteLink = this.routeLink('join', { inviteCode: inv.code });
    return `<div class="card" style="max-width:640px;margin:0 auto">
      <div class="row between" style="margin-bottom:12px">
        <h2 style="margin:0">Invite link</h2>
        <button class="btn secondary" data-go="users">← Back to users</button>
      </div>
      <p class="muted">Share this invite with the person you want to join. The code can only be used once.</p>

      <div style="text-align:center;margin:16px 0">
        <div id="qr-code-container" style="display:inline-block;padding:12px;background:#fff;border:1px solid var(--border);border-radius:12px"></div>
        <p class="small muted" id="qr-status" style="margin:6px 0 0">Loading QR code…</p>
      </div>

      <div style="margin:16px 0">
        <label>Invite code</label>
        <div class="row">
          <code id="invite-code-display" style="font-size:1.6rem;letter-spacing:.2em;font-weight:700;background:var(--bg);padding:10px 16px;border-radius:10px;flex:1;text-align:center">${Utils.esc(inv.code)}</code>
        </div>
      </div>

      <div style="margin:16px 0">
        <label>Invite link</label>
        <div class="row">
          <input id="invite-link-input" readonly value="${Utils.escAttr(inviteLink)}" style="font-size:.85rem" />
          <button class="btn" id="btn-copy-invite-link" style="white-space:nowrap">Copy link</button>
        </div>
      </div>

      <div class="row" style="margin-top:16px">
        <button class="btn secondary" id="btn-create-new-invite">Create another invite</button>
        <button class="btn danger" data-delete-invite="${Utils.escAttr(inv.id)}" id="btn-delete-this-invite">Delete this invite</button>
      </div>
      <p class="small muted" style="margin-top:8px">Issued: ${Utils.dateTime(inv.createdAt)}</p>
    </div>`;
  },

  renderOverview() {
    const round = this.currentRound();
    if (!round) return `<div class="card"><h2>No challenges active</h2><p class="muted">Start a new round to begin.</p>${this.isAdmin() ? '<button class="btn" data-go="create">Start New Round</button>' : ''}</div>`;
    const subs = Domain.submissionsByRound(this.state.submissions, round.id);
    const currentWeek = Domain.calcCurrentWeek(round, this.state.users, subs);
    const selectedWeek = this.state.weekCursor[round.id] || Math.min(currentWeek, round.weeksCount);
    const view = Domain.weekView(round, this.state.users, subs, selectedWeek);
    const prizeRanks = Domain.payoutRankIndices(round);
    const isFinalComplete = Domain.isWeekComplete(round, this.state.users, subs, round.weeksCount);
    const canGoNext = selectedWeek < currentWeek;

    const unit = this.state.appSettings.weightFormat || 'lb';
    const statusPanel = (this.isAdmin() && selectedWeek === currentWeek)
      ? SubmissionStatusPanel.render(round, this.state.users, subs, selectedWeek, {})
      : '';
    return `<div class="card">
      <div class="row between">
        <h2 style="margin:0">${Utils.esc(round.title)}</h2>
        <span class="tag">${round.status}</span>
      </div>
      <div class="row small muted">
        <span>${round.participantIds.length} participants</span><span>•</span>
        <span>${round.weeksCount} weeks</span><span>•</span>
        <span>Weigh day: ${Utils.weekdayName(round.weighDay)}</span>
      </div>
      <div class="row between week-nav" style="margin-top:8px">
        <button data-week-nav="prev" ${selectedWeek <= 1 ? 'disabled' : ''}>◀</button>
        <strong>Week ${selectedWeek} of ${round.weeksCount}</strong>
        <button data-week-nav="next" ${!canGoNext ? 'disabled' : ''}>▶</button>
      </div>
      <div class="small muted" style="margin-top:6px">Current progress week: ${currentWeek} / ${round.weeksCount}</div>
      ${statusPanel}
      ${selectedWeek === 1 ? `<div class="card" style="margin-top:10px"><strong>Start weights</strong>${view.startWeights.length ? `<ul>${view.startWeights.map((x)=>`<li>${Utils.esc(Utils.fullName(x.user))}: ${x.weight}${unit}</li>`).join('')}</ul>` : '<p class="muted">No start weights submitted yet.</p>'}</div>` : ''}
      ${selectedWeek >= 2 ? `<div class="card" style="margin-top:10px"><strong>Leaderboard</strong>
      <table class="table"><thead><tr><th>Rank</th><th>User</th><th>% Lost</th><th>This Week</th><th>Total</th></tr></thead><tbody>
      ${view.ranked.map((r, i) => {
        const rank = i + 1;
        const prize = prizeRanks.includes(i) ? ` ${['🏆','🥈','🥉','🎖️','🎗️','⭐','✨'][i] || '🏅'}` : '';
        const delta = r.weeklyLoss > 0 ? `<span class="arrow-loss">⬇ ${r.weeklyLoss}${unit}</span>` : (r.weeklyLoss < 0 ? `<span class="arrow-gain">⬆ ${Math.abs(r.weeklyLoss)}${unit}</span>` : '—');
        return `<tr><td>${rank}${prize}</td><td>${Utils.esc(Utils.fullName(r.user))}</td><td>${Utils.pct(r.percentLoss)}</td><td>${delta}</td><td>${r.totalLoss}${unit}</td></tr>`;
      }).join('') || '<tr><td colspan="5" class="muted">No leaderboard data yet.</td></tr>'}
      </tbody></table>
      ${view.holiday.length ? `<h4>Holiday</h4><ul>${view.holiday.map((x)=>`<li class="holiday">${Utils.esc(Utils.fullName(x.user))} (used ${x.holidaysUsed}/${round.holidaysAllowed})</li>`).join('')}</ul>`:''}
      ${view.forfeit.length ? `<h4>Forfeit</h4><ul>${view.forfeit.map((x)=>`<li class="forfeit">${Utils.esc(Utils.fullName(x.user))}</li>`).join('')}</ul>`:''}
      ${view.pending.length ? `<h4>Pending</h4><ul>${view.pending.map((x)=>`<li>${Utils.esc(Utils.fullName(x.user))}</li>`).join('')}</ul>`:''}
      <div style="margin-top:12px"><canvas id="weight-chart" height="220"></canvas></div>
      </div>` : ''}
      ${selectedWeek === round.weeksCount && isFinalComplete ? `<div class="card"><strong>Final winners</strong><ol>${view.ranked.slice(0, prizeRanks.length).map((r, i)=>`<li>${Utils.esc(Utils.fullName(r.user))} — ${Utils.money(round.prizeSplits[i] || 0, this.state.appSettings.currency)}</li>`).join('')}</ol></div>` : ''}
      ${round.status === 'active' && this.isAdmin() ? `<div class="row"><button class="btn secondary" data-go="edit">Edit Round</button><button class="btn danger" data-go="delete">Delete Round</button></div>` : ''}
    </div>`;
  },

  renderRoundList() {
    const active = Domain.activeRound(this.state.rounds);
    return `<div class="card"><div class="row between"><h2 style="margin:0">Challenge Rounds</h2>${(!active && this.isAdmin()) ? '<button class="btn" data-go="create">Start New Round</button>' : ''}</div>
      <div class="list" style="margin-top:10px">${this.state.rounds.length ? this.state.rounds.map((r) => {
        const subs = Domain.submissionsByRound(this.state.submissions, r.id);
        const progress = Domain.calcCurrentWeek(r, this.state.users, subs);
        const prize = Utils.money(Domain.prizeTotal(r), this.state.appSettings.currency);
        return `<button class="list-item ${r.status === 'active' ? 'active' : ''}" data-open-round="${r.id}">
          <div class="row between"><strong>${Utils.esc(r.title)}</strong>${r.status === 'active' ? '<span class="pill ok">ACTIVE</span>' : ''}</div>
          <div class="small muted">${r.participantIds.length} participants • Week ${progress}/${r.weeksCount}</div>
          <div class="small muted">${Utils.date(r.startDate)} → ${Utils.date(new Date(new Date(r.startDate).getTime() + ((r.weeksCount - 1) * 7 * 86400000)).toISOString())}</div>
          <div class="small">Prize pool: ${prize}</div>
        </button>`;
      }).join('') : '<p class="muted">No rounds found.</p>'}</div></div>`;
  },

  createDefaults() {
    const lastRound = [...this.state.rounds].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))[0];
    const allNames = [...new Set(this.state.users.filter((u) => !u.invitedAt || !!u.inviteAcceptedAt).map((u)=>Utils.fullName(u)))];
    return {
      title: Domain.suggestTitle(lastRound),
      weeksCount: lastRound?.weeksCount || 10,
      holidaysAllowed: lastRound?.holidaysAllowed || 2,
      entryFee: lastRound?.entryFee || 10,
      startDate: new Date().toISOString().slice(0,10),
      weighDay: String(lastRound?.weighDay ?? 1),
      selectedNames: lastRound ? Domain.roundUsers(lastRound, this.state.users).map((u)=>Utils.fullName(u)) : allNames,
      allNames,
      newName: '',
      payoutMode: lastRound?.payoutMode || 'preset3',
      customMemory: (lastRound?.prizeSplits || [30,20,10]).map(String),
      presetCurrent: (lastRound?.prizeSplits || [30,20,10]).map(String)
    };
  },

  renderCreate() {
    if (!this.isAdmin()) return this.renderDenied();
    const active = Domain.activeRound(this.state.rounds);
    if (active) {
      return `<div class="card"><p class="error">A challenge is already active.</p><button class="btn secondary" data-go="rounds">Go to round list</button></div>`;
    }
    if (!this.state.createDraft) this.state.createDraft = this.createDefaults();
    const d = this.state.createDraft;
    const count = d.selectedNames.length;
    const totalPrize = Utils.round2(Utils.safeNum(d.entryFee) * count);
    const rows = (d.payoutMode === 'custom' ? d.customMemory : d.presetCurrent);
    const sum = Utils.round2(rows.reduce((a,b)=>a+Utils.safeNum(b),0));
    const over = sum > totalPrize;

    return `<div class="card"><h2 style="margin-top:0">Create Challenge Round</h2>
      <form id="create-form" class="grid two">
        <div><label>Round title</label><input name="title" type="text" value="${Utils.escAttr(d.title)}" required /></div>
        <div><label>Number of weeks</label><input type="number" min="1" max="52" name="weeksCount" value="${d.weeksCount}" required /></div>
        <div><label>Number of holidays</label><input type="number" min="0" max="12" name="holidaysAllowed" value="${d.holidaysAllowed}" required /></div>
        <div><label>Entry fee (${this.state.appSettings.currency})</label><input type="number" step="0.01" min="0" name="entryFee" value="${d.entryFee}" required /></div>
        <div><label>Start date</label><input type="date" name="startDate" value="${d.startDate}" required /></div>
        <div><label>Weigh day</label><select name="weighDay">${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((x,i)=>`<option value="${i}" ${String(i)===String(d.weighDay)?'selected':''}>${x}</option>`).join('')}</select></div>

        <div class="card" style="grid-column:1/-1"><div class="row between"><strong>Users (${count})</strong><div class="row"><button type="button" data-user-toggle="all" class="btn secondary small">Toggle all</button></div></div>
          <div class="grid three" style="margin-top:8px">${d.allNames.map((n)=>`<label class="row"><input type="checkbox" data-user-name="${Utils.escAttr(n)}" data-label="${Utils.escAttr(n)}" ${d.selectedNames.includes(n)?'checked':''} style="width:auto"/> ${Utils.esc(n)}</label>`).join('') || '<p class="muted">No users yet.</p>'}</div>
          <div style="margin-top:8px">
            <label for="new-user-name">Add user full name</label>
            <div class="row"><input id="new-user-name" type="text" autocomplete="name" placeholder="Add new user full name" value="${Utils.escAttr(d.newName || '')}"/><button type="button" class="btn" data-add-user="1">Add</button></div>
          </div>
        </div>

        <div class="card" style="grid-column:1/-1">
          <div class="row between"><strong>Prize payout calculator</strong><span class="tag">Pool ${Utils.money(totalPrize, this.state.appSettings.currency)}</span></div>
          <label>Mode</label><select name="payoutMode" id="payout-mode">
            <option value="preset3" ${d.payoutMode==='preset3'?'selected':''}>Pay top 3</option>
            <option value="preset5" ${d.payoutMode==='preset5'?'selected':''}>Pay top 5</option>
            <option value="preset7" ${d.payoutMode==='preset7'?'selected':''}>Pay top 7</option>
            <option value="custom" ${d.payoutMode==='custom'?'selected':''}>Custom</option>
          </select>
          <div id="payout-rows" class="grid three" style="margin-top:8px">
          ${rows.map((v,i)=>`<div><label>Rank ${i+1}</label><div class="row"><button type="button" class="btn secondary" data-pay-adjust="-1" data-pay-index="${i}">-</button><input type="number" step="0.01" data-pay-index="${i}" value="${Utils.safeNum(v)}"/><button type="button" class="btn secondary" data-pay-adjust="1" data-pay-index="${i}">+</button></div></div>`).join('')}
          </div>
          <p class="small ${over ? 'error' : 'muted'}">Entered total: ${Utils.money(sum, this.state.appSettings.currency)} ${over ? '(cannot exceed pool)' : ''}</p>
        </div>

        <div style="grid-column:1/-1" class="row">
          <button class="btn" type="submit">Create Round</button>
          <button class="btn secondary" type="button" data-go="rounds">Cancel</button>
        </div>
      </form></div>`;
  },

  renderEdit() {
    if (!this.isAdmin()) return this.renderDenied();
    const round = this.currentRound();
    if (!round) return `<div class="card"><p class="muted">No round selected.</p></div>`;
    const totalPrize = Utils.round2(round.entryFee * round.participantIds.length);
    const sum = Utils.round2((round.prizeSplits || []).reduce((a,b)=>a+Utils.safeNum(b),0));
    return `<div class="card"><h2 style="margin-top:0">Edit Challenge Round</h2>
      <form id="edit-form" class="grid two">
        <div><label>Title</label><input name="title" type="text" required value="${Utils.escAttr(round.title)}" /></div>
        <div><label>Prize total</label><input disabled value="${Utils.money(totalPrize, this.state.appSettings.currency)}" /></div>
        <div class="card" style="grid-column:1/-1"><strong>Prize splits</strong>
          <div class="grid three" style="margin-top:8px">${(round.prizeSplits || []).map((v,i)=>`<div><label>Rank ${i+1}</label><input type="number" step="0.01" min="0" name="split-${i}" value="${Utils.safeNum(v)}"/></div>`).join('')}</div>
          <p class="small ${sum > totalPrize ? 'error' : 'muted'}">Entered: ${Utils.money(sum, this.state.appSettings.currency)}</p>
        </div>
        <div class="row" style="grid-column:1/-1"><button class="btn" type="submit">Save</button><button type="button" class="btn secondary" data-go="overview">Cancel</button></div>
      </form></div>`;
  },

  renderCreateParticipant() {
    if (!this.isAdmin()) return this.renderDenied();
    return `<div class="card" style="max-width:640px;margin:0 auto">
      <div class="row between" style="margin-bottom:12px">
        <h2 style="margin:0">Create participant</h2>
        <button class="btn secondary" type="button" data-go="users">Back to users</button>
      </div>
      <p class="muted">Create a participant with only a name so an admin can submit challenge weights for them.</p>
      <form id="create-participant-form" class="grid">
        <div><label>Participant name</label><input name="fullName" type="text" required autocomplete="name" placeholder="e.g. Jane Smith" /></div>
        <div class="small muted">Participants cannot log in until you promote or invite them later.</div>
        <div class="row"><button class="btn" type="submit">Create participant</button><button class="btn secondary" type="button" data-go="users">Cancel</button></div>
      </form>
    </div>`;
  },

  renderDelete() {
    if (!this.isAdmin()) return this.renderDenied();
    const round = this.currentRound();
    if (!round) return `<div class="card"><p class="muted">No round selected.</p></div>`;
    return `<div class="card"><h2>Delete Challenge Round</h2><p class="error">This cannot be undone.</p>
      <form id="delete-form">
        <div>
          <label for="confirm-delete">Confirm delete</label>
          <label class="row"><input type="checkbox" id="confirm-delete" data-label="Confirm delete" required style="width:auto"/> I confirm delete <strong>${Utils.esc(round.title)}</strong></label>
        </div>
        <div class="row" style="margin-top:10px"><button class="btn danger" type="submit">Delete round</button><button type="button" class="btn secondary" data-go="overview">Cancel</button></div>
      </form></div>`;
  },

  renderFinishWeek() {
    if (!this.isAdmin()) return this.renderDenied();
    const round = Domain.activeRound(this.state.rounds);
    if (!round) return `<div class="card"><p class="error">No active challenge round.</p><button class="btn secondary" data-go="overview">Back</button></div>`;
    const subs = Domain.submissionsByRound(this.state.submissions, round.id);
    const week = Domain.calcCurrentWeek(round, this.state.users, subs);
    const statusPanel = SubmissionStatusPanel.render(round, this.state.users, subs, week, { hideFinishWeekButton: true });
    return `<div class="card"><h2 style="margin-top:0">Finish Week ${week}</h2>
      ${statusPanel}
      <p class="muted">Once you generate results, the weigh-ins for week ${week} will be finalised. After finalising, the submit screen will advance to week ${week + 1} so participants can enter their next weigh-in.</p>
      <form id="finish-week-form">
        <label class="row" style="margin-bottom:12px"><input type="checkbox" id="finish-week-confirm" data-label="Confirm finalise week" required style="width:auto"/> I confirm I want to finalise week ${week} results</label>
        <div class="row"><button class="btn" type="submit">Generate Results</button><button type="button" class="btn secondary" data-go="overview">Cancel</button></div>
      </form>
    </div>`;
  },

  renderSubmit() {
    const round = Domain.activeRound(this.state.rounds);
    if (!round) return `<div class="card"><p class="error">Weekly submissions are only available when a challenge is active.</p></div>`;
    const subs = Domain.submissionsByRound(this.state.submissions, round.id);
    const week = Domain.calcCurrentWeek(round, this.state.users, subs);
    const unit = this.state.appSettings.weightFormat || 'lb';

    const statusPanel = this.isAdmin()
      ? SubmissionStatusPanel.render(round, this.state.users, subs, week, { hideSubmitButton: true })
      : '';

    // Normal (non-admin) user view
    if (!this.isAdmin()) {
      const userId = this.state.currentUser.id;

      // Forfeit check
      if (Domain.isForfeit(subs, userId, week)) {
        return `<div class="card"><h2 style="margin-top:0">User Weekly Submission</h2>
          <p class="small muted">Active round: ${Utils.esc(round.title)} • Week ${week}</p>
          <p class="error">You have forfeited this challenge round. You can no longer submit weights.</p>
        </div>`;
      }

      // Already submitted this week
      const existing = Domain.submissionFor(subs, week, userId);
      if (existing) {
        let submittedMsg = '';
        if (existing.type === 'weight') {
          submittedMsg = `<p>Your submitted weight for week ${week}: <strong>${existing.weight}${unit}</strong></p>`;
        } else if (existing.type === 'holiday') {
          submittedMsg = `<p>You are on holiday this week (week ${week}).</p>`;
        } else {
          submittedMsg = `<p>Submission recorded for week ${week}: <strong>${Utils.esc(existing.type)}</strong></p>`;
        }
        const canEdit = !Domain.isWeekFinished(round, week);
        return `<div class="card"><h2 style="margin-top:0">User Weekly Submission</h2>
          <p class="small muted">Active round: ${Utils.esc(round.title)} • Week ${week}</p>
          ${submittedMsg}
          ${canEdit ? `<p class="small muted">The week has not been finalised yet. You may edit your submission.</p>
          <button class="btn secondary" data-edit-submission="${Utils.escAttr(existing.id)}">Edit Submission</button>` : `<p class="small muted">This week has been finalised and can no longer be edited.</p>`}
        </div>`;
      }
    }

    // Admin all-submitted check
    if (this.isAdmin()) {
      const allDone = Domain.isWeekComplete(round, this.state.users, subs, week);
      if (allDone) {
        return `<div class="card"><h2 style="margin-top:0">User Weekly Submission</h2>
          <p class="small muted">Active round: ${Utils.esc(round.title)} • Week ${week}</p>
          ${statusPanel}
          <p class="muted">All submissions for week ${week} have been completed.</p>
          <button class="btn" data-go="finish-week">Finish Week</button>
        </div>`;
      }
    }

    let users = Domain.roundUsers(round, this.state.users)
      .filter((u) => (!u.invitedAt || !!u.inviteAcceptedAt))
      .filter((u) => !Domain.isForfeit(subs, u.id, week));
    users = users.filter((u) => !Domain.submissionFor(subs, week, u.id));

    if (!this.isAdmin()) users = users.filter((u) => u.id === this.state.currentUser.id);

    return `<div class="card"><h2 style="margin-top:0">User Weekly Submission</h2>
      <p class="small muted">Active round: ${Utils.esc(round.title)} • Week ${week}</p>
      ${statusPanel}
      <form id="submit-form" class="grid two">
        <div><label>User</label><select name="userId" ${!this.isAdmin() ? 'disabled' : ''} required>
          ${users.length ? users.map((u)=>`<option value="${u.id}" ${u.id === this.state.currentUser.id ? 'selected' : ''}>${Utils.esc(Utils.fullName(u))}</option>`).join('') : '<option value="">No user available</option>'}
        </select>
        ${!this.isAdmin() ? `<input type="hidden" name="userId" value="${Utils.escAttr(this.state.currentUser.id)}" />` : ''}
        </div>
        <div><label>Action</label><select name="action" required><option value="weight">Upload weight</option><option value="holiday">Holiday</option><option value="forfeit">Forfeit</option></select></div>
        <div id="weight-fields" style="grid-column:1/-1" class="grid two">
          <div><label>Scale photo</label><input name="photo" type="file" accept="image/*" /></div>
          <div><label>Weight (${this.state.appSettings.weightFormat})</label><input name="weight" type="number" step="0.01" min="1" inputmode="decimal" /></div>
        </div>
        <div id="holiday-note" class="small muted" style="grid-column:1/-1"></div>
        <div id="forfeit-confirm-wrap" class="hidden" style="grid-column:1/-1">
          <label for="forfeit-confirm">Confirm forfeit</label>
          <label class="row"><input type="checkbox" id="forfeit-confirm" data-label="Confirm forfeit" style="width:auto"/> Confirm user forfeit</label>
        </div>
        <div style="grid-column:1/-1" class="row"><button class="btn" type="submit">Submit</button></div>
      </form></div>`;
  },

  userStats(user) {
    const rounds = this.state.rounds;
    const submissions = this.state.submissions.filter((s) => s.userId === user.id);
    const roundsParticipated = new Set(submissions.map((s) => s.roundId));
    rounds.forEach((r) => {
      if ((r.participantIds || []).includes(user.id)) roundsParticipated.add(r.id);
    });

    let totalCashWon = 0;
    let totalWeightDelta = 0;

    rounds.filter((r) => r.status === 'completed').forEach((r) => {
      const subs = Domain.submissionsByRound(this.state.submissions, r.id);
      const final = Domain.weekView(r, this.state.users, subs, r.weeksCount).ranked;
      const idx = final.findIndex((x) => x.user.id === user.id);
      if (idx >= 0) totalCashWon += Utils.safeNum(r.prizeSplits?.[idx], 0);

      const first = Domain.firstWeight(subs, user.id);
      const latest = Domain.latestWeight(subs, user.id, r.weeksCount);
      if (first && latest) totalWeightDelta += Utils.round2(first.weight - latest.weight);
    });

    const activeRound = Domain.activeRound(rounds);
    const inCurrentRound = !!(activeRound && activeRound.participantIds.includes(user.id));

    return { roundsParticipated: roundsParticipated.size, totalCashWon: Utils.round2(totalCashWon), totalWeightDelta: Utils.round2(totalWeightDelta), inCurrentRound };
  },

  renderUsers() {
    if (!this.isAdmin()) return this.renderDenied();
    const f = this.state.userFilters || {};
    const users = this.state.users.map((u) => {
      const stats = this.userStats(u);
      return {
        kind: 'user',
        id: u.id,
        user: u,
        role: this.roleLabel(u),
        invited: !!u.invitedAt && !u.inviteAcceptedAt,
        confirmed: !u.invitedAt || !!u.inviteAcceptedAt,
        inCurrentRound: stats.inCurrentRound,
        roundsParticipated: stats.roundsParticipated,
        totalCashWon: stats.totalCashWon,
        totalWeightDelta: stats.totalWeightDelta,
        joinedAt: u.inviteAcceptedAt || u.createdAt || null,
        accessedAt: u.lastLoginAt || null
      };
    });
    const pendingInviteRows = this.isFirebaseMode()
      ? this.state.invites.filter((i) => !i.usedAt).map((inv) => ({
        kind: 'invite',
        id: `invite:${inv.id}`,
        inviteId: inv.id,
        invite: inv,
        role: inv.inviteType === 'admin' ? 'Admin Invite' : 'Invite',
        invited: true,
        confirmed: false,
        inCurrentRound: false,
        roundsParticipated: 0,
        totalCashWon: 0,
        totalWeightDelta: 0,
        joinedAt: null,
        accessedAt: null
      }))
      : [];
    const merged = [...users, ...pendingInviteRows];

    const shown = merged.filter((row) => {
      const type = row.kind === 'invite' ? 'invite' : (row.user.userType || (row.user.isMaster ? 'master' : (row.user.isAdmin ? 'admin' : 'user')));
      if (f.type && f.type !== 'all' && type !== f.type) return false;
      if (f.status === 'invited' && !row.invited) return false;
      if (f.status === 'confirmed' && !row.confirmed) return false;
      if (f.currentChallengeOnly && !row.inCurrentRound) return false;
      if (f.search) {
        const t = f.search.toLowerCase();
        const text = row.kind === 'invite'
          ? `${row.invite.code} ${row.role}`
          : `${Utils.fullName(row.user)} ${row.user.username} ${row.role}`;
        if (!text.toLowerCase().includes(t)) return false;
      }
      if (!this.isFirebaseMode() && row.kind === 'invite') return false;
      return true;
    });

    const sortKey = f.sort || 'a-z';
    shown.sort((a, b) => {
      const dir = sortKey.endsWith('-desc') ? -1 : 1;
      const byText = (x, y) => String(x || '').localeCompare(String(y || ''), undefined, { sensitivity: 'base' }) * dir;
      if (sortKey.startsWith('a-z')) return byText(a.kind === 'invite' ? a.invite.code : Utils.fullName(a.user), b.kind === 'invite' ? b.invite.code : Utils.fullName(b.user));
      if (sortKey.startsWith('type')) return byText(a.role, b.role);
      if (sortKey.startsWith('joined')) return (new Date(a.joinedAt || a.invite?.createdAt || 0).getTime() - new Date(b.joinedAt || b.invite?.createdAt || 0).getTime()) * dir;
      if (sortKey.startsWith('last')) return (new Date(a.accessedAt || 0).getTime() - new Date(b.accessedAt || 0).getTime()) * dir;
      if (sortKey.startsWith('weight')) return (a.totalWeightDelta - b.totalWeightDelta) * dir;
      if (sortKey.startsWith('money')) return (a.totalCashWon - b.totalCashWon) * dir;
      return 0;
    });

    const rows = shown.map((row) => {
      if (row.kind === 'invite') {
        return `<tr>
          <td></td>
          <td>Invite<div class="small muted"><code>${Utils.esc(row.invite.code)}</code></div></td>
          <td>${row.role}</td>
          <td>—</td>
          ${this.isFirebaseMode() ? '<td>—</td>' : ''}
          <td>0</td>
          <td>${Utils.money(0, this.state.appSettings.currency)}</td>
          <td>0${this.state.appSettings.weightFormat}</td>
          <td>No</td>
          <td><div class="row"><select data-user-action-select="${Utils.escAttr(row.id)}"><option value="">Actions…</option><option value="view-invite">View invite</option><option value="delete-invite">Delete invite</option></select><button class="btn secondary small" data-user-action-apply="${Utils.escAttr(row.id)}">Apply</button></div></td>
        </tr>`;
      }
      const u = row.user;
      const activeSessions = this.isFirebaseMode() ? this.activeSessionsForUser(u.id).length : 0;
      return `<tr>
        <td><input type="checkbox" data-bulk-user="${u.id}" ${this.state.selectedUsers.includes(u.id) ? 'checked' : ''} ${u.isMaster ? 'disabled' : ''}/></td>
        <td>${Utils.esc(Utils.fullName(u))}<div class="small muted">${Utils.esc(this.userLoginLabel(u))}${row.invited ? ' • invited' : ''}</div></td>
        <td>${row.role}</td>
        <td>${Utils.timeAgo(u.lastLoginAt)}</td>
        ${this.isFirebaseMode() ? `<td>${activeSessions}</td>` : ''}
        <td>${row.roundsParticipated}</td>
        <td>${Utils.money(row.totalCashWon, this.state.appSettings.currency)}</td>
        <td>${row.totalWeightDelta}${this.state.appSettings.weightFormat}</td>
        <td>${row.inCurrentRound ? 'Yes' : 'No'}</td>
        <td><button class="btn secondary small" type="button" data-manage-user="${u.id}">Open</button></td>
      </tr>`;
    }).join('');

    return `<div class="card"><div class="row between"><h2 style="margin:0">Users</h2><div class="row"><button class="btn" type="button" data-go="create_participant">Create participant</button>${this.isFirebaseMode() ? '<button class="btn" id="btn-create-invite">Create invite</button>' : ''}<button class="btn danger" data-bulk-delete="1">Delete selected</button></div></div>
      <div class="grid three" style="margin-top:8px">
        <div><label>Type</label><select id="users-filter-type"><option value="all" ${f.type==='all'?'selected':''}>All</option><option value="master" ${f.type==='master'?'selected':''}>Master</option><option value="admin" ${f.type==='admin'?'selected':''}>Admin</option><option value="user" ${f.type==='user'?'selected':''}>User</option><option value="participant" ${f.type==='participant'?'selected':''}>Participant</option>${this.isFirebaseMode() ? `<option value="invite" ${f.type==='invite'?'selected':''}>Invite</option>` : ''}</select></div>
        <div><label>Status</label><select id="users-filter-status"><option value="all" ${f.status==='all'?'selected':''}>All</option><option value="confirmed" ${f.status==='confirmed'?'selected':''}>Confirmed</option><option value="invited" ${f.status==='invited'?'selected':''}>Invited</option></select></div>
        <div><label>Sort</label><select id="users-filter-sort"><option value="a-z" ${f.sort==='a-z'?'selected':''}>A-Z</option><option value="a-z-desc" ${f.sort==='a-z-desc'?'selected':''}>Z-A</option><option value="type-a-z" ${f.sort==='type-a-z'?'selected':''}>Type, A-Z</option><option value="type-a-z-desc" ${f.sort==='type-a-z-desc'?'selected':''}>Type, Z-A</option><option value="joined-a-z" ${f.sort==='joined-a-z'?'selected':''}>Joined/Invited, Oldest-Newest</option><option value="joined-a-z-desc" ${f.sort==='joined-a-z-desc'?'selected':''}>Joined/Invited, Newest-Oldest</option><option value="last-a-z" ${f.sort==='last-a-z'?'selected':''}>Last accessed, Oldest-Newest</option><option value="last-a-z-desc" ${f.sort==='last-a-z-desc'?'selected':''}>Last accessed, Newest-Oldest</option><option value="weight-a-z" ${f.sort==='weight-a-z'?'selected':''}>Total weight lost, Low-High</option><option value="weight-a-z-desc" ${f.sort==='weight-a-z-desc'?'selected':''}>Total weight lost, High-Low</option><option value="money-a-z" ${f.sort==='money-a-z'?'selected':''}>Total money won, Low-High</option><option value="money-a-z-desc" ${f.sort==='money-a-z-desc'?'selected':''}>Total money won, High-Low</option></select></div>
        <div><label>Search</label><input id="users-filter-search" value="${Utils.escAttr(f.search || '')}" placeholder="Search users…" /></div>
        <div><label class="row"><input type="checkbox" id="users-filter-current" style="width:auto" ${f.currentChallengeOnly ? 'checked' : ''}/> Only users in current challenge</label></div>
      </div>
      <div style="overflow:auto;margin-top:8px">
        <table class="table"><thead><tr><th></th><th>User</th><th>Type</th><th>Last logged in</th>${this.isFirebaseMode() ? '<th>Active sessions</th>' : ''}<th>Rounds participated</th><th>Total cash won</th><th>Total weight lost/gained</th><th>In current round</th><th>Actions</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="${this.isFirebaseMode() ? 10 : 9}" class="muted">No users found.</td></tr>`}</tbody></table>
      </div>
    </div>`;
  },

  renderUserAdmin() {
    if (!this.isAdmin()) return this.renderDenied();
    const user = this.selectedUser();
    if (!user) {
      return `<div class="card" style="max-width:640px;margin:0 auto">
        <h2 style="margin-top:0">User not found</h2>
        <p class="muted">The selected user no longer exists.</p>
        <button class="btn secondary" type="button" data-go="users">Back to users</button>
      </div>`;
    }
    const stats = this.userStats(user);
    const typeOptions = this.managedUserTypeOptions(user);
    const pendingInvites = this.isFirebaseMode() ? this.state.invites.filter((invite) => !invite.usedAt && invite.userId === user.id) : [];
    const typeLocked = typeOptions.length === 1;
    const canDelete = !user.isMaster && user.id !== this.state.currentUser?.id;
    return `<div class="card" style="max-width:760px;margin:0 auto">
      <div class="row between" style="margin-bottom:12px">
        <div>
          <h2 style="margin:0">${Utils.esc(Utils.fullName(user))}</h2>
          <div class="small muted">${Utils.esc(this.roleLabel(user))} • ${Utils.esc(this.userLoginLabel(user))}</div>
        </div>
        <button class="btn secondary" type="button" data-go="users">Back to users</button>
      </div>

      <div class="grid two" style="margin-bottom:12px">
        <div class="card">
          <strong>Rounds participated</strong>
          <div>${stats.roundsParticipated}</div>
        </div>
        <div class="card">
          <strong>Current challenge</strong>
          <div>${stats.inCurrentRound ? 'In current round' : 'Not in current round'}</div>
        </div>
        <div class="card">
          <strong>Total cash won</strong>
          <div>${Utils.money(stats.totalCashWon, this.state.appSettings.currency)}</div>
        </div>
        <div class="card">
          <strong>Total weight lost/gained</strong>
          <div>${stats.totalWeightDelta}${this.state.appSettings.weightFormat}</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:12px">
        <h3 style="margin-top:0">User details</h3>
        <form id="edit-user-form" class="grid two">
          <div><label>First name</label><input name="firstName" type="text" required autocomplete="given-name" value="${Utils.escAttr(user.firstName || '')}" /></div>
          <div><label>Last name</label><input name="lastName" type="text" autocomplete="family-name" value="${Utils.escAttr(user.lastName || '')}" /></div>
          <div style="grid-column:1/-1"><label>Email / login</label><input name="username" type="text" disabled value="${Utils.escAttr(user.username || '')}" placeholder="No login email" /></div>
          <div style="grid-column:1/-1" class="row"><button class="btn" type="submit">Save user</button></div>
        </form>
      </div>

      <div class="card" style="margin-bottom:12px">
        <h3 style="margin-top:0">User type</h3>
        <form id="user-type-form" class="grid two">
          <div><label>Type</label><select name="userType" ${typeLocked ? 'disabled' : ''}>${typeOptions.map((option) => `<option value="${option.value}" ${option.value === (user.userType || 'user') ? 'selected' : ''}>${option.label}</option>`).join('')}</select>${typeLocked ? `<input type="hidden" name="userType" value="${Utils.escAttr(user.userType || 'participant')}" />` : ''}</div>
          <div class="small muted" style="align-self:end">${user.isMaster ? 'Master type is locked.' : typeLocked ? 'This participant cannot be promoted from this page.' : 'Changing to participant removes login access.'}</div>
          <div style="grid-column:1/-1" class="row"><button class="btn secondary" type="submit" ${typeLocked ? 'disabled' : ''}>Save type</button></div>
        </form>
      </div>

      <div class="card">
        <h3 style="margin-top:0">Actions</h3>
        <div class="row" style="flex-wrap:wrap">
          ${((!this.isFirebaseMode() && user.canLogin !== false) || (this.isFirebaseMode() && !!user.firebaseUid)) ? '<button class="btn secondary" type="button" id="btn-reset-user-password">Reset password</button>' : ''}
          ${(this.isFirebaseMode() && user.userType === 'participant' && !user.firebaseUid) ? '<button class="btn secondary" type="button" data-user-invite="user">Invite as user</button><button class="btn secondary" type="button" data-user-invite="admin">Invite as admin</button>' : ''}
          ${pendingInvites.map((invite) => `<button class="btn secondary" type="button" data-view-invite="${Utils.escAttr(invite.id)}">View ${Utils.esc(invite.inviteType || 'user')} invite</button>`).join('')}
          ${canDelete ? '<button class="btn danger" type="button" id="btn-delete-user">Delete user</button>' : ''}
        </div>
      </div>
    </div>`;
  },

  renderSettings() {
    const tab = this.state.settingsTab || 'user';
    return `<div class="card"><h2 style="margin-top:0">Settings</h2>
      <div class="tabs">
        <button data-settings-tab="user" class="${tab === 'user' ? 'active' : ''}">User settings</button>
        ${this.isAdmin() ? `<button data-settings-tab="server" class="${tab === 'server' ? 'active' : ''}">Server settings</button>` : ''}
        ${(this.isMaster() && this.isFirebaseMode()) ? `<button data-settings-tab="sync" class="${tab === 'sync' ? 'active' : ''}">Storage &amp; Sync</button>` : ''}
      </div>

      ${tab === 'user' ? this.renderUserSettingsTab() : tab === 'server' ? this.renderServerSettingsTab() : this.renderSyncSettingsTab()}
    </div>`;
  },

  renderUserSettingsTab() {
    const u = this.state.currentUser;
    return `<form id="user-settings-form" class="grid two">
      <div><label>First name</label><input name="firstName" type="text" required autocomplete="given-name" value="${Utils.escAttr(u.firstName || '')}" /></div>
      <div><label>Last name</label><input name="lastName" type="text" required autocomplete="family-name" value="${Utils.escAttr(u.lastName || '')}" /></div>
      <div style="grid-column:1/-1"><label>Email</label><input disabled type="email" value="${Utils.escAttr(u.username)}" /></div>
      <div style="grid-column:1/-1"><button class="btn" type="submit">Save profile</button></div>
    </form>

    <form id="user-password-form" class="grid two" style="margin-top:12px">
      <div><label>Current password</label><input name="currentPassword" type="password" required autocomplete="current-password" /></div>
      <div></div>
      <div><label>New password</label><input name="newPassword" type="password" required ${Utils.passwordInputAttrs('new-password')} /></div>
      <div><label>Confirm new password</label><input name="confirmPassword" type="password" required ${Utils.passwordInputAttrs('new-password')} /></div>
      <div style="grid-column:1/-1"><button class="btn secondary" type="submit">Change password</button></div>
    </form>`;
  },

  renderServerSettingsTab() {
    if (!this.isAdmin()) return `<p class="error">Access denied.</p>`;
    const s = this.state.appSettings;
    const firebase = RuntimeConfig.firebase || {};
    return `<form id="server-settings-form" class="grid two">
      <div><label>Server name</label><input name="serverName" type="text" required autocomplete="organization" value="${Utils.escAttr(s.serverName)}" /></div>
      <div><label>User session duration (days)</label><input name="sessionDurationDays" type="number" min="1" max="365" required value="${Utils.safeNum(s.sessionDurationDays, 7)}" /></div>
      <div><label>Weight format</label><select name="weightFormat"><option value="lb" ${s.weightFormat==='lb'?'selected':''}>lb</option><option value="kg" ${s.weightFormat==='kg'?'selected':''}>kg</option></select></div>
      <div><label>Currency</label><select name="currency"><option value="£" ${s.currency==='£'?'selected':''}>£</option><option value="$" ${s.currency==='$'?'selected':''}>$</option><option value="€" ${s.currency==='€'?'selected':''}>€</option></select></div>
      <div><label>Theme</label><select name="theme">${ThemeOptions.map((t) => `<option value="${t.key}" ${s.theme===t.key?'selected':''}>${t.label}</option>`).join('')}</select></div>
      <div><label>Server mode</label><input disabled value="${RuntimeConfig.serverMode}" /></div>
      <div style="grid-column:1/-1"><label>Firebase API Key</label><input disabled value="${this.isMaster() ? Utils.escAttr(firebase.apiKey || '') : ''}" placeholder="hidden for non-master users" /></div>
      <div><label>Firebase Auth Domain</label><input disabled value="${this.isMaster() ? Utils.escAttr(firebase.authDomain || '') : ''}" /></div>
      <div><label>Firebase Project ID</label><input disabled value="${this.isMaster() ? Utils.escAttr(firebase.projectId || '') : ''}" /></div>
      <div><label>Firebase Storage Bucket</label><input disabled value="${this.isMaster() ? Utils.escAttr(firebase.storageBucket || '') : ''}" /></div>
      <div><label>Firebase Messaging Sender ID</label><input disabled value="${this.isMaster() ? Utils.escAttr(firebase.messagingSenderId || '') : ''}" /></div>
      <div><label>Firebase App ID</label><input disabled value="${this.isMaster() ? Utils.escAttr(firebase.appId || '') : ''}" /></div>
      <div style="grid-column:1/-1" class="small muted">Runtime mode and Firebase settings are read from config.js and cannot be changed from UI.</div>
      <div class="row" style="align-items:flex-end"><button class="btn" type="submit">Save server settings</button></div>
    </form>

    <div class="card" style="margin-top:12px">
      <h3 style="margin-top:0">Reset server</h3>
      ${this.state.currentUser.isMaster ? `<form id="server-reset-form" class="grid two">
          <div><label>Master password</label><input name="password" type="password" required autocomplete="current-password" /></div>
          <div><label for="server-reset-form-confirm-1">Confirm reset</label><label class="row"><input id="server-reset-form-confirm-1" data-label="Confirm reset" style="width:auto" type="checkbox" name="confirm" required /> Yes, uninstall this server</label></div>
          <div style="grid-column:1/-1"><button class="btn danger" type="submit">Reset server</button></div>
        </form>` : `<p class="error">Only the master admin can reset this server.</p>`}
    </div>`;
  },

  renderSyncSettingsTab() {
    if (!this.isMaster() || !this.isFirebaseMode()) return `<p class="error">Access denied.</p>`;
    const meta = this.state.syncMeta || {};
    const mode = meta.storageMode || 'local';
    const syncStatus = meta.syncStatus || 'idle';
    const lastSync = meta.lastSyncAt ? Utils.dateTime(meta.lastSyncAt) : 'Never';
    const syncError = meta.syncError || null;
    const cfg = RuntimeConfig.firebase || {};
    const networkOnline = navigator.onLine;

    // Sync status badge
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
      ${this.isFirebaseMode() ? `<p class="small muted" style="margin-top:8px">Tracked active Firebase sessions: ${this.state.sessions.length}</p>` : ''}

      <div class="row" style="margin-top:8px">
        ${mode === 'online' ? `<button class="btn secondary" id="btn-sync-retry">↻ Retry sync</button>` : ''}
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
          <button class="btn secondary" type="button" id="btn-firebase-test">Test Connection</button>
        </div>
        <div id="firebase-test-result" style="grid-column:1/-1"></div>
      </form>
    </div>`;
  },

  bindScreenEvents() {
    this._ensureJsOnlyFormHandling();
    this.enhanceButtons();
    document.querySelectorAll('[data-go]').forEach((el) => el.onclick = () => this.navigate(el.dataset.go));

    // Join/register via invite code
    const joinForm = document.getElementById('join-form');
    if (joinForm) {
      this.enhanceFormValidation(joinForm);
      // Auto-uppercase the code field as user types
      const codeInput = joinForm.querySelector('[name="inviteCode"]');
      if (codeInput) codeInput.oninput = () => { codeInput.value = codeInput.value.toUpperCase(); };

      this.bindAsyncFormSubmit(joinForm, async () => {
        if (!this.isFirebaseMode()) return this.fail('Invites are unavailable in offline mode.');
        const code = joinForm.inviteCode.value.trim().toUpperCase();
        const email = joinForm.username.value.trim();
        const password = joinForm.password.value;
        const confirmPassword = joinForm.confirmPassword.value;
        const firstName = joinForm.firstName.value.trim();
        const lastName = joinForm.lastName.value.trim();

        if (!code) return this.fail('Enter your invite code.');
        if (!email || !firstName || !lastName) return this.fail('Complete all required fields.');
        if (!Utils.validEmail(email)) return this.fail('Enter a valid email address.');
        if (!Utils.validPassword(password)) return this.fail('Password must include 8+ chars, a letter, a number and a symbol.');
        if (password !== confirmPassword) return this.fail('Passwords do not match.');

        const invite = this.isFirebaseMode()
          ? await this._getFirebaseInvite(code)
          : await Data.adapter.getInviteByCode(code);
        if (!invite) return this.fail('Invite code not found or invalid.');
        if (invite.usedAt) return this.fail('This invite code has already been used.');

        let existsByEmail;
        if (this.isFirebaseMode()) {
          try {
            const remoteMatches = await FirestoreAdapter.queryRecords('users', 'username', email);
            existsByEmail = remoteMatches.find((u) => !u.deletedAt) || null;
          } catch (e) {
            console.warn('Could not check email uniqueness via Firestore:', e.message);
            return this.fail('Could not verify email availability. Please check your connection and try again.');
          }
        } else {
          existsByEmail = await Data.adapter.getUserByUsername(email);
        }
        if (existsByEmail) return this.fail('An account with this email already exists.');

        // Create the Firebase Auth account first
        if (!FirestoreAdapter.isReady()) {
          await this._loadFirebaseSDK();
          await FirestoreAdapter.init(RuntimeConfig.firebase, 'default');
        }
        let fbUser;
        try {
          fbUser = await FirestoreAdapter.createUserWithEmail(email, password);
        } catch (err) {
          return this.fail(`Account creation failed: ${err.message || err}`);
        }

        const invitedUserId = invite.userId || Utils.id();
        const invitedUser = await Data.adapter.getUserById(invitedUserId);
        const acceptedAt = new Date().toISOString();
        const userPayload = {
          ...(invitedUser || {}),
          id: invitedUserId,
          username: email,
          firstName,
          lastName,
          password: null,
          firebaseUid: fbUser.uid,
          userType: invite.inviteType || 'user',
          isAdmin: invite.inviteType === 'admin',
          isMaster: false,
          inviteCode: code,
          invitedAt: invite.createdAt || new Date().toISOString(),
          inviteAcceptedAt: acceptedAt,
          lastLoginAt: null,
          canLogin: true
        };
        if (invitedUser) {
          const saved = await this._saveWithConflictResolver('User', userPayload, (payload) => Data.adapter.updateUser(payload));
          if (!saved) return this.fail('Could not finish account activation.');
        } else {
          await Data.adapter.createUser(userPayload);
        }
        const user = await Data.adapter.getUserById(invitedUserId);
        if (!user) return this.fail('Could not finish account activation.');

        const localInvite = await Data.adapter.getInviteByCode(code);
        if (!localInvite) await Data.adapter.createInvite(invite);
        await Data.adapter.consumeInvite(code, user.id);
        await this._saveFirebaseInvite({
          ...invite,
          usedAt: acceptedAt,
          usedBy: user.id,
          usedByFirebaseUid: fbUser.uid,
          inviteAcceptedAt: acceptedAt
        });
        await this.loginAs(user);
        await this.refresh();
        this.state.pendingInviteCode = '';
        this.setMessage(`Welcome, ${Utils.fullName(user)}! Your account has been created.`);
        this.navigate('overview', { keepFlash: true, replace: true });
      });
    }

    const btnGoLogin = document.getElementById('btn-go-login');
    if (btnGoLogin) btnGoLogin.onclick = () => {
      this.navigate('login');
    };

    const linkToJoin = document.getElementById('link-to-join');
    if (linkToJoin) linkToJoin.onclick = (e) => {
      e.preventDefault();
      this.navigate('join');
    };

    document.querySelectorAll('[data-manage-user]').forEach((button) => button.onclick = () => {
      this.navigate('user', { userId: button.dataset.manageUser });
    });

    const createParticipantForm = document.getElementById('create-participant-form');
    if (createParticipantForm) {
      this.bindAsyncFormSubmit(createParticipantForm, async () => {
        const fullName = createParticipantForm.fullName.value.trim().replace(/\s+/g, ' ');
        if (!fullName) return this.fail('Enter a participant name.');
        const exists = this.state.users.find((user) => Utils.fullName(user).toLowerCase() === fullName.toLowerCase());
        if (exists) return this.fail('A user with that name already exists.');
        const parsed = Utils.parseName(fullName);
        const participant = await Data.adapter.createUser({
          name: fullName,
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          userType: 'participant',
          isAdmin: false,
          isMaster: false,
          canLogin: false
        });
        await this.refresh();
        this.setMessage('Participant created.');
        this.navigate('user', { userId: participant.id, keepFlash: true });
      });
    }

    // Invite management (admin)
    const btnCreateInvite = document.getElementById('btn-create-invite');
    if (btnCreateInvite) btnCreateInvite.onclick = async () => {
      const code = this._generateInviteCode();
      const invite = { id: code, code, inviteType: 'user', createdAt: new Date().toISOString(), usedAt: null, usedBy: null };
      await Data.adapter.createInvite(invite);
      await this._saveFirebaseInvite(invite);
      await this.refresh();
      this.state.inviteDetail = invite;
      this.navigate('invite-detail');
    };

    const btnCreateNewInvite = document.getElementById('btn-create-new-invite');
    if (btnCreateNewInvite) btnCreateNewInvite.onclick = async () => {
      const code = this._generateInviteCode();
      const invite = { id: code, code, inviteType: 'user', createdAt: new Date().toISOString(), usedAt: null, usedBy: null };
      await Data.adapter.createInvite(invite);
      await this._saveFirebaseInvite(invite);
      await this.refresh();
      this.state.inviteDetail = invite;
      this.render();
    };

    const btnDeleteAllInvites = document.getElementById('btn-delete-all-invites');
    if (btnDeleteAllInvites) btnDeleteAllInvites.onclick = async () => {
      if (!confirm('Delete all pending invites? This cannot be undone.')) return;
      const pending = this.state.invites.filter((i) => !i.usedAt);
      await Promise.all(pending.map(async (inv) => {
        await Data.adapter.deleteInvite(inv.id);
        await this._deleteFirebaseInvite(inv.id);
      }));
      await this.refresh();
      this.setMessage('All pending invites deleted.');
      this.render();
    };

    document.querySelectorAll('[data-view-invite]').forEach((b) => b.onclick = async () => {
      const id = b.dataset.viewInvite;
      const inv = this.state.invites.find((i) => i.id === id);
      if (!inv) return;
      this.state.inviteDetail = inv;
      this.navigate('invite-detail');
    });

    document.querySelectorAll('[data-delete-invite]').forEach((b) => b.onclick = async () => {
      const id = b.dataset.deleteInvite;
      if (!confirm('Delete this invite?')) return;
      await Data.adapter.deleteInvite(id);
      await this._deleteFirebaseInvite(id);
      await this.refresh();
      if (this.state.inviteDetail?.id === id) {
        this.state.inviteDetail = null;
        this.navigate('users', { keepFlash: true, replace: true });
        return;
      }
      this.setMessage('Invite deleted.');
      this.render();
    });

    const btnCopyLink = document.getElementById('btn-copy-invite-link');
    if (btnCopyLink) btnCopyLink.onclick = async () => {
      const input = document.getElementById('invite-link-input');
      if (!input) return;
      try {
        await navigator.clipboard.writeText(input.value);
        this.setButtonLabel(btnCopyLink, 'Copied!');
        setTimeout(() => { this.setButtonLabel(btnCopyLink, 'Copy link'); }, 2000);
      } catch {
        input.select();
        document.execCommand('copy');
        this.setButtonLabel(btnCopyLink, 'Copied!');
        setTimeout(() => { this.setButtonLabel(btnCopyLink, 'Copy link'); }, 2000);
      }
    };

    // Auto-render QR code when invite-detail is shown
    if (this.state.route === 'invite-detail' && this.state.inviteDetail) {
      this._renderInviteQR();
    }

    const installForm = document.getElementById('install-form');
    if (installForm) {
      this.bindAsyncFormSubmit(installForm, async () => {
        const installAllowed = await this.plugin.canInstall();
        if (!installAllowed) return this.fail('Installation is locked. This server has already been configured.');
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

        // Clear and show log panel
        const logEl = document.getElementById('install-log');
        if (logEl) { logEl.innerHTML = ''; logEl.style.display = 'block'; }
        this.installLog('Install started.');
        this.installLog(`Server mode: ${this.isFirebaseMode() ? 'firebase' : 'local'}`);

        if (!username || !firstName || !lastName) return this.fail('Complete all required fields.');
        if (!Utils.validEmail(username)) return this.fail('Enter a valid email address.');
        if (!Utils.validPassword(password)) return this.fail('Password must include 8+ chars, a letter, a number and a symbol.');
        if (password !== confirmPassword) return this.fail('Passwords do not match.');

        this.installLog('Checking for existing user…');
        const exists = await Data.adapter.getUserByUsername(username);
        if (exists) return this.fail('Email already exists.');
        this.installLog('No existing user found.');

        const hash = this.isFirebaseMode() ? null : await Security.createPasswordRecord(password);
        const masterUserId = Utils.id();
        let firebaseProvision = null;
        if (this.isFirebaseMode()) {
          this.installLog('Firebase mode: provisioning master account…');
          try {
            firebaseProvision = await this._provisionFirebaseMaster(username, password, masterUserId);
            this.installLog(`Firebase master account created. UID: ${firebaseProvision?.uid || '(none)'}`, 'ok');
          } catch (err) {
            this.installLog(`Firebase provision error (${err.code || 'unknown'}): ${err.message || err}`, 'error');
            return this.fail(`Firebase install failed: ${err.message || err}`);
          }
          // Sign the master admin into the main tenlb-app Firebase Auth session
          // FirestoreAdapter may not be initialised yet on a fresh install, so
          // ensure it is before calling signInWithEmail.
          this.installLog('Initialising FirestoreAdapter for sign-in…');
          if (!FirestoreAdapter.isReady()) {
            try {
              await FirestoreAdapter.init(RuntimeConfig.firebase, 'default');
              this.installLog('FirestoreAdapter initialised.', 'ok');
            } catch (err) {
              this.installLog(`FirestoreAdapter init error: ${err.message || err}`, 'error');
            }
          } else {
            this.installLog('FirestoreAdapter already ready.');
          }
          this.installLog(`Signing in as ${firebaseProvision?.email || username}…`);
          try {
            const email = firebaseProvision?.email || username;
            await FirestoreAdapter.signInWithEmail(email, password);
            this.installLog('Firebase sign-in successful.', 'ok');
          } catch (err) {
            this.installLog(`Firebase sign-in error (${err.code || 'unknown'}): ${err.message || err}`, 'error');
            return this.fail(`Firebase sign-in after install failed: ${err.message || err}`);
          }
        }
        this.installLog('Creating local master user record…');
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
        this.installLog('Master user record created.', 'ok');

        this.installLog('Saving app settings…');
        this.state.appSettings = {
          ...this.state.appSettings,
          installed: true,
          serverName,
          weightFormat,
          currency,
          theme,
          sessionDurationDays,
          installLockedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await Data.adapter.saveAppSettings(this.state.appSettings);
        this.installLog('App settings saved.', 'ok');

        this.installLog('Loading settings and refreshing…');
        await this.loadSettings();
        await this.refresh();

        this.installLog('Logging in as master user…');
        const user = await Data.adapter.getUserByUsername(username);
        await this.loginAs(user);
        this.installLog('Login successful. Redirecting…', 'ok');
        this.setMessage('Server installed successfully.');
        this.navigate('overview', { keepFlash: true, replace: true });
      });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      this.bindAsyncFormSubmit(loginForm, async () => {
        const username = loginForm.username.value.trim();
        const password = loginForm.password.value;
        const redirect = loginForm.redirect.value || this.state.redirectAfterLogin || 'overview';
        if (!Utils.validEmail(username)) return this.fail('Enter a valid email address.');

        if (this.isFirebaseMode()) {
          if (!FirestoreAdapter.isReady()) {
            await FirestoreAdapter.init(RuntimeConfig.firebase, 'default');
          }
          let fbUser;
          try {
            fbUser = await FirestoreAdapter.signInWithEmail(username, password);
          } catch (err) {
            return this.fail('Invalid email or password.');
          }
          if (!fbUser) return this.fail('Invalid email or password.');
          let user;
          try {
            user = await this._resolveFirebaseUser(fbUser);
          } catch (e) {
            console.warn('Could not resolve user account after Firebase sign-in:', e.message);
            return this.fail('Could not load account. Please check your connection and try again.');
          }
          if (!user) return this.fail('No account found for this Firebase user. Please contact the admin.');
          if (user.userType === 'participant' || user.canLogin === false) return this.fail('This account cannot log in.');
          await this.loginAs(user);
          await this.refresh();
          const route = this.redirectToPostLogin(redirect);
          this.setMessage(`Welcome back, ${Utils.fullName(this.state.currentUser)}.`);
          this.navigate(route, { keepFlash: true, replace: true });
          return;
        }

        // Offline mode: local password check
        const user = await Data.adapter.getUserByUsername(username);
        if (!user) return this.fail('Invalid email or password.');
        if (user.userType === 'participant' || user.canLogin === false) return this.fail('This account cannot log in.');

        const ok = await Security.verifyPassword(password, user.password);
        if (!ok) return this.fail('Invalid email or password.');

        await this.loginAs(user);
        await this.refresh();

        const route = this.redirectToPostLogin(redirect);
        this.setMessage(`Welcome back, ${Utils.fullName(this.state.currentUser)}.`);
        this.navigate(route, { keepFlash: true, replace: true });
      });
    }

    document.querySelectorAll('[data-open-round]').forEach((b) => b.onclick = () => {
      this.state.selectedRoundId = b.dataset.openRound;
      this.navigate('overview');
    });

    document.querySelectorAll('[data-week-nav]').forEach((b) => b.onclick = () => {
      const round = this.currentRound();
      if (!round) return;
      const subs = Domain.submissionsByRound(this.state.submissions, round.id);
      const currentWeek = Domain.calcCurrentWeek(round, this.state.users, subs);
      const curr = this.state.weekCursor[round.id] ?? Math.min(currentWeek, round.weeksCount);
      const next = b.dataset.weekNav === 'prev' ? Math.max(1, curr - 1) : Math.min(currentWeek, curr + 1);
      this.state.weekCursor[round.id] = next;
      this.render();
    });

    const createForm = document.getElementById('create-form');
    if (createForm) {
      createForm.oninput = (e) => {
        const d = this.state.createDraft;
        if (!d) return;
        if (['title','weeksCount','holidaysAllowed','entryFee','startDate','weighDay'].includes(e.target.name)) d[e.target.name] = e.target.value;
        if (e.target.name === 'payoutMode') {
          d.payoutMode = e.target.value;
          const size = d.payoutMode === 'preset3' ? 3 : d.payoutMode === 'preset5' ? 5 : d.payoutMode === 'preset7' ? 7 : d.customMemory.length || 3;
          if (d.payoutMode !== 'custom') {
            const pool = Utils.round2(Utils.safeNum(d.entryFee) * d.selectedNames.length);
            const even = size ? Utils.round2(pool / size) : 0;
            d.presetCurrent = Array.from({ length:size }, (_,i) => i === size - 1 ? String(Utils.round2(pool - (even * (size - 1)))) : String(even));
          }
          this.render();
        }
        if (e.target.dataset.payIndex !== undefined) {
          const idx = Number(e.target.dataset.payIndex);
          const arr = d.payoutMode === 'custom' ? d.customMemory : d.presetCurrent;
          arr[idx] = e.target.value;
        }
      };

      createForm.querySelectorAll('[data-user-name]').forEach((c) => c.onchange = () => {
        const d = this.state.createDraft;
        const name = c.dataset.userName;
        if (c.checked) d.selectedNames = [...new Set([...d.selectedNames, name])];
        else d.selectedNames = d.selectedNames.filter((x)=>x!==name);
        this.render();
      });

      const toggle = createForm.querySelector('[data-user-toggle="all"]');
      if (toggle) toggle.onclick = () => {
        const d = this.state.createDraft;
        d.selectedNames = d.selectedNames.length === d.allNames.length ? [] : [...d.allNames];
        this.render();
      };

      const addUser = createForm.querySelector('[data-add-user="1"]');
      if (addUser) addUser.onclick = () => {
        const d = this.state.createDraft;
        const val = document.getElementById('new-user-name').value.trim();
        if (!val) return;
        if (!d.allNames.includes(val)) d.allNames.push(val);
        if (!d.selectedNames.includes(val)) d.selectedNames.push(val);
        d.newName = '';
        this.render();
      };

      createForm.querySelectorAll('[data-pay-adjust]').forEach((b) => b.onclick = () => {
        const d = this.state.createDraft;
        const i = Number(b.dataset.payIndex);
        const inc = Number(b.dataset.payAdjust);
        const arr = d.payoutMode === 'custom' ? d.customMemory : d.presetCurrent;
        arr[i] = String(Math.max(0, Utils.round2(Utils.safeNum(arr[i]) + inc)));
        this.render();
      });

      this.bindAsyncFormSubmit(createForm, async () => {
        const d = this.state.createDraft;
        const payout = (d.payoutMode === 'custom' ? d.customMemory : d.presetCurrent).map((v)=>Utils.round2(Utils.safeNum(v)));
        const totalPrize = Utils.round2(Utils.safeNum(d.entryFee) * d.selectedNames.length);
        const sum = Utils.round2(payout.reduce((a,b)=>a+b,0));
        if (!d.selectedNames.length) return this.fail('Select at least one participant.');
        if (sum > totalPrize) return this.fail('Prize splits cannot exceed prize pool.');
        if (Domain.activeRound(this.state.rounds)) return this.fail('Only one active round is allowed.');
        await Data.adapter.createRound({
          title: d.title.trim(),
          weeksCount: Utils.safeNum(d.weeksCount),
          holidaysAllowed: Utils.safeNum(d.holidaysAllowed),
          entryFee: Utils.safeNum(d.entryFee),
          startDate: d.startDate,
          weighDay: Utils.safeNum(d.weighDay),
          userNames: d.selectedNames,
          payoutMode: d.payoutMode,
          prizeSplits: payout
        });
        this.state.createDraft = null;
        await this.refresh();
        this.setMessage('Challenge round created.');
        this.navigate('overview', { keepFlash: true });
      });
    }

    const editForm = document.getElementById('edit-form');
    if (editForm) {
      this.bindAsyncFormSubmit(editForm, async () => {
        const round = this.currentRound();
        if (!round) return;
        const title = editForm.title.value.trim();
        const prizeSplits = (round.prizeSplits || []).map((_, i) => Utils.round2(Utils.safeNum(editForm[`split-${i}`].value)));
        const totalPrize = Utils.round2(round.entryFee * round.participantIds.length);
        const sum = Utils.round2(prizeSplits.reduce((a,b)=>a+b,0));
        if (sum > totalPrize) return this.fail('Prize splits cannot exceed total prize pool.');
        const roundUpdate = { ...round, title, prizeSplits };
        const ok = await this._saveWithConflictResolver('Round', roundUpdate, (payload) => Data.adapter.updateRound(payload));
        if (!ok) return;
        await this.refresh();
        this.setMessage('Round updated.');
        this.navigate('overview', { keepFlash: true });
      });
    }

    const del = document.getElementById('delete-form');
    if (del) {
      this.bindAsyncFormSubmit(del, async () => {
        const ok = document.getElementById('confirm-delete').checked;
        if (!ok) return this.fail('Confirm deletion to continue.');
        const round = this.currentRound();
        if (!round) return;
        await Data.adapter.deleteRound(round.id);
        this.state.selectedRoundId = null;
        await this.refresh();
        this.setMessage('Round deleted.');
        this.navigate('rounds', { keepFlash: true });
      });
    }

    const finishWeekForm = document.getElementById('finish-week-form');
    if (finishWeekForm) {
      this.bindAsyncFormSubmit(finishWeekForm, async () => {
        if (!document.getElementById('finish-week-confirm').checked) return this.fail('Please confirm to continue.');
        const round = Domain.activeRound(this.state.rounds);
        if (!round) return this.fail('No active challenge.');
        const subs = Domain.submissionsByRound(this.state.submissions, round.id);
        const week = Domain.calcCurrentWeek(round, this.state.users, subs);
        const completedWeeks = [...(round.completedWeeks || [])];
        if (!completedWeeks.includes(week)) completedWeeks.push(week);
        const roundUpdate = { ...round, completedWeeks };
        const ok = await this._saveWithConflictResolver('Round', roundUpdate, (payload) => Data.adapter.updateRound(payload));
        if (!ok) return;
        await this.refresh();
        this.setMessage(`Week ${week} finalised.`);
        this.navigate('overview', { keepFlash: true });
      });
    }

    const submitForm = document.getElementById('submit-form');
    if (submitForm) {
      const updateSubmitUI = () => {
        const round = Domain.activeRound(this.state.rounds);
        if (!round) return;
        const userId = submitForm.userId.value || this.state.currentUser?.id;
        const action = submitForm.action.value;
        const subs = Domain.submissionsByRound(this.state.submissions, round.id);
        const week = Domain.calcCurrentWeek(round, this.state.users, subs);
        const holidayNote = document.getElementById('holiday-note');
        const weightFields = document.getElementById('weight-fields');
        const forfeitWrap = document.getElementById('forfeit-confirm-wrap');
        const weightInput = submitForm.querySelector('[name="weight"]');
        const forfeitConfirm = document.getElementById('forfeit-confirm');
        weightFields.classList.toggle('hidden', action !== 'weight');
        forfeitWrap.classList.toggle('hidden', action !== 'forfeit');
        if (weightInput) weightInput.required = action === 'weight';
        if (forfeitConfirm) forfeitConfirm.required = action === 'forfeit';
        if (action === 'holiday' && userId) {
          const used = Domain.holidaysUsed(subs, userId, week);
          holidayNote.textContent = `Holidays used: ${used} / ${round.holidaysAllowed}`;
          holidayNote.className = used >= round.holidaysAllowed ? 'small error' : 'small muted';
        } else holidayNote.textContent = '';
      };
      submitForm.onchange = updateSubmitUI;
      updateSubmitUI();

      this.bindAsyncFormSubmit(submitForm, async () => {
        const round = Domain.activeRound(this.state.rounds);
        if (!round) return this.fail('No active challenge.');
        const subs = Domain.submissionsByRound(this.state.submissions, round.id);
        const week = Domain.calcCurrentWeek(round, this.state.users, subs);
        const userId = submitForm.userId.value || this.state.currentUser.id;
        const action = submitForm.action.value;
        if (!userId) return this.fail('Select a user.');
        if (!this.isAdmin() && userId !== this.state.currentUser.id) return this.fail('You can only submit weights for yourself.');
        if (Domain.isForfeit(subs, userId, week)) return this.fail('User has already forfeited.');
        if (Domain.submissionFor(subs, week, userId)) return this.fail('User already submitted this week.');

        let weight = null;
        let photoName = null;
        if (action === 'weight') {
          weight = Utils.round2(Utils.safeNum(submitForm.weight.value));
          if (!weight || weight <= 0) return this.fail('Enter a valid weight.');
          photoName = submitForm.photo.files?.[0]?.name || null;
        }
        if (action === 'holiday') {
          const used = Domain.holidaysUsed(subs, userId, week);
          if (used >= round.holidaysAllowed) return this.fail('No holidays remaining for this user.');
        }
        if (action === 'forfeit') {
          if (!document.getElementById('forfeit-confirm').checked) return this.fail('Confirm forfeit first.');
        }

        const submission = {
          id: Utils.id(), roundId: round.id, weekNumber: week, userId,
          type: action, weight, photoName,
          createdAt: new Date().toISOString()
        };

        const nextSubs = [...subs, submission];
        const snapshotData = Domain.weekView(round, this.state.users, nextSubs, week);
        const snapshot = {
          id: `${round.id}:${week}`,
          roundId: round.id,
          weekNumber: week,
          generatedAt: new Date().toISOString(),
          data: snapshotData
        };

        await Data.adapter.recordSubmissionAndSnapshot(submission, snapshot);
        const finalComplete = Domain.isWeekComplete(round, this.state.users, nextSubs, round.weeksCount);
        if (finalComplete && round.status === 'active') await this._saveWithConflictResolver('Round', { ...round, status: 'completed' }, (payload) => Data.adapter.updateRound(payload));

        await this.refresh();
        this.setMessage('Submission saved.');
        this.render();
      });
    }

    const bulkCheckboxes = document.querySelectorAll('[data-bulk-user]');
    bulkCheckboxes.forEach((x) => x.onchange = () => {
      const id = x.dataset.bulkUser;
      if (x.checked) this.state.selectedUsers = [...new Set([...this.state.selectedUsers, id])];
      else this.state.selectedUsers = this.state.selectedUsers.filter((v) => v !== id);
    });

    const setUserFilter = (key, value) => {
      this.state.userFilters = { ...this.state.userFilters, [key]: value };
      this.render();
    };
    const filterType = document.getElementById('users-filter-type');
    if (filterType) filterType.onchange = () => setUserFilter('type', filterType.value);
    const filterStatus = document.getElementById('users-filter-status');
    if (filterStatus) filterStatus.onchange = () => setUserFilter('status', filterStatus.value);
    const filterSort = document.getElementById('users-filter-sort');
    if (filterSort) filterSort.onchange = () => setUserFilter('sort', filterSort.value);
    const filterSearch = document.getElementById('users-filter-search');
    if (filterSearch) filterSearch.oninput = () => setUserFilter('search', filterSearch.value.trim());
    const filterCurrent = document.getElementById('users-filter-current');
    if (filterCurrent) filterCurrent.onchange = () => setUserFilter('currentChallengeOnly', !!filterCurrent.checked);

    document.querySelectorAll('[data-user-action-apply]').forEach((b) => b.onclick = async () => {
      const id = b.dataset.userActionApply;
      const select = document.querySelector(`[data-user-action-select="${CSS.escape(id)}"]`);
      const action = select?.value || '';
      if (!action) return;
      if (!id.startsWith('invite:')) return;
      const inviteId = id.split(':')[1];
      const inv = this.state.invites.find((x) => x.id === inviteId);
      if (!inv) return;
      if (action === 'view-invite') {
        this.state.inviteDetail = inv;
        this.navigate('invite-detail');
        return;
      }
      if (action === 'delete-invite') {
        if (!confirm('Delete this invite?')) return;
        await Data.adapter.deleteInvite(inv.id);
        await this._deleteFirebaseInvite(inv.id);
        await this.refresh();
        this.setMessage('Invite deleted.');
        return this.render();
      }
    });

    const bulkDelete = document.querySelector('[data-bulk-delete="1"]');
    if (bulkDelete) bulkDelete.onclick = async () => {
      const ids = this.state.selectedUsers.filter((id) => {
        const u = this.state.users.find((x) => x.id === id);
        return u && !u.isMaster && u.id !== this.state.currentUser.id;
      });
      if (!ids.length) return this.fail('Select users to delete.');
      if (!confirm(`Delete ${ids.length} selected user(s)? This cannot be undone.`)) return;
      for (const id of ids) await Data.adapter.deleteUser(id);
      this.state.selectedUsers = [];
      await this.refresh();
      this.setMessage('Selected users deleted.');
      this.render();
    };

    document.querySelectorAll('[data-settings-tab]').forEach((b) => b.onclick = () => {
      this.state.settingsTab = b.dataset.settingsTab;
      this.render();
    });

    const userSettingsForm = document.getElementById('user-settings-form');
    if (userSettingsForm) {
      this.bindAsyncFormSubmit(userSettingsForm, async () => {
        const firstName = userSettingsForm.firstName.value.trim();
        const lastName = userSettingsForm.lastName.value.trim();
        if (!firstName || !lastName) return this.fail('First and last name are required.');
        const ok = await this._saveWithConflictResolver('User', { ...this.state.currentUser, firstName, lastName }, (payload) => Data.adapter.updateUser(payload));
        if (!ok) return;
        await this.refresh();
        this.setMessage('Profile updated.');
        this.render();
      });
    }

    const userPwdForm = document.getElementById('user-password-form');
    if (userPwdForm) {
      this.bindAsyncFormSubmit(userPwdForm, async () => {
        const currentPassword = userPwdForm.currentPassword.value;
        const newPassword = userPwdForm.newPassword.value;
        const confirmPassword = userPwdForm.confirmPassword.value;
        if (!Utils.validPassword(newPassword)) return this.fail('New password must include 8+ chars, letter, number and symbol.');
        if (newPassword !== confirmPassword) return this.fail('Passwords do not match.');

        if (this.isFirebaseMode()) {
          // Firebase mode: re-authenticate then update via Firebase Auth
          const email = this.state.currentUser?.username;
          try {
            await FirestoreAdapter.signInWithEmail(email, currentPassword);
          } catch {
            return this.fail('Current password is incorrect.');
          }
          try {
            await FirestoreAdapter.updatePassword(newPassword);
          } catch (err) {
            return this.fail(`Password update failed: ${err.message || err}`);
          }
          this.setMessage('Password changed.');
          this.render();
          return;
        }

        // Offline mode: local hash verify + update
        const ok = await Security.verifyPassword(currentPassword, this.state.currentUser.password);
        if (!ok) return this.fail('Current password is incorrect.');
        const hash = await Security.createPasswordRecord(newPassword);
        const saved = await this._saveWithConflictResolver('User', { ...this.state.currentUser, password: hash }, (payload) => Data.adapter.updateUser(payload));
        if (!saved) return;
        await this.refresh();
        this.setMessage('Password changed.');
        this.render();
      });
    }

    const serverSettingsForm = document.getElementById('server-settings-form');
    if (serverSettingsForm) {
      this.bindAsyncFormSubmit(serverSettingsForm, async () => {
        this.state.appSettings = {
          ...this.state.appSettings,
          serverName: serverSettingsForm.serverName.value.trim() || '10lb Challenge',
          weightFormat: serverSettingsForm.weightFormat.value,
          currency: serverSettingsForm.currency.value,
          theme: serverSettingsForm.theme.value,
          sessionDurationDays: Math.max(1, Utils.safeNum(serverSettingsForm.sessionDurationDays.value, 7)),
          updatedAt: new Date().toISOString()
        };
        await Data.adapter.saveAppSettings(this.state.appSettings);
        if (!this.isFirebaseMode() && this.state.sessionToken) {
          Utils.setCookie('tenlb_session', this.state.sessionToken, this.state.appSettings.sessionDurationDays);
        }
        this.setMessage('Server settings updated.');
        this.render();
      });
    }

    const editUserForm = document.getElementById('edit-user-form');
    if (editUserForm && this.state.selectedUserId) {
      this.bindAsyncFormSubmit(editUserForm, async () => {
        const user = this.selectedUser();
        if (!user) return this.fail('User not found.');
        const firstName = editUserForm.firstName.value.trim();
        const lastName = editUserForm.lastName.value.trim();
        if (!firstName) return this.fail('First name is required.');
        const ok = await this._saveWithConflictResolver('User', { ...user, firstName, lastName }, (payload) => Data.adapter.updateUser(payload));
        if (!ok) return;
        await this.refresh();
        this.setMessage('User update saved.');
        this.render();
      });
    }

    const userTypeForm = document.getElementById('user-type-form');
    if (userTypeForm && this.state.selectedUserId) {
      this.bindAsyncFormSubmit(userTypeForm, async () => {
        const user = this.selectedUser();
        if (!user) return this.fail('User not found.');
        const nextType = userTypeForm.userType.value;
        const allowed = this.managedUserTypeOptions(user).map((option) => option.value);
        if (!allowed.includes(nextType)) return this.fail('This user type cannot be set from this page.');
        if (user.isMaster || nextType === 'master') return this.fail('Master role cannot be changed.');
        if (user.id === this.state.currentUser.id && nextType !== 'admin') return this.fail('You cannot remove your own admin access.');
        const ok = await this._saveWithConflictResolver('User', {
          ...user,
          userType: nextType,
          isAdmin: nextType === 'admin',
          isMaster: false,
          canLogin: nextType !== 'participant'
        }, (payload) => Data.adapter.updateUser(payload));
        if (!ok) return;
        await this.refresh();
        this.setMessage('User type updated.');
        this.render();
      });
    }

    const resetUserPassword = document.getElementById('btn-reset-user-password');
    if (resetUserPassword) resetUserPassword.onclick = async () => {
      const user = this.selectedUser();
      if (!user) return this.fail('User not found.');
      if (this.isFirebaseMode()) {
        const email = user.username;
        if (!email) return this.fail('No email address on record for this user.');
        try {
          await FirestoreAdapter.sendPasswordResetEmail(email);
          this.setMessage(`Password reset email sent to ${email}.`);
          this.render();
        } catch (err) {
          this.fail(`Failed to send reset email: ${err.message || err}`);
        }
        return;
      }
      const password = prompt(`New password for ${Utils.fullName(user)}:`);
      if (password === null) return;
      if (!Utils.validPassword(password)) return this.fail('Password must include 8+ chars, letter, number and symbol.');
      const confirmPwd = prompt('Confirm new password:');
      if (confirmPwd !== password) return this.fail('Passwords do not match.');
      const hash = await Security.createPasswordRecord(password);
      const ok = await this._saveWithConflictResolver('User', { ...user, password: hash }, (payload) => Data.adapter.updateUser(payload));
      if (!ok) return;
      await this.refresh();
      this.setMessage('Password updated.');
      this.render();
    };

    document.querySelectorAll('[data-user-invite]').forEach((button) => button.onclick = async () => {
      const user = this.selectedUser();
      if (!user) return this.fail('User not found.');
      if (!this.isFirebaseMode()) return this.fail('Invites are unavailable in offline mode.');
      const inviteType = button.dataset.userInvite;
      const existing = this.state.invites.find((invite) => !invite.usedAt && invite.userId === user.id && invite.inviteType === inviteType);
      const code = existing?.code || this._generateInviteCode();
      const invite = {
        id: existing?.id || code,
        code,
        userId: user.id,
        inviteType,
        createdAt: new Date().toISOString(),
        usedAt: null,
        usedBy: null
      };
      await Data.adapter.createInvite(invite);
      await this._saveFirebaseInvite(invite);
      const ok = await this._saveWithConflictResolver('User', {
        ...user,
        userType: inviteType,
        isAdmin: inviteType === 'admin',
        canLogin: true,
        inviteCode: code,
        invitedAt: invite.createdAt,
        inviteAcceptedAt: null
      }, (payload) => Data.adapter.updateUser(payload));
      if (!ok) return;
      await this.refresh();
      this.state.inviteDetail = invite;
      this.navigate('invite-detail', { keepFlash: true });
    });

    const deleteUserButton = document.getElementById('btn-delete-user');
    if (deleteUserButton) deleteUserButton.onclick = async () => {
      const user = this.selectedUser();
      if (!user) return this.fail('User not found.');
      if (user.isMaster) return this.fail('Master admin cannot be deleted.');
      if (user.id === this.state.currentUser.id) return this.fail('You cannot delete your own account.');
      if (!confirm(`Delete ${Utils.fullName(user)}? This cannot be undone.`)) return;
      await Data.adapter.deleteUser(user.id);
      this.state.selectedUsers = this.state.selectedUsers.filter((id) => id !== user.id);
      this.state.selectedUserId = null;
      await this.refresh();
      this.setMessage('User deleted.');
      this.navigate('users', { keepFlash: true, replace: true });
    };

    const resetForm = document.getElementById('server-reset-form');
    if (resetForm) {
      this.bindAsyncFormSubmit(resetForm, async () => {
        if (!this.state.currentUser.isMaster) return this.fail('Only master admin can reset the server.');
        if (!resetForm.confirm.checked) return this.fail('Confirm reset to continue.');

        if (this.isFirebaseMode()) {
          // Firebase mode: re-authenticate via Firebase Auth instead of local hash
          const email = this.state.currentUser?.username;
          try {
            await FirestoreAdapter.signInWithEmail(email, resetForm.password.value);
          } catch {
            return this.fail('Invalid master password.');
          }
        } else {
          const ok = await Security.verifyPassword(resetForm.password.value, this.state.currentUser.password);
          if (!ok) return this.fail('Invalid master password.');
        }

        if (this.isFirebaseMode() && SyncEngine.isRunning()) await SyncEngine.stop();
        if (this.isFirebaseMode() && FirestoreAdapter.isReady()) await FirestoreAdapter.resetChallengeData();
        await Data.adapter.clearAllData();
        if (this.isFirebaseMode() && FirestoreAdapter.isReady()) {
          const authUser = FirestoreAdapter.getAuth()?.currentUser;
          if (authUser) {
            try {
              await authUser.delete();
            } catch (e) {
              console.warn('Could not delete current Firebase auth user during reset:', e.message);
              await FirestoreAdapter.signOut();
            }
          } else {
            await FirestoreAdapter.signOut();
          }
        }
        Utils.clearCookie('tenlb_session');
        this.state.currentUser = null;
        this.state.sessionToken = null;
        this.state.pendingInviteCode = '';
        this.state.redirectAfterLogin = 'overview';
        this.state.inviteDetail = null;
        this.state.selectedUserId = null;
        this.state.selectedUsers = [];
        this.setMessage('Server reset complete.');
        history.replaceState(null, '', window.location.pathname);
        this._applyRouteFromHash();
        this.render();
      });
    }

    const syncRetry = document.getElementById('btn-sync-retry');
    if (syncRetry) {
      syncRetry.onclick = async () => {
        syncRetry.disabled = true;
        await SyncEngine.retryNow();
        await this.loadSyncMeta();
        this.render();
      };
    }

    const firebaseTestBtn = document.getElementById('btn-firebase-test');
    if (firebaseTestBtn) {
      firebaseTestBtn.onclick = async () => {
        const cfg = RuntimeConfig.firebase;
        const resultEl = document.getElementById('firebase-test-result');
        if (!cfg?.apiKey || !cfg?.authDomain || !cfg?.projectId) { if (resultEl) resultEl.innerHTML = '<span class="error">Incomplete firebase config in config.js.</span>'; return; }
        firebaseTestBtn.disabled = true;
        this.setButtonLabel(firebaseTestBtn, 'Testing…');
        if (resultEl) resultEl.innerHTML = '';
        const result = await this.testFirebaseConnection(cfg);
        firebaseTestBtn.disabled = false;
        this.setButtonLabel(firebaseTestBtn, 'Test Connection');
        if (resultEl) {
          resultEl.innerHTML = result.ok
            ? '<span class="ok">✓ Connection successful</span>'
            : `<span class="error">✗ ${Utils.esc(result.error)}</span>`;
        }
      };
    }

    this._attachWeightChart();
  },

  _attachWeightChart() {
    const canvas = document.getElementById('weight-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    const round = this.currentRound();
    if (!round) return;
    const subs = Domain.submissionsByRound(this.state.submissions, round.id);
    const currentWeek = Domain.calcCurrentWeek(round, this.state.users, subs);
    const selectedWeek = this.state.weekCursor[round.id] || Math.min(currentWeek, round.weeksCount);
    if (selectedWeek < 2) return;

    const participants = Domain.roundUsers(round, this.state.users);
    const unit = this.state.appSettings.weightFormat || 'lb';
    const colors = ['#0f766e','#4338ca','#be123c','#d97706','#047857','#7c3aed','#db2777','#0369a1','#65a30d','#dc2626'];
    const labels = [];
    for (let w = 1; w <= selectedWeek; w++) labels.push(`Wk ${w}`);

    const datasets = [];
    participants.forEach((u, idx) => {
      const startSub = Domain.firstWeight(subs, u.id);
      if (!startSub) return; // no start weight, skip
      const startWeight = Utils.safeNum(startSub.weight);
      if (!startWeight) return;
      const data = [];
      for (let w = 1; w <= selectedWeek; w++) {
        if (Domain.isForfeit(subs, u.id, w)) { data.push(null); continue; }
        const sub = Domain.submissionFor(subs, w, u.id);
        if (!sub || sub.type === 'holiday') { data.push(null); continue; }
        if (sub.type !== 'weight') { data.push(null); continue; }
        const loss = Utils.round2(startWeight - Utils.safeNum(sub.weight));
        data.push(loss);
      }
      if (data.every((d) => d === null)) return;
      datasets.push({
        label: Utils.fullName(u),
        data,
        borderColor: colors[idx % colors.length],
        backgroundColor: colors[idx % colors.length] + '22',
        tension: 0.3,
        spanGaps: false,
        pointRadius: 4
      });
    });

    if (!datasets.length) return;

    // Destroy any previous chart instance (stored on App to survive canvas replacement)
    if (this._weightChartInstance) { this._weightChartInstance.destroy(); this._weightChartInstance = null; }
    this._weightChartInstance = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          title: { display: true, text: `Weight loss journey (${unit})` }
        },
        scales: {
          y: {
            title: { display: true, text: `Total loss (${unit})` },
            ticks: { callback: (v) => `${v}${unit}` }
          },
          x: { title: { display: true, text: 'Week' } }
        }
      }
    });
  },

  _generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // unambiguous chars (no 0/O, 1/I)
    // Use rejection sampling to eliminate modulo bias.
    const limit = 256 - (256 % chars.length);
    let code = '';
    while (code.length < 8) {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      for (const b of bytes) {
        if (b < limit) code += chars[b % chars.length];
        if (code.length === 8) break;
      }
    }
    return code;
  },

  async _renderInviteQR() {
    const container = document.getElementById('qr-code-container');
    const status = document.getElementById('qr-status');
    if (!container || !this.state.inviteDetail) return;
    const inviteLink = this.routeLink('join', { inviteCode: this.state.inviteDetail.code });
    try {
      if (!window.QRCode) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
          s.onload = res;
          s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      container.innerHTML = '';
      new window.QRCode(container, { text: inviteLink, width: 200, height: 200, correctLevel: window.QRCode.CorrectLevel.M });
      if (status) status.textContent = 'Scan to open invite link';
    } catch {
      container.innerHTML = '<span class="muted small">QR code unavailable (no internet connection)</span>';
      if (status) status.textContent = '';
    }
  },

  async _saveWithConflictResolver(kind, attempted, saveFn) {
    try {
      await saveFn(attempted);
      return true;
    } catch (err) {
      if (err?.code !== 'conflict' || !err.latest) throw err;
      const latest = err.latest;
      const before = JSON.stringify(latest, null, 2);
      const incoming = JSON.stringify(attempted, null, 2);
      const ok = confirm(`${kind} was updated by another session.\n\nCurrent version:\n${before}\n\nYour changes:\n${incoming}\n\nPress OK to overwrite with your version, or Cancel to stop.`);
      if (!ok) {
        this.fail(`${kind} update cancelled due to conflict.`);
        return false;
      }
      await saveFn({ ...attempted, version: latest.version || 1 });
      return true;
    }
  },

  fail(msg) { this.setMessage('', msg); this.renderSnackbar(); },

  installLog(msg, type = 'info') {
    const el = document.getElementById('install-log');
    if (!el) return;
    el.style.display = 'block';
    const ts = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 23);
    const color = type === 'error' ? '#f87171' : type === 'ok' ? '#4ade80' : type === 'warn' ? '#facc15' : '#94a3b8';
    el.innerHTML += `<span style="color:${color}">[${ts}] ${Utils.esc(msg)}</span>\n`;
    el.scrollTop = el.scrollHeight;
  }
};
