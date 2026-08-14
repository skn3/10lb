# Copilot Instructions — 10lb Challenge

## Overview

**10lb Challenge** is a single-page web application (SPA) for tracking weight-loss challenges. Participants record weekly weigh-ins; the app calculates progress, rankings, and prize distributions.

The application is written in **vanilla JavaScript (ES2020)** using ES modules, bundled with esbuild. React 18 is used for a small number of UI components (nav bar, auth chip, snackbar); the rest of the UI is rendered via direct `innerHTML` assignment. There is no TypeScript, no JSX, no npm packages beyond esbuild (dev only).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Vanilla JavaScript (ES2020, no TypeScript) |
| Bundler | esbuild (dev dependency only — no runtime imports) |
| UI | React 18 (CDN, loaded at runtime) + `innerHTML` rendering |
| Routing | Hash-based (`#/route`) — `hashchange` events, no React Router |
| Local storage | IndexedDB via `OfflineAdapter` |
| Remote storage | Firestore via `FirestoreAdapter` (optional) |
| Auth (firebase) | Firebase Email/Password |
| Auth (offline) | Cookie (`tenlb_session`) + IndexedDB session records |
| PWA | Service Worker (`sw.js`), runtime-generated Web App Manifest |
| Fonts | Material Symbols Rounded (self-hosted WOFF2) |
| Config | `source/config.js` bundled into app; `config.json` deployed alongside output |

---

## Project Layout

```
source/
  main.js                    — esbuild entry point
  config.js                  — RuntimeConfig + Config constants
  domain.js                  — pure business logic (no I/O)
  routes.js                  — route name constants
  features/
    app/                     — App lifecycle, routing, nav, PWA
    authentication/          — plugins (offline/firebase), auth helpers
    challenges/              — round CRUD + finish-week
    submission/              — weight/holiday/forfeit submit + overview
    users/                   — user admin, create participant
    invites/                 — invite codes, join flow
    settings/                — user profile, server, sync settings
    storage/                 — IndexedDB, Firestore, SyncEngine, Data
  shared/
    utils/utils.js            — Utils (esc, id, validEmail, …)
    classes/security.js       — Security (PBKDF2 hashing)
    classes/device.js         — Device (stable client ID)
    enums/userTypeEnum.js     — UserType enum
    models/appSettingsModel.js
    components/               — shared UI components
dist/
  bundle.js                  — esbuild output
  index.html                 — copied from source/
  sw.js                      — copied from source/
  fonts/                     — copied from source/fonts/
.github/
  copilot-instructions.md    — this file
  instructions/
    features/                — per-feature agent instructions
    shared/                  — shared layer agent instructions
```

### Per-feature layout

Each feature under `source/features/{name}/` follows:

```
classes/
  {name}Service.js       — PUBLIC API (thin wrappers → controller)
  {name}Controller.js    — PRIVATE logic, state, data access
models/
  {name}Model.js         — one ES class per model
pages/
  {pageName}Page.js      — one page per file; exports render + bind fns
components/
  {component}.js         — feature-specific UI components
enums/
  {name}Enums.js         — feature-specific enums
utils/
  utils.js               — small utility functions
  {complexHelper}.js     — complex utilities in their own file
```

---

## Service / Controller Pattern

**The core architectural rule**: features expose a public `*Service.js` and keep all implementation in a private `*Controller.js`.

```js
// PUBLIC — called by other features and by App
export const ChallengeService = {
  listRounds: () => ChallengeController.listRounds(),
  createRound: (data) => ChallengeController.createRound(data),
};

// PRIVATE — never called directly from outside the feature
const ChallengeController = {
  async listRounds() { return Data.adapter.listRounds(); },
};
```

Rules:
- Other features **only** call `FooService` methods — never `FooController` directly.
- Services contain **no logic** — they are thin delegation wrappers.
- Controllers own state, data access (`Data.adapter`), and all business logic.

---

## App Object (`features/app/classes/appController.js`)

`App` is the thin orchestrator. It owns:

- `App.state` — all mutable UI state (route, message, error, rounds, users, currentUser, …)
- `App.plugin` — active `ServerPlugin` (set in `App.init()`)
- `App.react` — React root references

Key lifecycle methods: `init()`, `render()`, `refresh()`, `navigate(route)`, `resolveScreen()`.

Helpers available to all page modules:
```js
app.bindAsyncFormSubmit(form, handler)  // required for every form
app.fail(msg)                           // error snackbar
app.setMessage(msg)                     // success snackbar
app.isAdmin()  app.isMaster()  app.isFirebaseMode()
app.navigate(route, opts)
app.refresh()
```

---

## Routing

All routes are hash-based. Route constants are in `source/routes.js`.

| Route | Access |
|---|---|
| `#/install` | Before install (offline) or unauthenticated (firebase) |
| `#/login` | Unauthenticated |
| `#/join?invite=CODE` | Firebase + unauthenticated + invite code |
| `#/overview` | Authenticated |
| `#/rounds` | Authenticated |
| `#/submit` | Authenticated |
| `#/settings` | Authenticated |
| `#/create`, `#/edit`, `#/delete` | Admin |
| `#/users`, `#/user?id=...`, `#/create_participant`, `#/invite-detail` | Admin |
| `#/denied` | Access denied fallback |

Route guards delegate to `App.plugin.guardRoute()` — never add `isInstalled()` checks directly in App routing code.

---

## Forms

Every form **must** use `app.bindAsyncFormSubmit(form, handler)`. Forms use `action="#"`. Never let forms submit natively (no page reload allowed — the app runs on static hosting).

Current form inventory:

| Form ID | Feature | Purpose |
|---|---|---|
| `install-form` | app | Install server |
| `login-form` | app | Login |
| `join-form` | app | Invite registration |
| `create-participant-form` | users | Create participant |
| `edit-user-form` | users | Edit user |
| `user-type-form` | users | Change user type |
| `create-form` | challenges | Start new round |
| `edit-form` | challenges | Edit round |
| `delete-form` | challenges | Delete round |
| `submit-form` | submission | Submit weight / holiday / forfeit |
| `user-settings-form` | settings | Update profile |
| `user-password-form` | settings | Change password |
| `server-settings-form` | settings | Server settings |
| `server-reset-form` | settings | Reset server |
| `firebase-config-form` | settings | Firebase connection test |

---

## Server Modes

### Offline Mode (`serverMode: "offline"`)
- All data in IndexedDB. No network required.
- Passwords hashed with PBKDF2 (SHA-256, 100k iterations).
- Sessions: `tenlb_session` cookie + IndexedDB session records.
- `OfflinePlugin`: `isInstalled()` reads `appSettings.installed`.

### Firebase Mode (`serverMode: "firebase"`)
- IndexedDB is local cache; Firestore is source of truth.
- Firebase Email/Password for auth; `FirebasePlugin.isInstalled()` always returns `true`.
- `SyncEngine` keeps IndexedDB and Firestore in sync bidirectionally.

---

## User Types

| Type | `canLogin` | Privileges |
|---|---|---|
| `master` | ✓ | Super-admin; can reset/uninstall |
| `admin` | ✓ | Manage users, rounds, invites |
| `user` | ✓ | Submit weigh-ins |
| `participant` | ✗ | Passive; invited to upgrade via Firebase |

---

## IndexedDB Schema (DB_VERSION 4)

Stores: `rounds`, `users`, `submissions`, `weeklySnapshots`, `settings`, `sessions`, `syncQueue`, `invites`.

Access all stores via `Data.adapter` (always `OfflineAdapter`). Never import `OfflineAdapter` directly in business logic.

---

## Security Rules

- Use `Utils.esc()` / `Utils.escAttr()` for **every** user-supplied value before inserting into `innerHTML`.
- Passwords (offline) are stored as `"v1:salt:hash"` — never in plaintext.
- Never commit secrets or Firebase credentials to source code.
- Firestore security rules are in `firestore.rules`.

---

## Build

```bash
esbuild source/main.js --bundle --format=iife --outfile=dist/bundle.js
```

Then copy `source/index.html`, `source/sw.js`, `source/fonts/` into `dist/`. See `.github/workflows/static.yml` for the exact CI steps.

---

## Coding Conventions

- **No TypeScript**. No JSX (except in the 3 React component files).
- **1 class per file** — models, enums, services, controllers each in their own file.
- **ES module imports** — use relative paths. Paths from `features/foo/classes/` to `shared/` need `../../../shared/`.
- **No side effects at module level** — no code runs on import.
- **Vanilla objects** — prefer `export const Foo = { ... }` for singletons; use `class Foo { ... }` only when instantiation is needed.
- **All forms** must use `app.bindAsyncFormSubmit()`.
- **Mode-specific logic** belongs in the plugin (`OfflinePlugin` / `FirebasePlugin`), not in `App`.
- **Feature pages** export both `renderXxxPage(app)` and `bindXxxEvents(app)` from the same file.

---

## Additional Instructions

Detailed instructions for each feature and the shared layer are in:

```
.github/instructions/features/   — per-feature agent instructions
.github/instructions/shared/     — shared layer agent instructions
```

These are automatically included by Copilot based on the `applyTo` frontmatter of each file.
