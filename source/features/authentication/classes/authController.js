import { RuntimeConfig } from '../../../config.js';
import { Data } from '../../storage/models/data.js';
import { FirestoreAdapter } from '../../storage/classes/firestoreAdapter.js';
import { SyncEngine } from '../../storage/classes/syncEngine.js';
import { Device } from '../../../shared/classes/device.js';

// =============================================================================
// AUTH CONTROLLER — Private business logic for authentication.
// Do not call these methods directly from other features; use AuthService.
// =============================================================================
export const AuthController = {
  // ---------------------------------------------------------------------------
  // Firebase SDK lazy loading
  // ---------------------------------------------------------------------------
  async loadFirebaseSDK() {
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

  // ---------------------------------------------------------------------------
  // Resolve a local user by Firebase UID, querying Firestore as authoritative
  // source if the record is absent from the IndexedDB cache.
  // ---------------------------------------------------------------------------
  async resolveFirebaseUser(firebaseUserOrUid) {
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

  // ---------------------------------------------------------------------------
  // Firestore session management
  // ---------------------------------------------------------------------------
  async upsertFirebaseSession(user, appSettings, sessionId) {
    if (!user || !FirestoreAdapter.isReady()) return;
    const uid = FirestoreAdapter.getUid();
    if (!uid) return;
    const now = new Date();
    const session = {
      id: sessionId,
      userId: user.id,
      firebaseUid: uid,
      email: user.username,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      role: user.userType || (user.isMaster ? 'master' : (user.isAdmin ? 'admin' : 'user')),
      clientId: Device.getId(),
      startedAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ((appSettings?.sessionDurationDays || 7) * 86400000)).toISOString()
    };
    await FirestoreAdapter.writeRecord('sessions', session);
  },

  async deleteFirebaseSession(sessionId) {
    if (!sessionId || !FirestoreAdapter.isReady()) return;
    try {
      await FirestoreAdapter.removeRecord('sessions', sessionId);
    } catch (e) {
      console.warn('Could not remove Firebase session:', e.message);
    }
  },

  async registerFirebaseAdmin(user) {
    if (!user || !FirestoreAdapter.isReady() || !(user.isAdmin || user.isMaster)) return;
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

  async ensureFirebaseAuthenticatedState(user, appSettings, sessionId) {
    if (!user || !FirestoreAdapter.isReady()) return;
    await this.registerFirebaseAdmin(user);
    await this.upsertFirebaseSession(user, appSettings, sessionId);
    if (!SyncEngine.isRunning()) await SyncEngine.start();
  },

  // ---------------------------------------------------------------------------
  // Firebase install — provision master account during server setup
  // ---------------------------------------------------------------------------
  async provisionFirebaseMaster(username, password, localUserId, logFn = () => {}) {
    logFn('Loading Firebase SDK…');
    await this.loadFirebaseSDK();
    const installName = 'tenlb-install';
    let app;
    try {
      app = window.firebase.app(installName);
      logFn('Re-using existing tenlb-install Firebase app.');
    } catch {
      app = window.firebase.initializeApp(RuntimeConfig.firebase, installName);
      logFn('Initialised tenlb-install Firebase app.');
    }
    const auth = app.auth();
    const email = String(username).includes('@') ? String(username) : `${username}@tenlb.local`;
    logFn(`Creating Firebase Auth account for ${email}…`);
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid = cred?.user?.uid || null;
    logFn(`Firebase Auth account created. UID: ${uid || '(none)'}`, uid ? 'ok' : 'warn');
    // Force token refresh so the Firestore request carries a valid auth token immediately.
    if (cred?.user) {
      logFn('Refreshing auth token before Firestore writes…');
      await cred.user.getIdToken(true);
      logFn('Auth token ready.', 'ok');
    }
    const db = app.firestore();
    if (uid) {
      logFn('Writing admin record to Firestore (challenges/default/admins)…');
      await db.collection('challenges').doc('default').collection('admins').doc(uid)
        .set({ grantedAt: new Date().toISOString(), localUserId, isAdmin: true, isMaster: true }, { merge: true });
      logFn('Admin record written.', 'ok');
      logFn('Writing challenge root document (challenges/default)…');
      await db.collection('challenges').doc('default').set({
        installedAt: new Date().toISOString(),
        installedBy: localUserId,
        mode: 'firebase'
      }, { merge: true });
      logFn('Challenge document written.', 'ok');
    }
    return { uid, email };
  },

  // ---------------------------------------------------------------------------
  // Firebase connectivity test
  // ---------------------------------------------------------------------------
  async testFirebaseConnection(firebaseConfig) {
    try {
      await this.loadFirebaseSDK();
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

  // ---------------------------------------------------------------------------
  // Invite helpers (Firebase-backed)
  // ---------------------------------------------------------------------------
  async getFirebaseInvite(code) {
    if (!FirestoreAdapter.isReady()) {
      await this.loadFirebaseSDK();
      await FirestoreAdapter.init(RuntimeConfig.firebase, 'default');
    }
    const invite = await FirestoreAdapter.getRecord('invites', code);
    if (!invite || invite.deletedAt) return null;
    return invite;
  },

  async saveFirebaseInvite(invite) {
    if (!FirestoreAdapter.isReady()) {
      await this.loadFirebaseSDK();
      await FirestoreAdapter.init(RuntimeConfig.firebase, 'default');
    }
    await FirestoreAdapter.writeRecord('invites', invite);
  },

  async deleteFirebaseInvite(inviteId) {
    if (!FirestoreAdapter.isReady()) return;
    await FirestoreAdapter.removeRecord('invites', inviteId);
  },

  // ---------------------------------------------------------------------------
  // Visible invites / sessions — for use in App.refresh()
  // ---------------------------------------------------------------------------
  async loadVisibleInvites(isFirebaseMode, currentUser, isAdmin, firestoreAdapter, offlineAdapter) {
    if (!isFirebaseMode) return offlineAdapter.listInvites();
    if (!currentUser || !isAdmin || !firestoreAdapter.isReady()) return [];
    try {
      const invites = await firestoreAdapter.downloadAll('invites');
      return invites
        .filter((inv) => inv && !inv.deletedAt)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } catch (e) {
      console.warn('Could not load invites from Firestore:', e.message);
      return [];
    }
  },

  async loadVisibleSessions(isFirebaseMode, currentUser, isAdmin, firestoreAdapter) {
    if (!isFirebaseMode || !currentUser || !isAdmin || !firestoreAdapter.isReady()) return [];
    try {
      const sessions = await firestoreAdapter.downloadAll('sessions');
      return sessions
        .filter((s) => s && !s.deletedAt)
        .sort((a, b) => new Date(b.lastSeenAt || b.startedAt || 0).getTime() - new Date(a.lastSeenAt || a.startedAt || 0).getTime());
    } catch (e) {
      console.warn('Could not load sessions from Firestore:', e.message);
      return [];
    }
  }
};
