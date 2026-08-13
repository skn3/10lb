import { Config, RuntimeConfig } from '../../../config.js';
import { Device } from '../../../shared/classes/device.js';
import { Utils } from '../../../shared/utils/utils.js';

// =============================================================================
// STORAGE ADAPTER INTERFACE (documentation)
// Both OfflineAdapter and FirestoreAdapter must implement:
//   init()
//   getAppSettings() → settings object
//   saveAppSettings(settings)
//   listRounds() → Round[]
//   getRound(id) → Round|null
//   createRound(roundInput) → Round
//   updateRound(round) → Round
//   deleteRound(id)
//   listUsers() → User[]
//   getUserById(id) → User|null
//   getUserByUsername(username) → User|null
//   createUser(user) → User
//   updateUser(user) → User
//   deleteUser(id)
//   upsertUsersByName(names) → User[]
//   listSubmissions() → Submission[]
//   recordSubmissionAndSnapshot(submission, snapshot)
//   getWeeklySnapshot(roundId, weekNumber) → Snapshot|null
//   createSession(token, userId, durationDays) → Session
//   getSession(token) → Session|null
//   touchSession(token, durationDays) → Session|null
//   deleteSession(token)
//   clearAllData()
// =============================================================================

// =============================================================================
// OFFLINE ADAPTER — IndexedDB implementation (Local Mode source of truth)
// =============================================================================
export const OfflineAdapter = (() => {
  let db;

  // ---------------------------------------------------------------------------
  // Low-level DB helpers
  // ---------------------------------------------------------------------------
  const open = () => new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(Config.DB_NAME, Config.DB_VERSION);

    req.onupgradeneeded = (event) => {
      const x = req.result;
      const oldVersion = event.oldVersion;

      // --- Create stores that didn't exist ---
      if (!x.objectStoreNames.contains('rounds')) x.createObjectStore('rounds', { keyPath: 'id' });
      if (!x.objectStoreNames.contains('users')) x.createObjectStore('users', { keyPath: 'id' });
      if (!x.objectStoreNames.contains('submissions')) {
        const s = x.createObjectStore('submissions', { keyPath: 'id' });
        s.createIndex('roundId', 'roundId', { unique: false });
      }
      if (!x.objectStoreNames.contains('weeklySnapshots')) x.createObjectStore('weeklySnapshots', { keyPath: 'id' });
      if (!x.objectStoreNames.contains('settings')) x.createObjectStore('settings', { keyPath: 'key' });
      if (!x.objectStoreNames.contains('sessions')) {
        const sess = x.createObjectStore('sessions', { keyPath: 'token' });
        sess.createIndex('userId', 'userId', { unique: false });
      }
      // v3: sync queue + device-local sync metadata
      if (!x.objectStoreNames.contains('syncQueue')) {
        const q = x.createObjectStore('syncQueue', { keyPath: 'changeId' });
        q.createIndex('status', 'status', { unique: false });
        q.createIndex('entityType', 'entityType', { unique: false });
      }
      // v4: invite codes for registration
      if (!x.objectStoreNames.contains('invites')) {
        const inv = x.createObjectStore('invites', { keyPath: 'id' });
        inv.createIndex('code', 'code', { unique: true });
      }

      // --- v3 data migration: backfill new metadata fields on existing records ---
      // This runs inside the upgradeneeded transaction so it is safe.
      if (oldVersion > 0 && oldVersion < 3) {
        const clientId = Device.getId();
        const now = new Date().toISOString();

        const migrateStore = (storeName) => {
          const store = req.transaction.objectStore(storeName);
          const cursorReq = store.openCursor();
          cursorReq.onsuccess = (e) => {
            const cursor = e.target.result;
            if (!cursor) return;
            const rec = cursor.value;
            cursor.update({
              ...rec,
              version: rec.version ?? 1,
              createdBy: rec.createdBy ?? rec.userId ?? null,
              updatedBy: rec.updatedBy ?? rec.userId ?? null,
              clientId: rec.clientId ?? clientId,
              deletedAt: rec.deletedAt ?? null
            });
            cursor.continue();
          };
        };

        migrateStore('users');
        migrateStore('rounds');

        // submissions also get updatedAt
        const subsStore = req.transaction.objectStore('submissions');
        const subsCursor = subsStore.openCursor();
        subsCursor.onsuccess = (e) => {
          const cursor = e.target.result;
          if (!cursor) return;
          const rec = cursor.value;
          cursor.update({
            ...rec,
            version: rec.version ?? 1,
            createdBy: rec.createdBy ?? rec.userId ?? null,
            updatedBy: rec.updatedBy ?? rec.userId ?? null,
            clientId: rec.clientId ?? clientId,
            deletedAt: rec.deletedAt ?? null,
            updatedAt: rec.updatedAt ?? rec.createdAt ?? now
          });
          cursor.continue();
        };
      }
    };

    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });

  const run = async (stores, mode, fn) => {
    const conn = await open();
    return new Promise((resolve, reject) => {
      const tx = conn.transaction(stores, mode);
      const obj = Object.fromEntries(stores.map((s) => [s, tx.objectStore(s)]));
      let out;
      tx.oncomplete = () => resolve(out);
      tx.onerror = () => reject(tx.error);
      Promise.resolve(fn(obj, tx)).then((result) => { out = result; }).catch(reject);
    });
  };

  const getAll = (store) => run([store], 'readonly', ({ [store]: s }) => new Promise((res, rej) => {
    const req = s.getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  }));

  const put = (store, value) => run([store], 'readwrite', ({ [store]: s }) => new Promise((res, rej) => {
    const req = s.put(value);
    req.onsuccess = () => res(value);
    req.onerror = () => rej(req.error);
  }));

  const del = (store, key) => run([store], 'readwrite', ({ [store]: s }) => new Promise((res, rej) => {
    const req = s.delete(key);
    req.onsuccess = () => res(true);
    req.onerror = () => rej(req.error);
  }));

  const get = (store, key) => run([store], 'readonly', ({ [store]: s }) => new Promise((res, rej) => {
    const req = s.get(key);
    req.onsuccess = () => res(req.result || null);
    req.onerror = () => rej(req.error);
  }));

  // ---------------------------------------------------------------------------
  // Record normalization helpers
  // ---------------------------------------------------------------------------
  const defaultAppSettings = () => ({
    key: 'app',
    installed: false,
    serverName: '10lb Challenge',
    weightFormat: 'lb',
    currency: '£',
    theme: 'teal',
    sessionDurationDays: 7,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const metaDefaults = (existing = {}) => {
    const clientId = Device.getId();
    return {
      version: 1,
      createdBy: null,
      updatedBy: null,
      clientId,
      deletedAt: null,
      ...existing
    };
  };

  const normalizeUser = (u) => {
    if (!u) return null;
    const parsed = Utils.parseName(u.name || Utils.fullName(u));
    const userType = u.userType || (u.isMaster ? 'master' : (u.isAdmin ? 'admin' : 'user'));
    return {
      ...metaDefaults(u),
      id: u.id || Utils.id(),
      username: u.username || (u.name ? u.name.toLowerCase().replace(/\s+/g, '.') : ''),
      firstName: u.firstName || parsed.firstName,
      lastName: u.lastName || parsed.lastName,
      password: u.password || null,
      userType,
      isAdmin: userType === 'admin' || userType === 'master' || !!u.isAdmin,
      isMaster: userType === 'master' || !!u.isMaster,
      inviteCode: u.inviteCode || null,
      invitedAt: u.invitedAt || null,
      inviteAcceptedAt: u.inviteAcceptedAt || null,
      canLogin: u.canLogin !== undefined ? !!u.canLogin : userType !== 'participant',
      firebaseUid: u.firebaseUid || null,
      createdAt: u.createdAt || new Date().toISOString(),
      updatedAt: u.updatedAt || new Date().toISOString(),
      lastLoginAt: u.lastLoginAt || null
    };
  };

  const normalizeSubmission = (s) => ({
    ...metaDefaults(s),
    ...s,
    updatedAt: s.updatedAt || s.createdAt || new Date().toISOString()
  });

  // ---------------------------------------------------------------------------
  // Sync queue helpers (used by SyncEngine)
  // ---------------------------------------------------------------------------
  const enqueue = (entityType, entityId, operation, payload, userId) => {
    const now = new Date().toISOString();
    const entry = {
      changeId: Utils.id(),
      entityType,
      entityId,
      operation,         // 'CREATE' | 'UPDATE' | 'DELETE'
      payload: Utils.clone(payload),
      timestamp: now,
      clientId: Device.getId(),
      userId: userId || null,
      status: 'pending', // 'pending' | 'uploading' | 'done' | 'error'
      retryCount: 0,
      lastError: null
    };
    return put('syncQueue', entry);
  };

  return {
    // ---- Lifecycle -----------------------------------------------------------
    async init() {
      await open();
      const app = await get('settings', 'app');
      if (!app) await put('settings', defaultAppSettings());
      const users = await getAll('users');
      await Promise.all(users.map(async (u) => {
        const n = normalizeUser(u);
        if (JSON.stringify(n) !== JSON.stringify(u)) await put('users', n);
      }));
      const allUsers = (await getAll('users')).map(normalizeUser).filter((u) => !u.deletedAt);
      const masters = allUsers.filter((u) => u.userType === 'master' || u.isMaster);
      if (masters.length > 1) {
        const keep = masters.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
        await Promise.all(masters.filter((u) => u.id !== keep.id).map((u) => put('users', normalizeUser({ ...u, userType: 'admin', isMaster: false, isAdmin: true }))));
      }
    },

    // ---- App settings --------------------------------------------------------
    getAppSettings: async () => {
      const app = await get('settings', 'app');
      return app || defaultAppSettings();
    },
    saveAppSettings: async (settings) => put('settings', { ...settings, key: 'app', updatedAt: new Date().toISOString() }),

    // ---- Device / sync metadata (local-only, never synced) -------------------
    async getDeviceMeta() {
      const d = await get('settings', 'device');
      if (d) {
        if (Object.prototype.hasOwnProperty.call(d, 'firebaseConfig')) {
          const { firebaseConfig, ...sanitised } = d;
          await put('settings', { ...sanitised, key: 'device' });
          return sanitised;
        }
        return d;
      }
      return {
        key: 'device',
        clientId: Device.getId(),
        storageMode: 'local',  // 'local' | 'online'
        firebaseUidMap: {},    // localUserId → firebaseUid
        syncStatus: 'idle',    // 'idle' | 'syncing' | 'synced' | 'pending' | 'error'
        lastSyncAt: null,
        syncError: null
      };
    },
    saveDeviceMeta: async (meta) => {
      const { firebaseConfig, ...sanitised } = (meta || {});
      return put('settings', { ...sanitised, key: 'device' });
    },

    // Helper used by write methods: enqueue a sync operation when online
    _maybeEnqueue(entityType, entityId, operation, payload, userId) {
      // Import Data lazily to avoid circular dependency at module parse time.
      // Data and SyncEngine are set on the global App after init.
      if (typeof globalThis._tenlbData !== 'undefined' && globalThis._tenlbData.mode === 'online' && typeof globalThis._tenlbSyncEngine !== 'undefined') {
        enqueue(entityType, entityId, operation, payload, userId).catch((e) => console.warn('Enqueue failed:', e));
      }
    },

    // ---- Rounds --------------------------------------------------------------
    listRounds: () => getAll('rounds').then((rs) => rs.filter((r) => !r.deletedAt)),
    getRound: (id) => get('rounds', id),
    async createRound(roundInput) {
      const clientId = Device.getId();
      return run(['rounds', 'users'], 'readwrite', ({ rounds, users }) => new Promise((resolve, reject) => {
        const allReq = users.getAll();
        allReq.onsuccess = () => {
          const existing = (allReq.result || []).map(normalizeUser);
          const map = new Map(existing.map((u) => [Utils.fullName(u).toLowerCase(), u]));
          const participantIds = [];
          roundInput.userNames.forEach((fullName) => {
            const key = fullName.toLowerCase();
            let user = map.get(key);
            if (!user) {
              const parsed = Utils.parseName(fullName);
              user = normalizeUser({
                id: Utils.id(),
                username: `${parsed.firstName}.${parsed.lastName}`.toLowerCase().replace(/\.+/g, '.').replace(/[^a-z0-9.]/g, ''),
                firstName: parsed.firstName,
                lastName: parsed.lastName,
                createdAt: new Date().toISOString(),
                userType: RuntimeConfig.serverMode === 'offline' ? 'participant' : 'user',
                isAdmin: false,
                isMaster: false,
                canLogin: RuntimeConfig.serverMode !== 'offline'
              });
              users.put(user);
              map.set(key, user);
            }
            participantIds.push(user.id);
          });
          const now = new Date().toISOString();
          const round = {
            ...metaDefaults(),
            id: Utils.id(),
            title: roundInput.title,
            weeksCount: Utils.safeNum(roundInput.weeksCount),
            holidaysAllowed: Utils.safeNum(roundInput.holidaysAllowed),
            entryFee: Utils.safeNum(roundInput.entryFee),
            startDate: roundInput.startDate,
            weighDay: Utils.safeNum(roundInput.weighDay),
            participantIds,
            payoutMode: roundInput.payoutMode,
            prizeSplits: roundInput.prizeSplits,
            status: 'active',
            createdAt: now,
            updatedAt: now,
            clientId
          };
          rounds.put(round);
          resolve(round);
          OfflineAdapter._maybeEnqueue('rounds', round.id, 'CREATE', round, null);
        };
        allReq.onerror = () => reject(allReq.error);
      }));
    },
    updateRound: async (round) => {
      const current = await get('rounds', round.id);
      if (current && (current.version || 1) !== (round.version || 1)) {
        const err = new Error('Round has changed since you opened it.');
        err.code = 'conflict';
        err.latest = current;
        err.attempted = round;
        throw err;
      }
      const updated = { ...round, updatedAt: new Date().toISOString(), version: (round.version || 1) + 1, updatedBy: round.updatedBy };
      await put('rounds', updated);
      OfflineAdapter._maybeEnqueue('rounds', updated.id, 'UPDATE', updated, updated.updatedBy);
      return updated;
    },
    deleteRound: async (id) => {
      const now = new Date().toISOString();
      if (typeof globalThis._tenlbData !== 'undefined' && globalThis._tenlbData.mode === 'online') {
        // Soft-delete: mark deletedAt and enqueue so Firestore gets the tombstone
        const round = await get('rounds', id);
        if (round) {
          const tombstone = { ...round, deletedAt: now, updatedAt: now, version: (round.version || 1) + 1 };
          await put('rounds', tombstone);
          OfflineAdapter._maybeEnqueue('rounds', id, 'DELETE', tombstone, null);
        }
        // Also soft-delete associated submissions
        const allSubs = await getAll('submissions');
        const roundSubs = allSubs.filter((s) => s.roundId === id && !s.deletedAt);
        for (const s of roundSubs) {
          const t = { ...s, deletedAt: now, updatedAt: now, version: (s.version || 1) + 1 };
          await put('submissions', t);
          OfflineAdapter._maybeEnqueue('submissions', s.id, 'DELETE', t, null);
        }
      } else {
        const [allSubs, allSnapshots] = await Promise.all([getAll('submissions'), getAll('weeklySnapshots')]);
        await run(['rounds', 'submissions', 'weeklySnapshots'], 'readwrite', ({ rounds, submissions, weeklySnapshots }) => {
          rounds.delete(id);
          allSubs.filter((s) => s.roundId === id).forEach((s) => submissions.delete(s.id));
          allSnapshots.filter((s) => s.roundId === id).forEach((s) => weeklySnapshots.delete(s.id));
        });
      }
    },

    // ---- Users ---------------------------------------------------------------
    listUsers: async () => (await getAll('users')).filter((u) => !u.deletedAt).map(normalizeUser),
    getUserById: async (id) => normalizeUser(await get('users', id)),
    async getUserByUsername(username) {
      const all = await this.listUsers();
      return all.find((u) => u.username.toLowerCase() === String(username || '').trim().toLowerCase()) || null;
    },
    async getUserByFirebaseUid(uid) {
      if (!uid) return null;
      const all = await this.listUsers();
      return all.find((u) => u.firebaseUid === uid) || null;
    },
    createUser: async (user) => {
      const now = new Date().toISOString();
      const value = normalizeUser({ ...user, createdAt: now, updatedAt: now });
      if (value.userType === 'master' || value.isMaster) {
        const existing = (await getAll('users')).map(normalizeUser).find((u) => !u.deletedAt && (u.userType === 'master' || u.isMaster));
        if (existing) throw new Error('Only one master account is allowed.');
      }
      await put('users', value);
      OfflineAdapter._maybeEnqueue('users', value.id, 'CREATE', value, value.id);
      return value;
    },
    updateUser: async (user) => {
      const current = await get('users', user.id);
      if (current && (current.version || 1) !== (user.version || 1)) {
        const err = new Error('User has changed since you opened it.');
        err.code = 'conflict';
        err.latest = current;
        err.attempted = user;
        throw err;
      }
      const updated = normalizeUser({ ...user, updatedAt: new Date().toISOString(), version: (user.version || 1) + 1 });
      await put('users', updated);
      OfflineAdapter._maybeEnqueue('users', updated.id, 'UPDATE', updated, updated.id);
      return updated;
    },
    deleteUser: async (id) => {
      const now = new Date().toISOString();
      if (typeof globalThis._tenlbData !== 'undefined' && globalThis._tenlbData.mode === 'online') {
        // Soft-delete: tombstone the user record
        const user = await get('users', id);
        if (user) {
          const tombstone = { ...user, deletedAt: now, updatedAt: now, version: (user.version || 1) + 1 };
          await put('users', tombstone);
          OfflineAdapter._maybeEnqueue('users', id, 'DELETE', tombstone, id);
        }
        // Remove from round participant lists (local only, rounds sync separately)
        const rounds = await getAll('rounds');
        for (const r of rounds.filter((r) => (r.participantIds || []).includes(id))) {
          await put('rounds', { ...r, participantIds: r.participantIds.filter((pid) => pid !== id), updatedAt: now });
        }
        // Soft-delete submissions
        const subs = await getAll('submissions');
        for (const s of subs.filter((s) => s.userId === id && !s.deletedAt)) {
          const t = { ...s, deletedAt: now, updatedAt: now };
          await put('submissions', t);
        }
        // Delete sessions (local only)
        const sessions = await getAll('sessions');
        for (const s of sessions.filter((s) => s.userId === id)) {
          await del('sessions', s.token);
        }
      } else {
        const [rounds, submissions, sessions] = await Promise.all([getAll('rounds'), getAll('submissions'), getAll('sessions')]);
        await run(['users', 'rounds', 'submissions', 'sessions'], 'readwrite', ({ users, rounds: roundsStore, submissions: subsStore, sessions: sessStore }) => {
          users.delete(id);
          rounds.filter((r) => (r.participantIds || []).includes(id)).forEach((round) => {
            roundsStore.put({ ...round, participantIds: round.participantIds.filter((pid) => pid !== id), updatedAt: new Date().toISOString() });
          });
          submissions.filter((s) => s.userId === id).forEach((s) => subsStore.delete(s.id));
          sessions.filter((s) => s.userId === id).forEach((s) => sessStore.delete(s.token));
        });
      }
    },
    async upsertUsersByName(names) {
      const cleaned = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
      if (!cleaned.length) return [];
      return run(['users'], 'readwrite', ({ users }) => new Promise((resolve, reject) => {
        const req = users.getAll();
        req.onsuccess = async () => {
          const all = req.result || [];
          const map = new Map(all.map((u) => [Utils.fullName(normalizeUser(u)).toLowerCase(), normalizeUser(u)]));
          const out = [];
          for (const fullName of cleaned) {
            const key = fullName.toLowerCase();
            let user = map.get(key);
            if (!user) {
              const parsed = Utils.parseName(fullName);
              user = normalizeUser({ id: Utils.id(), username: `${parsed.firstName}.${parsed.lastName}`.toLowerCase().replace(/\.+/g, '.').replace(/[^a-z0-9.]/g, ''), firstName: parsed.firstName, lastName: parsed.lastName, isAdmin: false, isMaster: false, createdAt: new Date().toISOString() });
              user.userType = RuntimeConfig.serverMode === 'offline' ? 'participant' : 'user';
              user.canLogin = RuntimeConfig.serverMode !== 'offline';
              users.put(user);
              map.set(key, user);
            }
            out.push(user);
          }
          resolve(out);
        };
        req.onerror = () => reject(req.error);
      }));
    },

    // ---- Submissions ---------------------------------------------------------
    listSubmissions: () => getAll('submissions').then((ss) => ss.filter((s) => !s.deletedAt).map(normalizeSubmission)),
    async recordSubmissionAndSnapshot(submission, snapshot) {
      const norm = normalizeSubmission(submission);
      await run(['submissions', 'weeklySnapshots'], 'readwrite', ({ submissions, weeklySnapshots }) => {
        submissions.put(norm);
        weeklySnapshots.put(snapshot);
      });
      OfflineAdapter._maybeEnqueue('submissions', norm.id, 'CREATE', norm, norm.userId);
    },
    getWeeklySnapshot: (roundId, weekNumber) => get('weeklySnapshots', `${roundId}:${weekNumber}`),

    // ---- Sessions (device-local, never synced) --------------------------------
    createSession: async (token, userId, durationDays) => {
      const now = new Date();
      const row = { token, userId, createdAt: now.toISOString(), updatedAt: now.toISOString(), expiresAt: new Date(now.getTime() + (durationDays * 86400000)).toISOString() };
      await put('sessions', row);
      return row;
    },
    getSession: async (token) => get('sessions', token),
    touchSession: async (token, durationDays) => {
      const s = await get('sessions', token);
      if (!s) return null;
      const now = new Date();
      const next = { ...s, updatedAt: now.toISOString(), expiresAt: new Date(now.getTime() + (durationDays * 86400000)).toISOString() };
      await put('sessions', next);
      return next;
    },
    deleteSession: async (token) => del('sessions', token),

    // ---- Sync queue (used by SyncEngine) -------------------------------------
    listPendingSyncItems: () => run(['syncQueue'], 'readonly', ({ syncQueue }) => new Promise((res, rej) => {
      const items = [];
      const req = syncQueue.index('status').openCursor(IDBKeyRange.only('pending'));
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) return res(items);
        items.push(cursor.value);
        cursor.continue();
      };
      req.onerror = () => rej(req.error);
    })),
    countPendingSyncItems: async () => {
      const conn = await open();
      return new Promise((res, rej) => {
        const tx = conn.transaction(['syncQueue'], 'readonly');
        const req = tx.objectStore('syncQueue').index('status').count(IDBKeyRange.only('pending'));
        req.onsuccess = () => res(req.result || 0);
        req.onerror = () => rej(req.error);
      });
    },
    updateSyncItem: (item) => put('syncQueue', item),
    deleteSyncItem: (changeId) => del('syncQueue', changeId),
    enqueueSyncOperation: enqueue,

    // ---- Data merge (used by SyncEngine to write remote data into IndexedDB) --
    // Conflict strategy (documented):
    //   Rule 1: Different IDs → no conflict, both records coexist.
    //   Rule 2: Same ID, same version → ignore (already up-to-date).
    //   Rule 3: Remote version > local version → remote wins.
    //   Rule 4: Local version > remote version → local wins (skip remote).
    //   Rule 5: Same version, different content → use updatedAt; tie-break by
    //           lexicographic min(clientId) for determinism.
    //   Rule 6: Tombstone (deletedAt set) wins over any non-tombstone record
    //           with older or equal updatedAt.
    //   Rule 7: Admin records (rounds) with version conflicts are surfaced to
    //           the UI rather than silently overwritten.
    async mergeRemoteRecord(storeName, remote) {
      const local = await get(storeName, remote.id);
      if (!local) {
        // Rule 1: new record from another device
        await put(storeName, remote);
        return 'inserted';
      }
      if (local.version === remote.version && local.updatedAt === remote.updatedAt) {
        return 'noop'; // Rule 2
      }
      // Rule 6: tombstone wins
      if (remote.deletedAt && (!local.deletedAt || remote.updatedAt >= local.updatedAt)) {
        await put(storeName, { ...local, ...remote });
        return 'deleted';
      }
      if (local.deletedAt && (!remote.deletedAt || local.updatedAt >= remote.updatedAt)) {
        return 'local-deleted-wins';
      }
      if (remote.version > local.version) {
        await put(storeName, { ...local, ...remote }); // Rule 3
        return 'remote-wins';
      }
      if (local.version > remote.version) {
        return 'local-wins'; // Rule 4
      }
      // Rule 5: same version, use updatedAt then clientId tie-break
      const remoteNewer = remote.updatedAt > local.updatedAt || (remote.updatedAt === local.updatedAt && remote.clientId < local.clientId);
      if (remoteNewer) {
        await put(storeName, { ...local, ...remote });
        return 'remote-wins-lww';
      }
      return 'local-wins-lww';
    },

    // ---- Invites (device-local, never synced) --------------------------------
    listInvites: () => getAll('invites'),
    createInvite: (invite) => put('invites', invite),
    async getInviteByCode(code) {
      const conn = await open();
      return new Promise((res, rej) => {
        const tx = conn.transaction(['invites'], 'readonly');
        const req = tx.objectStore('invites').index('code').get(IDBKeyRange.only(code));
        req.onsuccess = () => res(req.result || null);
        req.onerror = () => rej(req.error);
      });
    },
    deleteInvite: (id) => del('invites', id),
    deleteAllInvites: () => run(['invites'], 'readwrite', ({ invites }) => new Promise((res, rej) => {
      const req = invites.clear();
      req.onsuccess = () => res(true);
      req.onerror = () => rej(req.error);
    })),
    async consumeInvite(code, userId) {
      const invite = await this.getInviteByCode(code);
      if (!invite) return null;
      const updated = { ...invite, usedAt: new Date().toISOString(), usedBy: userId };
      await put('invites', updated);
      return updated;
    },

    // ---- Reset ---------------------------------------------------------------
    async clearAllData() {
      await run(['rounds', 'users', 'submissions', 'weeklySnapshots', 'sessions', 'settings', 'syncQueue', 'invites'], 'readwrite',
        ({ rounds, users, submissions, weeklySnapshots, sessions, settings, syncQueue, invites }) => {
          rounds.clear();
          users.clear();
          submissions.clear();
          weeklySnapshots.clear();
          sessions.clear();
          syncQueue.clear();
          invites.clear();
          settings.put(defaultAppSettings());
        }
      );
    }
  };
})();
