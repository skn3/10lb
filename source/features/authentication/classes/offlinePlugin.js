import { ServerPlugin } from './serverPlugin.js';
import { Utils } from '../../../shared/utils/utils.js';
import { Security } from '../../../shared/classes/security.js';
import { Data } from '../../storage/models/data.js';

// ---------------------------------------------------------------------------
// Offline plugin — all data lives in IndexedDB; sessions tracked via cookie.
// The app must be explicitly installed before any other route is reachable.
// ---------------------------------------------------------------------------
export class OfflinePlugin extends ServerPlugin {
  isInstalled() { return !!this._app.state.appSettings?.installed; }

  defaultRoute() {
    if (!this.isInstalled()) return 'install';
    if (!this._app.isAuthenticated()) return 'login';
    return 'overview';
  }

  guardRoute(requested) {
    if (!this.isInstalled()) return requested === 'install' ? 'install' : 'denied';
    if (!this._app.isAuthenticated()) return 'login';
    if (['install', 'login', 'join'].includes(requested)) return 'overview';
    return this.canAccess(requested) ? requested : 'denied';
  }

  canAccess(route) {
    route = route || 'overview';
    if (!this.isInstalled()) return route === 'install';
    if (!this._app.isAuthenticated()) return route === 'login';
    if (['overview', 'rounds', 'submit', 'settings'].includes(route)) return true;
    return this._app.isAdmin();
  }

  async restoreSession() {
    const token = Utils.getCookie('tenlb_session');
    if (!token) return;
    const session = await Data.adapter.getSession(token);
    if (!session) { Utils.clearCookie('tenlb_session'); return; }
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      await Data.adapter.deleteSession(token);
      Utils.clearCookie('tenlb_session');
      this._app.setMessage('', 'Your session expired. Please log in again.');
      return;
    }
    const user = await Data.adapter.getUserById(session.userId);
    if (!user) { await Data.adapter.deleteSession(token); Utils.clearCookie('tenlb_session'); return; }
    this._app.state.currentUser = user;
    this._app.state.sessionToken = token;
    await Data.adapter.touchSession(token, this._app.state.appSettings.sessionDurationDays || 7);
    Utils.setCookie('tenlb_session', token, this._app.state.appSettings.sessionDurationDays || 7);
  }

  async onLogin(user) {
    const token = Security.sessionToken();
    await Data.adapter.createSession(token, user.id, this._app.state.appSettings.sessionDurationDays || 7);
    this._app.state.sessionToken = token;
    Utils.setCookie('tenlb_session', token, this._app.state.appSettings.sessionDurationDays || 7);
  }

  async onLogout() {
    if (this._app.state.sessionToken) await Data.adapter.deleteSession(this._app.state.sessionToken);
    Utils.clearCookie('tenlb_session');
  }

  async canInstall() { return !this.isInstalled(); }
}
