import { loadRuntimeConfig, RuntimeConfig } from '../../../config.js';
import { MenuConfig, MenuState, NavigationItems, ROUTES, SyncStatus, SyncStatusIcon, ThemeAlias } from '../../../constants.js';
import { Utils } from '../../../shared/utils/utils.js';
import { Device } from '../../../shared/classes/device.js';
import { Data } from '../../storage/models/data.js';
import { Domain } from '../../../domain.js';
import { OfflinePlugin } from '../../authentication/classes/offlinePlugin.js';
import { FirebasePlugin } from '../../authentication/classes/firebasePlugin.js';
import { AuthService } from '../../authentication/classes/authService.js';
import { MenuBar } from '../components/menuBar.js';
import { Snackbar } from '../components/snackbar.js';
import { SiteHeader } from '../components/siteHeader.js';
import { WeightChart } from '../../../shared/components/weightChart.js';
// App pages
import { renderDeniedPage } from '../pages/deniedPage.js';
import { renderInstallPage, bindInstallEvents } from '../pages/installPage.js';
import { renderLoginPage, bindLoginEvents } from '../pages/loginPage.js';
import { renderJoinPage, bindJoinEvents } from '../pages/joinPage.js';
// Feature pages — challenges
import { renderRoundListPage, bindRoundListEvents } from '../../challenges/pages/roundListPage.js';
import { renderCreateRoundPage, bindCreateRoundEvents } from '../../challenges/pages/createRoundPage.js';
import { renderEditRoundPage, bindEditRoundEvents } from '../../challenges/pages/editRoundPage.js';
import { renderDeleteRoundPage, bindDeleteRoundEvents } from '../../challenges/pages/deleteRoundPage.js';
import { renderFinishWeekPage, bindFinishWeekEvents } from '../../challenges/pages/finishWeekPage.js';
// Feature pages — submission
import { renderOverviewPage, bindOverviewEvents } from '../../submission/pages/overviewPage.js';
import { renderSubmitPage, bindSubmitEvents } from '../../submission/pages/submitPage.js';
// Feature pages — users
import { renderUsersPage, bindUsersPageEvents } from '../../users/pages/usersPage.js';
import { renderUserAdminPage, bindUserAdminEvents } from '../../users/pages/userAdminPage.js';
import { renderCreateParticipantPage, bindCreateParticipantEvents } from '../../users/pages/createParticipantPage.js';
// Feature pages — invites
import { InvitesService } from '../../invites/classes/invitesService.js';
import { renderInvitesPage, bindInvitesPageEvents } from '../../invites/pages/invitesPage.js';
import { renderInviteDetailPage, bindInviteDetailEvents } from '../../invites/pages/inviteDetailPage.js';
// Feature pages — settings
import { renderSettingsPage, bindSettingsEvents } from '../../settings/pages/settingsPage.js';
// App utils
import {
  fieldLabel as appFieldLabel,
  fieldErrorSlot as appFieldErrorSlot,
  fieldValidationMessage as appFieldValidationMessage,
  setFieldValidation as appSetFieldValidation,
  clearFormValidation as appClearFormValidation,
  enhanceFormValidation as appEnhanceFormValidation,
  validateForm as appValidateForm,
  applyFormCustomValidity as appApplyFormCustomValidity,
  prepareFormFields as appPrepareFormFields,
  enhanceButtons as appEnhanceButtons,
  buttonLabelText as appButtonLabelText,
  setButtonLabel as appSetButtonLabel,
  setButtonBusy as appSetButtonBusy
} from '../utils/utils.js';

// =============================================================================
// APP CONTROLLER — Thin orchestrator
// Owns state, plugin, React refs, and lifecycle (init/render/refresh/navigate).
// All page rendering and business logic delegated to feature modules.
// =============================================================================
export const App = {
  plugin: null,
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
    syncMeta: null,
    inviteDetail: null,
    pendingInviteCode: '',
    userFilters: {
      type: 'all',
      status: 'all',
      currentChallengeOnly: false,
      sort: 'a-z',
      search: ''
    }
  },

  // ---------------------------------------------------------------------------
  // Auth helpers
  // ---------------------------------------------------------------------------
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
    return this.state.sessions.filter((s) => s?.userId === userId);
  },
  selectedUser() {
    return this.state.users.find((u) => u.id === this.state.selectedUserId) || null;
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

  // ---------------------------------------------------------------------------
  // Routing
  // ---------------------------------------------------------------------------
  _sanitizeRoute(route) {
    const value = String(route || '').replace(/^\/+/, '').trim();
    const normalized = value || 'overview';
    const allowed = new Set(ROUTES);
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
  _defaultRoute() { return this.plugin ? this.plugin.defaultRoute() : 'login'; },
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
  canAccess(route) {
    if (this.plugin) return this.plugin.canAccess(route);
    route = route || 'overview';
    if (!this.isInstalled()) return route === 'install';
    if (!this.isAuthenticated()) return route === 'login' || (route === 'join' && this.isFirebaseMode());
    if (['overview', 'rounds', 'submit', 'settings'].includes(route)) return true;
    return this.isAdmin();
  },
  routeLink(route, options = {}) {
    return `${window.location.origin}${window.location.pathname}${this._buildHashRoute(route, options)}`;
  },
  redirectToPostLogin(route) {
    const target = route && route !== 'login' ? route : (this.state.redirectAfterLogin || 'overview');
    return this._guardRoute(target);
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

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------
  currentRound() {
    if (this.state.selectedRoundId) {
      const exact = this.state.rounds.find((r) => r.id === this.state.selectedRoundId);
      if (exact) return exact;
    }
    return Domain.activeRound(this.state.rounds) || this.state.rounds[0] || null;
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

  async loadSyncMeta() {
    this.state.syncMeta = await Data.adapter.getDeviceMeta();
  },

  async loadSettings() {
    this.state.appSettings = await Data.adapter.getAppSettings();
    document.getElementById('server-title').textContent = this.state.appSettings.serverName || '10lb Challenge';
  },

  async _loadVisibleInvites() {
    return InvitesService.listVisibleInvites(this.isFirebaseMode(), this.isAdmin(), this.state.currentUser);
  },

  async _loadVisibleSessions() {
    return AuthService.loadVisibleSessions(this.isFirebaseMode(), this.state.currentUser, this.isAdmin());
  },

  // ---------------------------------------------------------------------------
  // Session / Auth lifecycle
  // ---------------------------------------------------------------------------
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

  async restoreSessionFromCookie() {
    if (this.plugin) return this.plugin.restoreSession();
    // Legacy fallback (plugin not yet initialised)
    if (this.isFirebaseMode()) {
      try {
        await AuthService.initializeFirebase(RuntimeConfig.firebase, 'default');
      } catch (e) {
        console.warn('Firebase SDK init failed during session restore:', e.message);
        return;
      }
      const fbUser = await AuthService.getCurrentFirebaseUser();
      if (!fbUser || fbUser.isAnonymous) return;
      const user = await AuthService.resolveFirebaseUser(fbUser);
      if (!user) return;
      this.state.currentUser = user;
      await AuthService.upsertFirebaseSession(user, this.state.appSettings, this.firebaseSessionId(user));
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

  // ---------------------------------------------------------------------------
  // Online mode
  // ---------------------------------------------------------------------------
  async _initOnlineMode(firebaseConfig) {
    if (!this.isFirebaseMode()) return;
    await AuthService.initializeFirebase(firebaseConfig, 'default');
    Data.mode = 'online';
    const meta = await Data.adapter.getDeviceMeta();
    await Data.adapter.saveDeviceMeta({ ...meta, storageMode: 'online' });
    if (this.state.currentUser) await AuthService.ensureFirebaseAuthenticatedState(this.state.currentUser, this.state.appSettings, this.firebaseSessionId(this.state.currentUser));
    await this.loadSyncMeta();
    await this.refresh();
    this.render();
  },

  async enableOnlineMode(firebaseConfig) {
    if (!this.isFirebaseMode()) return this.fail('Server mode is offline in config.js. Set serverMode to "firebase" to enable online mode.');
    await this._initOnlineMode(firebaseConfig || RuntimeConfig.firebase);
    this.setMessage('Online Mode enabled. Synchronising…');
  },

  async disableOnlineMode() {
    return this.fail('Mode is controlled by deployed config.js and cannot be changed from UI.');
  },

  // ---------------------------------------------------------------------------
  // PWA
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // React setup
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // App lifecycle
  // ---------------------------------------------------------------------------
  async init() {
    await loadRuntimeConfig();
    await Data.init();
    await this.loadSettings();
    await this.loadSyncMeta();
    this.setupPwa();
    this.setupReact();
    Snackbar.setOnChange(() => Snackbar.render(document.getElementById('snackbar-root')));
    this.plugin = RuntimeConfig.serverMode === 'firebase' ? new FirebasePlugin(this) : new OfflinePlugin(this);
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
    window.addEventListener('hashchange', () => { this._applyRouteFromHash(); this.render(); });
    window.addEventListener('resize', () => {
      if (this.stickyOffsetTimer) clearTimeout(this.stickyOffsetTimer);
      this.stickyOffsetTimer = setTimeout(() => this.updateStickyOffsets(), 80);
    });
    await this.plugin.onInit();
    window.addEventListener('tenlb:remotechange', () => this.refresh().then(() => this.render()));
    window.addEventListener('tenlb:syncstate', () => this.loadSyncMeta().then(() => this.render()));
  },

  // ---------------------------------------------------------------------------
  // Nav / UI helpers
  // ---------------------------------------------------------------------------
  applyTheme() {
    const theme = this.state.appSettings?.theme || 'teal';
    document.body.setAttribute('data-theme', ThemeAlias[theme] || theme);
  },

  updateStickyOffsets() {
    const header = document.querySelector('header');
    document.documentElement.style.setProperty('--header-offset', `${header?.offsetHeight || 0}px`);
  },

  _baseNavModel() {
    return { items: [], authName: '', authRole: '', syncVisible: false, syncText: '' };
  },

  _syncNavVisibility(nav, hasItems) {
    if (!nav) return;
    nav.classList.toggle('has-items', !!hasItems);
  },

  _clearNavTimers(nb) {
    if (!nb) return;
    if (nb.resizeTimer) clearTimeout(nb.resizeTimer);
    if (nb.fadeTimer) clearTimeout(nb.fadeTimer);
    nb.resizeTimer = null;
    nb.fadeTimer = null;
  },

  _setNavState(nb, state) {
    if (!nb?.nav) return;
    nb.state = state;
    nb.nav.dataset.menuState = state;
    const expanded = state === MenuState.EXPANDING || state === MenuState.EXPANDED;
    const isBurgerMode = state !== MenuState.INLINE;
    nb.nav.classList.toggle('needs-burger', isBurgerMode);
    const label = expanded ? 'Collapse' : 'Menu';
    if (nb.burger) {
      nb.burger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      nb.burger.setAttribute('aria-label', expanded ? 'Collapse menu' : 'Expand menu');
      nb.burger.setAttribute('title', expanded ? 'Collapse menu' : 'Expand menu');
      const labelEl = nb.burger.querySelector('.menu-burger-label');
      if (labelEl) labelEl.textContent = label;
    }
  },

  _navCollapsedHeight(nb) {
    if (!nb?.nav || !nb?.header || !nb?.inner) return 0;
    const navStyle = getComputedStyle(nb.nav);
    const innerStyle = getComputedStyle(nb.inner);
    return Math.ceil(
      nb.header.offsetHeight +
      parseFloat(innerStyle.paddingTop || '0') +
      parseFloat(innerStyle.paddingBottom || '0') +
      parseFloat(navStyle.borderTopWidth || '0') +
      parseFloat(navStyle.borderBottomWidth || '0')
    );
  },

  _navItemsWidth(nb) {
    if (!nb?.track) return 0;
    const items = [...nb.track.querySelectorAll('.menu-item')];
    const gap = parseFloat(getComputedStyle(nb.track).columnGap || getComputedStyle(nb.track).gap || '0');
    return items.reduce((sum, item) => sum + item.offsetWidth, 0) + Math.max(0, items.length - 1) * gap;
  },

  _navNeedsBurger(nb) {
    if (!nb?.inner || !nb?.track) return false;
    const availableWidth = nb.inner.clientWidth;
    const fullWidth = this._navItemsWidth(nb);
    return fullWidth > availableWidth + MenuConfig.OVERFLOW_TOLERANCE;
  },

  _queueNavOverflowCheck(nb, delay = 0) {
    if (!nb) return;
    if (nb.resizeTimer) clearTimeout(nb.resizeTimer);
    nb.resizeTimer = setTimeout(() => {
      if (this._navBurger !== nb) return;
      this._checkNavOverflow();
    }, delay);
  },

  _teardownNavBurger() {
    const nb = this._navBurger;
    if (!nb) return;
    if (nb.ro) nb.ro.disconnect();
    if (nb._onTransitionEnd) nb.nav?.removeEventListener('transitionend', nb._onTransitionEnd);
    if (nb.burger && !this.react.enabled) nb.burger.removeEventListener('click', nb.onBurgerClick);
    this._clearNavTimers(nb);
    if (nb.nav) {
      nb.nav.style.height = '';
      delete nb.nav.dataset.menuState;
      nb.nav.classList.remove('needs-burger');
    }
    this._navBurger = null;
  },

  _checkNavOverflow() {
    const nb = this._navBurger;
    if (!nb?.nav || !nb.track) return;
    if (nb.state === MenuState.EXPANDING || nb.state === MenuState.COLLAPSING) {
      this._queueNavOverflowCheck(nb, MenuConfig.HEIGHT_MS + MenuConfig.FADE_MS);
      return;
    }
    const needsBurger = this._navNeedsBurger(nb);
    if (!needsBurger) {
      nb.nav.style.height = '';
      this._setNavState(nb, MenuState.INLINE);
      return;
    }
    if (nb.state === MenuState.INLINE) this._setNavState(nb, MenuState.COLLAPSED);
  },

  _openNavMenu(nb) {
    const nav = nb.nav;
    if (!nav || nb.state === MenuState.EXPANDING || nb.state === MenuState.EXPANDED || !nav.classList.contains('needs-burger')) return;
    if (nb._onTransitionEnd) nav.removeEventListener('transitionend', nb._onTransitionEnd);
    this._clearNavTimers(nb);
    nb.collapsedHeight = this._navCollapsedHeight(nb);
    this._setNavState(nb, MenuState.EXPANDING);
    nav.style.height = nb.collapsedHeight + 'px';
    void nav.offsetHeight;
    nav.style.height = nav.scrollHeight + 'px';
    nb._onTransitionEnd = (event) => {
      if (event?.target !== nav || event?.propertyName !== 'height') return;
      nav.style.height = '';
      nav.removeEventListener('transitionend', nb._onTransitionEnd);
      nb._onTransitionEnd = null;
      this._setNavState(nb, MenuState.EXPANDED);
      this._queueNavOverflowCheck(nb, 0);
    };
    nav.addEventListener('transitionend', nb._onTransitionEnd);
  },

  _closeNavMenu(nb) {
    const nav = nb.nav;
    if (!nav || nb.state === MenuState.COLLAPSING || nb.state === MenuState.COLLAPSED || nb.state === MenuState.INLINE) return;
    if (nb._onTransitionEnd) nav.removeEventListener('transitionend', nb._onTransitionEnd);
    this._clearNavTimers(nb);
    const currentH = nav.offsetHeight;
    const collapsedH = nb.collapsedHeight || this._navCollapsedHeight(nb);
    this._setNavState(nb, MenuState.COLLAPSING);
    nb.fadeTimer = setTimeout(() => {
      if (this._navBurger !== nb) return;
      nav.style.height = currentH + 'px';
      void nav.offsetHeight;
      nav.style.height = collapsedH + 'px';
      nb._onTransitionEnd = (event) => {
        if (event?.target !== nav || event?.propertyName !== 'height') return;
        nav.style.height = '';
        nav.removeEventListener('transitionend', nb._onTransitionEnd);
        nb._onTransitionEnd = null;
        this._setNavState(nb, MenuState.COLLAPSED);
        this._queueNavOverflowCheck(nb, 0);
      };
      nav.addEventListener('transitionend', nb._onTransitionEnd);
    }, MenuConfig.FADE_MS);
  },

  _setupNavBurger() {
    const nav = document.getElementById('nav');
    if (!nav || !nav.classList.contains('has-items')) { this._teardownNavBurger(); return; }
    const inner = nav.querySelector('.nav-inner');
    const header = nav.querySelector('.menu-header');
    const track = nav.querySelector('.menu-track');
    const burger = nav.querySelector('.menu-burger');
    const activeIndicator = nav.querySelector('[data-menu-active]');
    if (!inner || !header || !track || !burger) { this._teardownNavBurger(); return; }
    if (this._navBurger?.nav === nav && this._navBurger?.track === track) { this._queueNavOverflowCheck(this._navBurger, 0); return; }
    this._teardownNavBurger();
    const nb = { nav, inner, header, track, burger, activeIndicator, collapsedHeight: 0, state: MenuState.INLINE, resizeTimer: null, fadeTimer: null };
    nb.onBurgerClick = () => {
      if (nb.state === MenuState.EXPANDED || nb.state === MenuState.EXPANDING) this._closeNavMenu(nb);
      else if (nb.nav.classList.contains('needs-burger')) this._openNavMenu(nb);
    };
    nb.ro = new ResizeObserver(() => {
      const delay = nb.state === MenuState.EXPANDING || nb.state === MenuState.COLLAPSING
        ? MenuConfig.HEIGHT_MS + MenuConfig.FADE_MS
        : 0;
      this._queueNavOverflowCheck(nb, delay);
    });
    nb.ro.observe(nav);
    nb.ro.observe(inner);
    if (!this.react.enabled) burger.addEventListener('click', nb.onBurgerClick);
    this._navBurger = nb;
    this._setNavState(nb, MenuState.INLINE);
    this._queueNavOverflowCheck(nb, 0);
    this._updateNavActive(nb);
  },

  _updateNavActive(nb) {
    if (!nb?.activeIndicator) return;
    const active = nb.track?.querySelector('.menu-item.active');
    if (!active) { nb.activeIndicator.innerHTML = ''; return; }
    const icon = active.querySelector('.material-symbols-rounded')?.textContent?.trim() || '';
    const label = active.querySelector('.menu-item-label')?.textContent || '';
    nb.activeIndicator.innerHTML =
      (icon ? `<span class="material-symbols-rounded" aria-hidden="true">${Utils.esc(icon)}</span>` : '') +
      `<span>${Utils.esc(label)}</span>`;
  },

  _buildSyncStatus(syncMeta) {
    if (!syncMeta) return { syncVisible: false, syncText: '' };
    const mode = syncMeta.storageMode || 'local';
    if (mode !== 'online') return { syncVisible: false, syncText: '' };
    const status = syncMeta.syncStatus || SyncStatus.IDLE;
    const statusText = {
      [SyncStatus.IDLE]: '',
      [SyncStatus.SYNCING]: 'Syncing…',
      [SyncStatus.SYNCED]: `Synced ${syncMeta.lastSyncAt ? Utils.dateTime(syncMeta.lastSyncAt) : ''}`,
      [SyncStatus.PENDING]: 'Changes pending',
      [SyncStatus.ERROR]: 'Sync error'
    };
    return { syncVisible: true, syncText: `${SyncStatusIcon[status] || ''} ONLINE — ${statusText[status] || Utils.esc(status)}` };
  },

  _isSyncing() {
    return this.state.syncMeta?.storageMode === 'online' && this.state.syncMeta?.syncStatus === SyncStatus.SYNCING;
  },

  _syncWarnBanner() {
    if (!this._isSyncing()) return '';
    const routeMessages = {
      overview: 'Round and submission data is being synced. Rankings and weights may be incomplete.',
      rounds: 'Round data is being synced. The round list may not be up to date.',
      submit: 'Submission data is being synced.',
      create: 'Round data is being synced.',
      edit: 'Round data is being synced.',
      delete: 'Round data is being synced.',
      users: 'User data is being synced. The user list may be incomplete.',
      user: 'User data is being synced.',
      create_participant: 'User data is being synced.',
      'invite-detail': 'User and invite data is being synced.',
      settings: 'Settings are being synced.'
    };
    const msg = routeMessages[this.state.route] || 'Data sync is in progress. Some information shown may not be up to date.';
    return `<div class="sync-warn-banner"><span class="material-symbols-rounded" aria-hidden="true">sync</span><span>${Utils.esc(msg)}</span></div>`;
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
    model.items = [...NavigationItems.primary];
    if (this.isAdmin()) model.items.push(...NavigationItems.admin);
    model.items.push(...NavigationItems.secondary);
    model.authName = Utils.fullName(this.state.currentUser);
    model.authRole = this.roleLabel(this.state.currentUser);
    if (!this.react.enabled) {
      nav.innerHTML = MenuBar.render(model.items, this.state.route, (key) => this._buildHashRoute(key));
      MenuBar.attachClickHandler(nav, (route) => this.navigate(route));
      authChip.innerHTML = SiteHeader.renderHTML(model.authName, model.authRole);
      const logoutBtn = document.getElementById('btn-logout');
      if (logoutBtn) logoutBtn.onclick = () => this.logout();
    }
    const syncStatus = this._buildSyncStatus(this.state.syncMeta);
    model.syncVisible = syncStatus.syncVisible;
    model.syncText = syncStatus.syncText;
    if (syncBar && !this.react.enabled) {
      syncBar.style.display = model.syncVisible ? 'block' : 'none';
      syncBar.innerHTML = model.syncVisible ? model.syncText : '';
    }
    this._syncNavVisibility(nav, model.items.length > 0);
    return model;
  },

  renderWithReact(navModel, screen) {
    if (!this.react.enabled) return false;
    const React = window.React;
    const Router = window.ReactRouterDOM;
    if (!Router?.HashRouter || !Router?.Link) return false;
    const { HashRouter } = Router;
    const e = React.createElement;
    const syncBar = document.getElementById('sync-bar');
    if (syncBar) syncBar.style.display = navModel.syncVisible ? 'block' : 'none';
    this._syncNavVisibility(document.getElementById('nav'), navModel.items.length > 0);
    this.react.navRoot.render(e(HashRouter, null,
      MenuBar.renderReact(navModel.items, this.state.route, {
        onNavigate: (key) => this.navigate(key),
        onBurgerClick: () => this._navBurger?.onBurgerClick?.()
      })
    ));
    this.react.authRoot.render(SiteHeader.renderReact(navModel.authName, navModel.authRole, () => this.logout()));
    this.react.syncRoot.render(navModel.syncVisible ? e('span', { dangerouslySetInnerHTML: { __html: navModel.syncText } }) : null);
    this.react.appRoot.render(e('div', { dangerouslySetInnerHTML: { __html: screen } }));
    return true;
  },

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  render() {
    const navModel = this.attachNav();
    this.applyTheme();
    document.getElementById('server-title').textContent = this.state.appSettings?.serverName || '10lb Challenge';
    document.body.classList.toggle('is-syncing', this._isSyncing());
    const appEl = document.getElementById('app');
    const syncBanner = (this.isAuthenticated() && this.isInstalled()) ? this._syncWarnBanner() : '';
    const screen = syncBanner + this.resolveScreen();
    if (!this.renderWithReact(navModel, screen)) appEl.innerHTML = screen;
    this._setupNavBurger();
    this.updateStickyOffsets();
    this.renderSnackbar();
    this.bindScreenEvents();
  },

  resolveScreen() {
    if (this.state.route === 'install') return renderInstallPage(this);
    if (!this.isInstalled()) {
      if (this.state.route === 'denied') return renderDeniedPage();
      return renderJoinPage(this);
    }
    if (!this.isAuthenticated()) {
      if (this.state.route === 'join') return renderJoinPage(this);
      return renderLoginPage(this);
    }
    return this._renderAuthenticatedRoute(this.state.route);
  },

  _renderAuthenticatedRoute(route) {
    const app = this;
    const routeScreens = {
      denied: () => renderDeniedPage(),
      overview: () => renderOverviewPage(app),
      rounds: () => renderRoundListPage(app),
      create: () => renderCreateRoundPage(app),
      create_participant: () => renderCreateParticipantPage(app),
      edit: () => renderEditRoundPage(app),
      delete: () => renderDeleteRoundPage(app),
      submit: () => renderSubmitPage(app),
      users: () => renderUsersPage(app),
      user: () => renderUserAdminPage(app),
      settings: () => renderSettingsPage(app),
      invites: () => renderInvitesPage(app),
      'invite-detail': () => renderInviteDetailPage(app),
      'finish-week': () => renderFinishWeekPage(app)
    };
    const fn = routeScreens[route];
    return fn ? fn() : '';
  },

  _renderDenied() { return renderDeniedPage(); },

  // ---------------------------------------------------------------------------
  // Event binding
  // ---------------------------------------------------------------------------
  bindScreenEvents() {
    this._ensureJsOnlyFormHandling();
    this.enhanceButtons();
    document.querySelectorAll('[data-go]').forEach((el) => el.onclick = () => this.navigate(el.dataset.go));
    document.querySelectorAll('[data-open-round]').forEach((b) => b.onclick = () => {
      this.state.selectedRoundId = b.dataset.openRound;
      this.navigate('overview');
    });

    // Bind per-feature events
    const route = this.state.route;
    if (route === 'install') bindInstallEvents(this);
    else if (route === 'login') bindLoginEvents(this);
    else if (route === 'join') bindJoinEvents(this);
    else if (route === 'overview') bindOverviewEvents(this);
    else if (route === 'rounds') bindRoundListEvents(this);
    else if (route === 'create') bindCreateRoundEvents(this);
    else if (route === 'edit') bindEditRoundEvents(this);
    else if (route === 'delete') bindDeleteRoundEvents(this);
    else if (route === 'finish-week') bindFinishWeekEvents(this);
    else if (route === 'submit') bindSubmitEvents(this);
    else if (route === 'users') bindUsersPageEvents(this);
    else if (route === 'user') bindUserAdminEvents(this);
    else if (route === 'create_participant') bindCreateParticipantEvents(this);
    else if (route === 'invites') bindInvitesPageEvents(this);
    else if (route === 'invite-detail') bindInviteDetailEvents(this);
    else if (route === 'settings') bindSettingsEvents(this);
    this._attachWeightChart();
  },

  _attachWeightChart() {
    const round = this.currentRound();
    if (!round) return;
    const subs = Domain.submissionsByRound(this.state.submissions, round.id);
    const currentWeek = Domain.calcCurrentWeek(round, this.state.users, subs);
    const selectedWeek = this.state.weekCursor[round.id] || Math.min(currentWeek, round.weeksCount);
    const unit = this.state.appSettings.weightFormat || 'lb';
    this._weightChartInstance = WeightChart.attach(round, this.state.users, subs, selectedWeek, unit, this._weightChartInstance);
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

  // ---------------------------------------------------------------------------
  // Form helpers (delegates to app/utils/utils.js)
  // ---------------------------------------------------------------------------
  fieldLabel: (field) => appFieldLabel(field),
  fieldErrorSlot: (field) => appFieldErrorSlot(field),
  fieldValidationMessage: (field) => appFieldValidationMessage(field),
  setFieldValidation: (field, msg) => appSetFieldValidation(field, msg),
  clearFormValidation: (form) => appClearFormValidation(form),
  enhanceFormValidation(form) { appEnhanceFormValidation(form); },
  applyFormCustomValidity(form) { appApplyFormCustomValidity(form, appFieldLabel); },
  prepareFormFields(form) { appPrepareFormFields(form, appFieldErrorSlot); },
  validateForm(form) { return appValidateForm(form, (msg) => this.fail(msg)); },

  bindAsyncFormSubmit(form, handler) {
    if (!form) return;
    this.enhanceFormValidation(form);
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!this.validateForm(form)) return;
      const submitBtn = e.submitter || form.querySelector('button[type="submit"]');
      if (this._isSyncing()) {
        if (submitBtn) {
          const origLabel = this.buttonLabelText(submitBtn);
          const origIcon = submitBtn.dataset.iconDefault || this.iconForButton(submitBtn) || '';
          submitBtn.disabled = true;
          const labelEl = submitBtn.querySelector('.btn-label');
          if (labelEl) labelEl.textContent = 'Syncing…';
          const iconEl = submitBtn.querySelector('.btn-icon');
          if (iconEl) { iconEl.classList.remove('material-symbols-rounded'); iconEl.textContent = ''; iconEl.classList.add('btn-spinner'); }
          await new Promise((resolve) => {
            const onSync = () => { if (!this._isSyncing()) { window.removeEventListener('tenlb:syncstate', onSync); resolve(); } };
            window.addEventListener('tenlb:syncstate', onSync);
          });
          submitBtn.disabled = false;
          if (labelEl) labelEl.textContent = origLabel;
          if (iconEl) { iconEl.classList.remove('btn-spinner'); iconEl.classList.add('material-symbols-rounded'); iconEl.textContent = origIcon; }
        }
      }
      const release = this.setButtonBusy(submitBtn, true);
      try { await handler(e); } catch (err) { console.error(err); this.fail(this.errorMessage(err)); } finally { release(); }
    };
  },

  // ---------------------------------------------------------------------------
  // Button helpers (delegates to app/utils/utils.js)
  // ---------------------------------------------------------------------------
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
      return { overview: 'home', rounds: 'list_alt', create: 'add_circle', create_participant: 'person_add', edit: 'edit', delete: 'delete', submit: 'publish', users: 'groups', user: 'person', settings: 'settings', 'invite-detail': 'qr_code', login: 'login', join: 'person_add' }[button.dataset.go] || 'arrow_forward';
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
    if (button.dataset.settingsTab) return { user: 'person', server: 'settings', sync: 'sync' }[button.dataset.settingsTab] || 'tune';
    const formId = button.form?.id;
    if (button.type === 'submit' && formId) {
      return {
        'install-form': 'install_desktop', 'login-form': 'login', 'join-form': 'person_add', 'create-participant-form': 'person_add',
        'edit-user-form': 'save', 'user-type-form': 'manage_accounts', 'create-form': 'add_circle', 'edit-form': 'save',
        'delete-form': 'delete', 'submit-form': 'publish', 'user-settings-form': 'save', 'user-password-form': 'password',
        'server-settings-form': 'save', 'server-reset-form': 'restart_alt'
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

  enhanceButtons() { appEnhanceButtons((b) => this.iconForButton(b)); },
  buttonLabelText: (button) => appButtonLabelText(button),
  setButtonLabel(button, label) { appSetButtonLabel(button, label, (b) => this.iconForButton(b)); },
  setButtonBusy(button, busy) { return appSetButtonBusy(button, busy, (b) => this.iconForButton(b)); },

  // ---------------------------------------------------------------------------
  // Snackbar / messages
  // ---------------------------------------------------------------------------
  renderSnackbar() { Snackbar.render(document.getElementById('snackbar-root')); },
  setMessage(msg = '', err = '') {
    this.state.message = msg;
    this.state.error = err;
    if (msg) Snackbar.push(msg, 'success');
    if (err) Snackbar.push(err, 'error');
  },
  errorMessage(err) { return err?.message || String(err || 'Something went wrong.'); },
  fail(msg) { this.setMessage('', msg); this.renderSnackbar(); },

  installLog(msg, type = 'info') {
    const el = document.getElementById('install-log');
    if (!el) return;
    el.style.display = 'block';
    const ts = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 23);
    const color = type === 'error' ? '#f87171' : type === 'ok' ? '#4ade80' : type === 'warn' ? '#facc15' : '#94a3b8';
    el.innerHTML += `<span style="color:${color}">[${ts}] ${Utils.esc(msg)}</span>\n`;
    el.scrollTop = el.scrollHeight;
  },

  // ---------------------------------------------------------------------------
  // Conflict resolver (shared utility used by multiple features)
  // ---------------------------------------------------------------------------
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
      if (!ok) { this.fail(`${kind} update cancelled due to conflict.`); return false; }
      await saveFn({ ...attempted, version: latest.version || 1 });
      return true;
    }
  }
};
