---
applyTo: "source/features/authentication/**"
---

# Authentication Feature

The `authentication` feature handles all aspects of user login, session management, and Firebase Auth integration.

## What this feature owns

- **Plugin system**: `serverPlugin.js` (abstract), `offlinePlugin.js`, `firebasePlugin.js`
- **`authController.js`** — private Firebase helpers and session logic
- **`authService.js`** — public API
- **`sessionModel.js`** — session data shape

## Plugin system

`App.plugin` is set during `App.init()` to either `OfflinePlugin` or `FirebasePlugin`. All mode-specific behaviour is delegated here.

### `ServerPlugin` (abstract)

| Method | Purpose |
|---|---|
| `isInstalled()` | Whether the app has been provisioned |
| `defaultRoute()` | First route when no hash is present |
| `guardRoute(route)` | Resolve the safe route for a requested route |
| `canAccess(route)` | Whether a route is accessible in current state |
| `restoreSession()` | Restore session on page load |
| `onLogin(user)` | Called after loginAs — create session token |
| `onLogout()` | Called before logout — clear session |
| `canInstall()` | Returns true if installation is permitted |
| `onInit()` | Async side effects on startup |

### `OfflinePlugin`

- `isInstalled()` — reads `appSettings.installed` from IndexedDB
- Sessions: `tenlb_session` cookie + IndexedDB `sessions` store
- `canInstall()` — returns `!isInstalled()`
- `onLogin(user)` — creates session token + sets cookie

### `FirebasePlugin`

- `isInstalled()` — **always returns `true`** (firebase configured ⟹ server exists)
- `restoreSession()` — calls `FirestoreAdapter.getCurrentFirebaseUser()` + `AuthController.resolveFirebaseUser()`
- `onLogin(user)` — calls `AuthController.ensureFirebaseAuthenticatedState()` to register admin entry and upsert Firestore session
- `canInstall()` — queries `challenges/default.installedAt` in Firestore; blocks if present
- `onInit()` — starts `SyncEngine` via `_initOnlineMode`

## AuthController

`AuthController` contains all Firebase-specific helpers extracted from the old App object. It should only be called from `AuthService`, plugins, or feature pages that must interact with Firebase directly (e.g. `loginPage.js`, `joinPage.js`, `installPage.js`).

### Key methods

| Method | Purpose |
|---|---|
| `loadFirebaseSDK()` | Lazy-load Firebase 10 compat bundles from CDN |
| `resolveFirebaseUser(fbUser)` | Resolve local user from Firebase UID/email |
| `upsertFirebaseSession(user, settings, sessionId)` | Write session record to Firestore |
| `deleteFirebaseSession(sessionId)` | Remove session from Firestore |
| `registerFirebaseAdmin(user)` | Write admin entry to `challenges/default/admins` |
| `ensureFirebaseAuthenticatedState(user, settings, sessionId)` | Register admin + upsert session + start SyncEngine |
| `provisionFirebaseMaster(username, pwd, localUserId, logFn)` | Create Firebase Auth account during install |
| `testFirebaseConnection(firebaseConfig)` | Test connectivity with a temporary Firebase app |
| `getFirebaseInvite(code)` | Read invite from Firestore by code |
| `saveFirebaseInvite(invite)` | Write invite to Firestore |
| `deleteFirebaseInvite(inviteId)` | Soft-delete invite in Firestore |
| `loadVisibleInvites(...)` | Load filtered invite list for admin UI |
| `loadVisibleSessions(...)` | Load filtered session list for admin UI |

## Session model

```js
class SessionModel {
  id           // userId:clientId composite
  userId
  firebaseUid
  email
  firstName
  lastName
  role         // master | admin | user
  clientId
  startedAt
  lastSeenAt
  expiresAt
}
```

## Coding notes

- `firebaseSessionId(user)` in `App` returns `${user.id}:${Device.getId()}` — unique per user per browser.
- Offline sessions expire server-side; Firebase sessions track `lastSeenAt` in Firestore.
- `FirebasePlugin.isInstalled()` always returns `true` — never check IndexedDB `installed` flag in Firebase mode.
- Do not call `AuthController` methods from unrelated features without going through `AuthService`.
