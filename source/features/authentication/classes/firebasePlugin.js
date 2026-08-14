import { ServerPlugin } from './serverPlugin.js';
import { AuthController } from './authController.js';
import { RuntimeConfig } from '../../../config.js';
import { FirestoreAdapter } from '../../storage/classes/firestoreAdapter.js';
import { SyncEngine } from '../../storage/classes/syncEngine.js';

// ---------------------------------------------------------------------------
// Firebase plugin — data is backed by Firestore with IndexedDB as a local
// cache; authentication is handled by Firebase Auth.
//
// "Installed" is implied: if firebase is configured, the server exists.
// There is no local IndexedDB flag for installed state; installation is only
// checked when the install form is submitted to prevent a re-install.
//
// Multiple browsers can be open simultaneously — no per-browser installed
// state is stored in IndexedDB.
// ---------------------------------------------------------------------------
export class FirebasePlugin extends ServerPlugin {
  // Firebase mode: installed is always implied by the presence of firebase config.
  isInstalled() { return true; }

  defaultRoute() {
    if (!this._app.isAuthenticated()) return this._app.state.pendingInviteCode ? 'join' : 'login';
    return 'overview';
  }

  guardRoute(requested) {
    if (!this._app.isAuthenticated()) {
      // Allow install and join pages when not yet authenticated.
      if (['install', 'join'].includes(requested)) return requested;
      return 'login';
    }
    // Once authenticated, login/join redirect to overview; install is locked.
    if (['login', 'join', 'install'].includes(requested)) return 'overview';
    return this.canAccess(requested) ? requested : 'denied';
  }

  canAccess(route) {
    route = route || 'overview';
    if (!this._app.isAuthenticated()) return ['login', 'join', 'install'].includes(route);
    if (['overview', 'rounds', 'submit', 'settings'].includes(route)) return true;
    if (route === 'install') return false; // locked once authenticated
    return this._app.isAdmin();
  }

  async restoreSession() {
    if (!FirestoreAdapter.isReady()) {
      try {
        await AuthController.loadFirebaseSDK();
        await FirestoreAdapter.init(RuntimeConfig.firebase, 'default');
      } catch (e) {
        console.warn('Firebase SDK init failed during session restore:', e.message);
        return;
      }
    }
    const fbUser = await FirestoreAdapter.getCurrentFirebaseUser();
    if (!fbUser || fbUser.isAnonymous) return;
    let user;
    try {
      user = await AuthController.resolveFirebaseUser(fbUser.uid);
    } catch (e) {
      console.warn('Could not resolve user account during session restore:', e.message);
      return;
    }
    if (!user) return;
    this._app.state.currentUser = user;
    await AuthController.upsertFirebaseSession(user, this._app.state.appSettings, this._app.firebaseSessionId(user));
  }

  async onLogin(user) {
    this._app.state.sessionToken = null;
    await AuthController.ensureFirebaseAuthenticatedState(user, this._app.state.appSettings, this._app.firebaseSessionId(user));
    if (!SyncEngine.isRunning()) await SyncEngine.start();
    await this._app.loadSyncMeta();
  }

  async onLogout() {
    await AuthController.deleteFirebaseSession(this._app.firebaseSessionId(this._app.state.currentUser));
    if (SyncEngine.isRunning()) await SyncEngine.stop();
    if (FirestoreAdapter.isReady()) await FirestoreAdapter.signOut();
  }

  async canInstall() {
    // Query Firestore to detect an existing install and block re-installation.
    // This is the ONLY place firebase mode checks installed state.
    try {
      if (!FirestoreAdapter.isReady()) {
        await AuthController.loadFirebaseSDK();
        await FirestoreAdapter.init(RuntimeConfig.firebase, 'default');
      }
      const doc = await FirestoreAdapter.getChallengeDoc();
      if (doc?.installedAt) return false; // already installed
    } catch (e) {
      console.warn('canInstall Firestore check failed, allowing install:', e.message);
    }
    return true;
  }

  async onInit() {
    // Start Firestore sync if firebase config is complete.
    if (RuntimeConfig.firebase?.apiKey && RuntimeConfig.firebase?.authDomain && RuntimeConfig.firebase?.projectId) {
      this._app._initOnlineMode(RuntimeConfig.firebase).catch((err) => {
        console.warn('Online Mode could not resume:', err.message);
      });
    } else {
      this._app.setMessage('', 'config.js is set to firebase mode but firebase config is incomplete. Falling back to local mode.');
    }
  }
}
