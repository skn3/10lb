// =============================================================================
// FIRESTORE ADAPTER
// Only initialised when storageMode === 'online' with valid Firebase config.
// Uses Firebase 10 compat CDN bundles (window.firebase).
// IMPORTANT: password hashes are NEVER written to Firestore.
// =============================================================================
export const FirestoreAdapter = (() => {
  let _app = null;
  let _db = null;   // firebase.firestore() compat instance
  let _auth = null; // firebase.auth() compat instance
  let _challengeId = 'default';
  let _configuredDb = null;
  let _initPromise = null;

  // Strip sensitive fields before uploading to Firestore
  const sanitiseUser = (u) => {
    const { password, ...safe } = u; // eslint-disable-line no-unused-vars
    return safe;
  };

  // Firestore path: /challenges/{challengeId}/{entityType}/{id}
  const colRef = (entityType) => _db.collection('challenges').doc(_challengeId).collection(entityType);
  const docRef = (entityType, id) => colRef(entityType).doc(id);
  const challengeRef = () => _db.collection('challenges').doc(_challengeId);

  return {
    async init(firebaseConfig, challengeId) {
      if (!window.firebase) throw new Error('Firebase SDK not loaded');
      _challengeId = challengeId || 'default';
      if (_db && _auth) return true;
      if (_initPromise) return _initPromise;

      _initPromise = (async () => {
        // Re-use existing named app if already initialised
        try {
          _app = window.firebase.app('tenlb-app');
        } catch {
          _app = window.firebase.initializeApp(firebaseConfig, 'tenlb-app');
        }
        _db = _app.firestore();
        if (_configuredDb !== _db) {
          _db.settings({
            experimentalAutoDetectLongPolling: true,
            useFetchStreams: false,
            merge: true
          });
          _configuredDb = _db;
        }
        _auth = _app.auth();
        return true;
      })();

      try {
        return await _initPromise;
      } finally {
        _initPromise = null;
      }
    },

    getUid() { return _auth?.currentUser?.uid || null; },
    isReady() { return !!_db; },

    // ---- Auth helpers --------------------------------------------------------
    getAuth() { return _auth; },

    async signInWithEmail(email, password) {
      if (!_auth) throw new Error('Firebase Auth not initialised');
      const cred = await _auth.signInWithEmailAndPassword(email, password);
      return cred?.user || null;
    },

    async createUserWithEmail(email, password) {
      if (!_auth) throw new Error('Firebase Auth not initialised');
      const cred = await _auth.createUserWithEmailAndPassword(email, password);
      return cred?.user || null;
    },

    async signOut() {
      if (_auth) await _auth.signOut();
    },

    // Returns a Promise that resolves with the current Firebase user (or null).
    getCurrentFirebaseUser() {
      return new Promise((resolve) => {
        if (!_auth) return resolve(null);
        let settled = false;
        const unsubscribe = _auth.onAuthStateChanged((user) => {
          if (settled) return;
          settled = true;
          unsubscribe();
          resolve(user || null);
        });
        window.setTimeout(() => {
          if (settled) return;
          settled = true;
          try { unsubscribe(); } catch (_) {}
          resolve(_auth.currentUser || null);
        }, 5000);
      });
    },

    async sendPasswordResetEmail(email) {
      if (!_auth) throw new Error('Firebase Auth not initialised');
      await _auth.sendPasswordResetEmail(email);
    },

    async updatePassword(newPassword) {
      const user = _auth?.currentUser;
      if (!user) throw new Error('No authenticated Firebase user.');
      await user.updatePassword(newPassword);
    },

    async writeRecord(entityType, record) {
      if (!_db) throw new Error('FirestoreAdapter not initialised');
      const payload = entityType === 'users' ? sanitiseUser(record) : record;
      await docRef(entityType, record.id).set(payload, { merge: true });
    },

    async deleteRecord(entityType, id, deletedAt) {
      if (!_db) throw new Error('FirestoreAdapter not initialised');
      await docRef(entityType, id).set({ deletedAt, id }, { merge: true });
    },

    async downloadAll(entityType) {
      if (!_db) throw new Error('FirestoreAdapter not initialised');
      const snap = await colRef(entityType).get();
      return snap.docs.map((d) => d.data());
    },

    async getRecord(entityType, id) {
      if (!_db) throw new Error('FirestoreAdapter not initialised');
      const snap = await docRef(entityType, id).get();
      return snap.exists ? snap.data() : null;
    },

    async queryRecords(entityType, field, value) {
      if (!_db) throw new Error('FirestoreAdapter not initialised');
      const snap = await colRef(entityType).where(field, '==', value).get();
      return snap.docs.map((d) => d.data());
    },

    async removeRecord(entityType, id) {
      if (!_db) throw new Error('FirestoreAdapter not initialised');
      await docRef(entityType, id).delete();
    },

    async resetChallengeData() {
      if (!_db) throw new Error('FirestoreAdapter not initialised');
      const uid = _auth?.currentUser?.uid || null;
      const deleteCollection = async (name) => {
        // Chunk deletes to keep each write batch below Firestore limits.
        while (true) {
          const snap = await colRef(name).limit(200).get();
          if (snap.empty) break;
          const batch = _db.batch();
          snap.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
          if (snap.size < 200) break;
        }
      };
      await deleteCollection('sessions');
      await deleteCollection('invites');
      await deleteCollection('submissions');
      await deleteCollection('rounds');
      await deleteCollection('users');

      // Remove any extra admins first, keep current admin until the very end.
      const adminSnap = await colRef('admins').get();
      const batch = _db.batch();
      adminSnap.docs.forEach((doc) => {
        if (doc.id !== uid) batch.delete(doc.ref);
      });
      await batch.commit();

      await challengeRef().delete();
      if (uid) {
        try {
          await docRef('admins', uid).delete();
        } catch (e) {
          console.warn('Could not delete current admin record during reset:', e.message);
        }
      }
    },

    async getChallengeDoc() {
      if (!_db) throw new Error('FirestoreAdapter not initialised');
      const snap = await _db.collection('challenges').doc(_challengeId).get();
      return snap.exists ? snap.data() : null;
    },

    subscribe(entityType, onData) {
      if (!_db) return () => {};
      return colRef(entityType).onSnapshot(
        (snap) => {
          snap.docChanges().forEach((change) => {
            if (['added', 'modified'].includes(change.type)) onData(change.doc.data());
          });
        },
        (error) => {
          console.warn(`Firestore listener error for ${entityType}:`, error?.message || error);
        }
      );
    }
  };
})();
