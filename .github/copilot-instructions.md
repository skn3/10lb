# Copilot Instructions — 10lb Challenge

## Overview

**10lb Challenge** is a single-page web application (SPA) for tracking weight-loss challenges. Participants record weekly weigh-ins; the app calculates progress, rankings, and prize distributions.

The entire application lives in a single file: `index.html`. There is no build step, no bundler, and no npm. All JavaScript modules are vanilla ES5/ES2020 objects and classes written directly in `<script>` tags. React 18 (UMD bundle from CDN) is used for some navigation and auth-chip components; the rest of the UI is rendered via direct `innerHTML` assignment.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Vanilla JavaScript (ES2020, no TypeScript) |
| UI framework | React 18 (UMD from unpkg CDN) + raw `innerHTML` rendering |
| Routing | Hash-based (`#/route`) — no React Router used for routing logic; `window.hashchange` events drive route changes |
| Local storage | IndexedDB (via `OfflineAdapter`) |
| Remote storage | Firestore (via `FirestoreAdapter`, optional) |
| Auth (firebase) | Firebase Email/Password Authentication |
| Auth (offline) | Cookie (`tenlb_session`) + IndexedDB session records |
| PWA | Service Worker (`sw.js`), Web App Manifest generated at runtime |
| Fonts | Material Symbols Rounded (self-hosted WOFF2) |
| Config | `config.json` (deployed alongside `index.html`) |

---

## Project Layout

```
index.html          — entire application (JS + HTML + CSS)
config.json         — runtime config: serverMode, Firebase settings
sw.js               — service worker (cache-first, network fallback)
firestore.rules     — Firestore security rules
firestore.indexes.json — Firestore composite indexes
fonts/              — Material Symbols Rounded WOFF2 font
FIREBASE_SETUP.md   — Firebase project setup guide
README.md           — Usage and deployment notes
```

---

## Module Architecture

All modules are globals defined in `index.html` within a single `<script>` block. They are defined in dependency order:

### 1. `Config`
Static constants: `DB_NAME`, `DB_VERSION`, `RUNTIME_CONFIG_PATH`.

### 2. `RuntimeConfig` + `loadRuntimeConfig()`
Runtime settings loaded from `config.json` at startup. Shape:
```js
{ serverMode: 'offline' | 'firebase', firebase: { apiKey, authDomain, projectId, ... } }
```
`loadRuntimeConfig()` is called at the top of `App.init()`.

### 3. `Utils`
Pure utility functions: `id()` (UUID), `round2()`, `pct()`, `esc()` (HTML escape), `escAttr()`, `fullName()`, `parseName()`, `validEmail()`, `validPassword()`, `safeNum()`, `dateTime()`, `getCookie()`, `setCookie()`, `clearCookie()`, `passwordInputAttrs()`.

### 4. `Security`
Password hashing and session token generation:
- `createPasswordRecord(password)` → PBKDF2 hash
- `verifyPassword(password, record)` → boolean
- `sessionToken()` → random 32-byte hex string

### 5. `Device`
Stable per-browser client ID stored in `localStorage` (`tenlb_clientId`).

### 6. `OfflineAdapter`
IndexedDB data access layer. DB name: `tenlb-challenge`, current version: `4`.

**Stores:**
| Store | Key | Notes |
|---|---|---|
| `rounds` | `id` | Challenge rounds |
| `users` | `id` | All user accounts |
| `submissions` | `id` | Weekly weigh-ins (index: `roundId`) |
| `weeklySnapshots` | `id` | Computed per-week summaries |
| `settings` | `key` | App settings (key `'app'`), device meta (key `'deviceMeta'`) |
| `sessions` | `token` | Offline auth sessions (index: `userId`) |
| `syncQueue` | `changeId` | Pending Firestore uploads (index: `status`, `entityType`) |
| `invites` | `id` | Invite codes (index: `code`, unique) |

**Key methods:**
`init()`, `getAppSettings()`, `saveAppSettings()`, `getDeviceMeta()`, `saveDeviceMeta()`, `listUsers()`, `getUserById()`, `getUserByUsername()`, `getUserByFirebaseUid()`, `createUser()`, `updateUser()`, `deleteUser()`, `listRounds()`, `createRound()`, `updateRound()`, `deleteRound()`, `listSubmissions()`, `recordSubmissionAndSnapshot()`, `getWeeklySnapshot()`, `createSession()`, `getSession()`, `touchSession()`, `deleteSession()`, `clearAllData()`, `listInvites()`, `createInvite()`, `getInviteByCode()`, `deleteInvite()`.

### 7. `FirestoreAdapter`
Firestore data access layer. All documents live under `challenges/default/{entityType}/{id}`.

**Key methods:**
`init(firebaseConfig, challengeId)`, `isReady()`, `getUid()`, `signInWithEmail()`, `createUserWithEmail()`, `signOut()`, `getCurrentFirebaseUser()`, `writeRecord()`, `deleteRecord()`, `downloadAll()`, `getRecord()`, `removeRecord()`, `getChallengeDoc()`, `subscribe()`.

> `getChallengeDoc()` reads the `challenges/default` root document, which has `installedAt` after a successful install. Used by `FirebasePlugin.canInstall()` to prevent re-installation.

### 8. `Data`
Thin wrapper that holds a reference to the active adapter (`OfflineAdapter`) and a `mode` flag (`'local'` | `'online'`). `Data.mode` is set to `'online'` when firebase is configured.

```js
Data.adapter  // always OfflineAdapter; Firestore writes are layered on top via SyncEngine
Data.mode     // 'local' | 'online'
Data.init()   // open IndexedDB, set mode from RuntimeConfig
```

### 9. `ServerPlugin` (abstract) + `OfflinePlugin` + `FirebasePlugin`

**The plugin system abstracts all mode-specific behaviour.** `App.plugin` is set in `App.init()` based on `RuntimeConfig.serverMode`.

#### `ServerPlugin` (abstract base)
Defines the contract that both implementations must satisfy:

| Method | Purpose |
|---|---|
| `isInstalled()` | Whether the app has been provisioned |
| `defaultRoute()` | Default route when none is specified |
| `guardRoute(requested)` | Resolve the safe route for a requested route |
| `canAccess(route)` | Whether a route is accessible in current state |
| `restoreSession()` | Restore an existing session on page load |
| `onLogin(user)` | Called after login — create session token |
| `onLogout()` | Called before logout — clear session |
| `canInstall()` | Returns `true` if installation is permitted |
| `onInit()` | Called at the end of `App.init()` for async side effects |

#### `OfflinePlugin`
- `isInstalled()` — reads `appSettings.installed` from IndexedDB.
- Default route: `install` → `login` → `overview`.
- Sessions: `tenlb_session` cookie + IndexedDB `sessions` store.
- `canInstall()` — returns `!isInstalled()`.

#### `FirebasePlugin`
- `isInstalled()` — **always returns `true`**. Firebase being configured implies the server exists. No local IndexedDB installed flag is checked.
- Default route: `login` (or `join` if invite code present) → `overview`.
- Install page (`#/install`) is accessible by direct URL navigation when **not** authenticated. Once authenticated, `guardRoute('install')` returns `'overview'` and shows the "Installation is locked" message.
- Sessions: Firebase Auth persistent session; no cookie; `sessions` collection in Firestore.
- `canInstall()` — queries Firestore `challenges/default` for `installedAt`; blocks re-installation if present.
- `onInit()` — starts `_initOnlineMode()` which activates `SyncEngine`.

### 10. `SyncEngine`
Bidirectional sync between IndexedDB (`OfflineAdapter`) and Firestore. Active only when `Data.mode === 'online'`.

- **Upload**: reads `syncQueue` for `status='pending'`, uploads to Firestore, marks `done`.
- **Download**: fetches all records from each entity type, merges into IndexedDB using conflict resolution (last-write-wins by `version`).
- **Real-time**: Firestore `onSnapshot` listener pushes remote changes into IndexedDB and dispatches `tenlb:remotechange` event.
- **Retry**: exponential backoff, max 5 retries per item (`status='error'` after that).
- Dispatches `tenlb:syncstate` events for UI sync-bar updates.

### 11. `Domain`
Pure business logic — no I/O, no side effects:
- Round status, active round detection.
- Weekly weight calculation, progress percentage.
- Rankings and prize split calculation.
- Name parsing helpers.

### 12. `App`
The main application object. Owns:

**Properties:**
- `plugin` — active `ServerPlugin` instance (set in `App.init()`).
- `state` — all mutable UI state (`route`, `message`, `error`, `rounds`, `users`, `submissions`, `currentUser`, `sessionToken`, `appSettings`, `syncMeta`, `pendingInviteCode`, `redirectAfterLogin`, `selectedRoundId`, `inviteDetail`, `sessions`, `userFilters`).
- `react` — React root references.

**Key lifecycle methods:**
- `App.init()` — loads config, opens DB, creates plugin, restores session, renders.
- `App.refresh()` — reloads all state from `Data.adapter`.
- `App.render()` — calls `attachNav()`, `resolveScreen()`, renders to `#app`.
- `App.resolveScreen()` — maps `state.route` to a render method.
- `App._applyRouteFromHash()` — reads hash, guards route, sets `state.route`.
- `App.loginAs(user)` — sets `currentUser`, calls `plugin.onLogin()`.
- `App.logout()` — calls `plugin.onLogout()`, clears state, navigates to default route.
- `App.navigate(route)` — sets hash and re-renders.

**Helper methods:**
- `isAuthenticated()`, `isAdmin()`, `isMaster()`, `isFirebaseMode()`.
- `isInstalled()` — delegates to `plugin.isInstalled()`.
- `_defaultRoute()` — delegates to `plugin.defaultRoute()`.
- `_guardRoute(route)` — delegates to `plugin.guardRoute(sanitized)`.
- `canAccess(route)` — delegates to `plugin.canAccess(route)`.

---

## Server Modes

### Offline Mode (`serverMode: "offline"`)
- All data in IndexedDB.
- No network required.
- Passwords hashed with PBKDF2 (SHA-256, 100k iterations).
- Sessions: server-side cookie `tenlb_session` + IndexedDB session record.
- Must install before any other route is accessible.
- `installed: true` saved in IndexedDB settings after install.

### Firebase Mode (`serverMode: "firebase"`)
- IndexedDB is the local cache; Firestore is the source of truth.
- Firebase Email/Password for authentication.
- SyncEngine keeps IndexedDB and Firestore in sync.
- **No local installed state**: `isInstalled()` always returns `true`.
- Install page accessible at `#/install` when not authenticated.
- Re-installation prevented by checking Firestore `challenges/default.installedAt`.
- Multiple browsers can be open simultaneously with no per-browser install state.
- Active sessions tracked in Firestore `challenges/default/sessions`.

---

## Routing

All navigation uses hash routing. Routes:

| Route | Access |
|---|---|
| `#/install` | Offline: before install only. Firebase: when not authenticated. |
| `#/login` | When not authenticated (both modes). |
| `#/join?invite=CODE` | Firebase mode, when not authenticated, with invite code. |
| `#/overview` | Authenticated users. |
| `#/rounds` | Authenticated users. |
| `#/submit` | Authenticated users. |
| `#/settings` | Authenticated users. |
| `#/create`, `#/edit`, `#/delete` | Admin users only. |
| `#/users`, `#/user?id=...`, `#/create_participant`, `#/invite-detail` | Admin users only. |
| `#/denied` | Access denied fallback. |

Route guards are implemented in `plugin.guardRoute()` and `plugin.canAccess()`. The App never directly checks `isInstalled()` in routing logic — it always delegates to the plugin.

---

## Forms

All form submissions are intercepted with `App.bindAsyncFormSubmit()` to prevent native URL redirects. Forms use `action="#"` and all validation is JavaScript-only. This is required for GitHub Pages static hosting.

When referring to **"all forms"**, that means **every form in the app**. Any change to shared form behaviour must be applied consistently across the full set of forms on the website.

Current form inventory:
- `install-form` — install server
- `login-form` — login
- `join-form` — invite registration
- `create-participant-form` — create participant
- `edit-user-form` — edit user
- `user-type-form` — change user type
- `create-form` — start new round
- `edit-form` — edit round
- `delete-form` — delete round
- `submit-form` — submit weight / holiday / forfeit
- `user-settings-form` — user settings
- `user-password-form` — user password
- `server-settings-form` — server settings
- `server-reset-form` — server reset
- `firebase-config-form` — firebase connection test

If you add, edit, remove, rename, or replace a form, also update this form inventory immediately.

---

## User Types

| Type | Description |
|---|---|
| `master` | Single super-admin; owns the server; can reset/uninstall |
| `admin` | Admin access; can manage users, rounds, invites |
| `user` | Normal user; can log in and submit weigh-ins |
| `participant` | Passive participant; cannot log in; invite-only to upgrade (firebase) |

---

## Install Flow

### Offline install
1. User navigates to `#/install` (default route before install).
2. Form submits → `plugin.canInstall()` returns `true` (not installed).
3. Master user created in IndexedDB, `installed: true` saved to settings.
4. `loginAs(user)` called → session cookie set, `overview` shown.

### Firebase install
1. User manually navigates to `#/install`.
2. Form submits → `plugin.canInstall()` queries Firestore for `installedAt`; returns `true` if not present.
3. Firebase Auth account created via `_provisionFirebaseMaster()` using a temporary Firebase app.
4. Challenge root document `challenges/default` written with `installedAt` timestamp.
5. Master user record created in IndexedDB (syncs to Firestore via SyncEngine).
6. `loginAs(user)` called → Firebase session established, `overview` shown.

---

## Security

- Passwords (offline): PBKDF2-SHA-256, 100k iterations, random salt, stored as `"v1:salt:hash"`.
- Passwords (firebase): managed by Firebase Auth; never stored locally.
- Sessions (offline): `tenlb_session` HTTP cookie (SameSite=Strict) + IndexedDB expiry.
- Sessions (firebase): Firebase Auth persistent session; session records tracked in Firestore.
- XSS prevention: all user-supplied values HTML-escaped with `Utils.esc()` / `Utils.escAttr()` before insertion into `innerHTML`.
- No user `password` field is uploaded to Firestore (`sanitiseUser()` strips it).
- Firestore security rules enforce auth-gated reads and admin-only writes.

---

## IndexedDB Schema (DB_VERSION 4)

```
tenlb-challenge
  rounds         { id, name, startDate, endDate, entryFee, prizeSplits, participantIds, status, ... }
  users          { id, username, firstName, lastName, password, userType, isAdmin, isMaster, canLogin, firebaseUid, inviteCode, ... }
  submissions    { id, userId, roundId, weekNumber, weight, ... }
  weeklySnapshots { id, roundId, weekNumber, rankings, ... }
  settings       { key: 'app', installed, serverName, weightFormat, currency, theme, sessionDurationDays, ... }
                 { key: 'deviceMeta', storageMode, firebaseConfig, lastSyncAt, syncStatus, ... }
  sessions       { token, userId, expiresAt, ... }
  syncQueue      { changeId, status, entityType, entityId, payload, retryCount, ... }
  invites        { id, code, email, role, createdAt, acceptedAt, ... }
```

---

## Coding Conventions

- All code is in `index.html` — do not create separate `.js` files.
- No build step or bundler — vanilla JS only.
- No TypeScript. No JSX outside of the few React components (nav, auth chip, snackbar).
- Module pattern: use `const Foo = { ... }` objects or `class Foo { ... }` classes.
- Use `Utils.esc()` / `Utils.escAttr()` for all user-supplied data in `innerHTML`.
- All form submissions must be intercepted by `App.bindAsyncFormSubmit()`.
- Mode-specific behaviour belongs in the plugin (`OfflinePlugin` or `FirebasePlugin`), not in `App` directly.
- `App.isFirebaseMode()` may be used for UI-only rendering differences (showing/hiding firebase-specific features).
- Do not add `installed` checks in `App` routing methods — delegate to `plugin.isInstalled()` / `plugin.guardRoute()`.
- Do not store per-browser installed state in IndexedDB for firebase mode.

---

## PWA

- Service Worker (`sw.js`): cache-first with network fallback. Caches `index.html`, `config.json`.
- Manifest: generated at runtime as a Blob URL and injected as `<link rel="manifest">`.
- iOS: `apple-mobile-web-app-capable` meta tag, self-hosted icon.

---

## Deployment

Static files only. Can be deployed to GitHub Pages or any static host. `config.json` must be alongside `index.html`. For firebase mode, Firebase Hosting recommended for Firestore security rules.
