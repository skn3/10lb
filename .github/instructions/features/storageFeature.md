---
applyTo: "source/features/storage/**"
---

# Storage Feature

The `storage` feature provides all data persistence: IndexedDB via `OfflineAdapter`, Firestore via `FirestoreAdapter`, bidirectional sync via `SyncEngine`, and the `Data` singleton.

## What this feature owns

- **`offlineAdapter.js`** — IndexedDB data access layer
- **`firestoreAdapter.js`** — Firestore data access layer
- **`syncEngine.js`** — bidirectional sync between IndexedDB and Firestore
- **`data.js`** — `Data` singleton (active adapter reference + mode flag)

## Data singleton

```js
Data.adapter  // always OfflineAdapter
Data.mode     // 'local' | 'online'
await Data.init()  // opens IndexedDB, sets mode from RuntimeConfig
```

All feature code accesses data through `Data.adapter` — never import `OfflineAdapter` directly from business logic.

## OfflineAdapter — IndexedDB stores

| Store | Key | Notes |
|---|---|---|
| `rounds` | `id` | Challenge rounds |
| `users` | `id` | All user accounts |
| `submissions` | `id` | Weekly weigh-ins (index: `roundId`) |
| `weeklySnapshots` | `id` | Computed per-week summaries |
| `settings` | `key` | App settings (`key='app'`), device meta (`key='deviceMeta'`) |
| `sessions` | `token` | Offline auth sessions (index: `userId`) |
| `syncQueue` | `changeId` | Pending Firestore uploads |
| `invites` | `id` | Invite codes |

### Key methods

```js
// Settings
adapter.getAppSettings() → AppSettings
adapter.saveAppSettings(settings)
adapter.getDeviceMeta() → DeviceMeta
adapter.saveDeviceMeta(meta)

// Users
adapter.listUsers()
adapter.getUserById(id)
adapter.getUserByUsername(email)
adapter.getUserByFirebaseUid(uid)
adapter.createUser(data) → user
adapter.updateUser(data)
adapter.deleteUser(id)

// Rounds
adapter.listRounds()
adapter.createRound(data)
adapter.updateRound(data)
adapter.deleteRound(id)

// Submissions
adapter.listSubmissions()
adapter.recordSubmissionAndSnapshot(submission, snapshot)  // atomic

// Invites
adapter.listInvites()
adapter.createInvite(invite)
adapter.getInviteByCode(code)
adapter.consumeInvite(code, userId)
adapter.deleteInvite(id)

// Sessions
adapter.createSession(token, userId, expiresAt)
adapter.getSession(token)
adapter.touchSession(token, durationDays)
adapter.deleteSession(token)

// Sync support
adapter.mergeRemoteRecord(storeName, record)
adapter.clearAllData()
```

## FirestoreAdapter

All Firestore documents live under `challenges/default/{entityType}/{id}`.

### Key methods

```js
FirestoreAdapter.isReady()           → boolean
FirestoreAdapter.getUid()            → Firebase UID or null
FirestoreAdapter.init(config, id)    // initialise Firebase app + Firestore
FirestoreAdapter.signInWithEmail(email, password) → Firebase user
FirestoreAdapter.createUserWithEmail(email, password) → Firebase user
FirestoreAdapter.signOut()
FirestoreAdapter.getCurrentFirebaseUser() → Firebase user or null
FirestoreAdapter.writeRecord(collection, record)
FirestoreAdapter.getRecord(collection, id)
FirestoreAdapter.removeRecord(collection, id)
FirestoreAdapter.queryRecords(collection, field, value)
FirestoreAdapter.downloadAll(collection)
FirestoreAdapter.getChallengeDoc()   // reads challenges/default root doc
FirestoreAdapter.resetChallengeData()
FirestoreAdapter.subscribe(collection, onChange)
FirestoreAdapter.sendPasswordResetEmail(email)
FirestoreAdapter.updatePassword(newPassword)
FirestoreAdapter.getAuth()
```

## SyncEngine

Bidirectional sync between IndexedDB and Firestore. Active only when `Data.mode === 'online'`.

```js
SyncEngine.start()     // begin sync loop + subscribe to Firestore changes
SyncEngine.stop()
SyncEngine.isRunning() → boolean
SyncEngine.retryNow()  // force immediate retry of pending items
```

Dispatches custom DOM events:
- `tenlb:syncstate` — sync status changed (syncing, synced, error, pending)
- `tenlb:remotechange` — remote data received; triggers `App.refresh()` + `App.render()`

Conflict resolution is last-write-wins by `record.version` (integer).

## Runtime config

`Data.mode` is determined by `RuntimeConfig.serverMode`:
- `'offline'` → mode stays `'local'`; no Firestore used
- `'firebase'` → mode set to `'online'` after `FirestoreAdapter.init()`

## Coding notes

- `Data.adapter` is always `OfflineAdapter` regardless of mode — Firestore writes are queued via `syncQueue` and uploaded by `SyncEngine`.
- Use `adapter.mergeRemoteRecord()` when hydrating remote records into the local cache.
- `consumeInvite(code, userId)` marks the invite as used atomically in IndexedDB.
- `getAppSettings()` returns a default object if no settings exist yet (safe to call before install).
