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
| Config | `source/constants.js` holds app-wide constants/enums; `source/config.js` holds runtime config and DB wiring; `config.json` is deployed alongside output |

---

## Project Layout

```
source/
  main.js                    — esbuild entry point
  constants.js               — app-wide constants, enums, nav config, and theme options
  config.js                  — RuntimeConfig + DB config wiring
  domain.js                  — pure business logic (no I/O)
  routes.js                  — route re-export from `source/constants.js`
  features/
    app/                     — App lifecycle, routing, nav, PWA
      classes/               — appService.js, appController.js
      components/            — menuBar.js, snackbar.js, siteHeader.js
      pages/                 — deniedPage.js, installPage.js, joinPage.js, loginPage.js
      utils/                 — utils.js
    authentication/          — plugins (offline/firebase), auth helpers
      classes/               — authService.js, authController.js, firebasePlugin.js, offlinePlugin.js, serverPlugin.js
      models/                — sessionModel.js
    challenges/              — round CRUD + finish-week
      classes/               — challengeService.js, challengeController.js
      enums/                 — roundEnums.js (re-export from `source/constants.js`)
      models/                — roundModel.js
      pages/                 — createRoundPage.js, deleteRoundPage.js, editRoundPage.js, finishWeekPage.js, roundListPage.js
    submission/              — weight/holiday/forfeit submit + overview
      classes/               — submissionService.js, submissionController.js
      components/            — leaderboard.js, weekPager.js
      enums/                 — submissionEnums.js (re-export from `source/constants.js`)
      models/                — submissionModel.js
      pages/                 — overviewPage.js, submitPage.js
    users/                   — user admin, create participant
      classes/               — usersService.js, usersController.js
      components/            — dataTable.js
      enums/                 — userTypeEnum.js (re-export from `source/constants.js`)
      models/                — userModel.js
      pages/                 — createParticipantPage.js, userAdminPage.js, usersPage.js
    invites/                 — invite codes, join flow
      classes/               — invitesService.js, invitesController.js
      components/            — qrCode.js
      models/                — inviteModel.js
      pages/                 — inviteDetailPage.js, invitesPage.js
      utils/                 — inviteCodeUtils.js
    settings/                — user profile, server, sync settings
      classes/               — settingsService.js, settingsController.js
      components/            — serverSettingsTab.js, syncSettingsTab.js, syncButton.js, userSettingsTab.js
      models/                — appSettingsModel.js
      pages/                 — settingsPage.js
    storage/                 — IndexedDB, Firestore, SyncEngine, Data
      classes/               — storageService.js, storageController.js, firestoreAdapter.js, offlineAdapter.js, syncEngine.js
      models/                — data.js
  shared/
    utils/utils.js            — Utils (esc, id, validEmail, …) — used by all features
    classes/security.js       — Security (PBKDF2 hashing) — used by auth, settings, users, app
    classes/device.js         — Device (stable client ID) — used by auth, storage, app
    components/
      submitButton.js         — used by every feature
      submissionStatusPanel.js — used by submission AND challenges
      weightChart.js          — used by app and submission
dist/
  bundle.js                  — esbuild output
  index.html                 — copied from source/
  sw.js                      — copied from source/
  fonts/                     — copied from source/fonts/
.github/
  copilot-instructions.md    — this file (keep up to date when adding features/components/etc.)
  instructions/
    features/                — per-feature agent instructions
    shared/                  — shared layer agent instructions
```

---

## Feature Ownership vs. Shared (The Orphan Rule)

**Hard rule**: A file belongs in `shared/` only if it is a true orphan — it has no single owning feature and is meaningfully used by two or more unrelated features.

### Decision tree for placing a new file

1. **Is it exclusively used by one feature?** → Put it inside that feature folder.
2. **Is it primarily *about* one feature's domain, even if imported by others?** → Put it in the owning feature folder. Other features import it from there.
3. **Does it genuinely belong to no feature and cross multiple unrelated features?** → Put it in `shared/`.

### Examples

| File | Decision | Reason |
|---|---|---|
| `userTypeEnum.js` | `features/users/enums/` | About users, owned by users feature |
| `appSettingsModel.js` | `features/settings/models/` | About app settings, owned by settings feature |
| `submissionStatusPanel.js` | `shared/components/` | Used by both submission AND challenges — genuine orphan |
| `submitButton.js` | `shared/components/` | Used by every feature — true orphan utility |
| `utils.js` | `shared/utils/` | Cross-cutting utility with no domain ownership |
| `security.js` | `shared/classes/` | Crypto primitives with no single feature owner |
| `leaderboard.js` | `features/submission/components/` | Only submission uses it |
| `qrCode.js` | `features/invites/components/` | Only invites uses it |

### What MUST NOT go in `shared/`

- Anything solely used by one feature
- Domain models for a specific entity (user, round, invite, submission, session, appSettings)
- Feature-specific UI components
- Feature-specific enums

---

## Per-Feature Layout (Required Structure)

Every feature under `source/features/{name}/` **must** follow this structure. Create all applicable subfolders when adding a new feature:

```
classes/
  {name}Service.js       — PUBLIC API (thin wrappers → controller)
  {name}Controller.js    — PRIVATE logic, state, data access
models/
  {name}Model.js         — one ES class per model (create as needed)
pages/
  {pageName}Page.js      — one page per file; exports renderXxxPage + bindXxxEvents
components/
  {component}.js         — feature-specific UI components (create as needed)
enums/
  {name}Enums.js         — feature-specific enums (create as needed)
utils/
  utils.js               — small utility functions (create as needed)
  {complexHelper}.js     — complex helpers in their own file
```

Every feature **must** have both a `{name}Service.js` and a `{name}Controller.js` from the start.

---

## Service / Controller Pattern — Hard Rules

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

### Rules — no exceptions

1. **Cross-feature calls MUST go through `FooService`** — never call `FooController` from outside its own feature folder.
2. **`FooService` contains NO logic** — it is only a thin wrapper that delegates to `FooController`.
3. **`FooController` owns all business logic, state, and data access** for that feature.
4. **External features MUST NOT reach into another feature's controller, model internals, or implementation details** — they only consume the public `FooService` API.
5. **`App` (`appController.js`) coordinates features by calling services** — it is the only caller that may call multiple services in sequence.

---

## Creating New Features — Strict Checklist

Before creating a new feature, confirm:

- [ ] The feature is not a natural extension of an existing feature
- [ ] It has a well-defined, independently testable domain boundary
- [ ] It requires its own data entities or owns distinct business logic

When creating a new feature:

1. Create `source/features/{name}/` with the standard subfolder structure above.
2. Create `{name}Service.js` and `{name}Controller.js` as the first two files.
3. Add any routes to `source/routes.js` and register them in `appController.js`.
4. Register the new feature's pages in `appController.js` (import + render/bind calls).
5. **Update `copilot-instructions.md`** — add the new feature to the Project Layout and to any other relevant sections.

---

## Creating Components, Models, Enums, Utils

### Components

- Determine the owner: which single feature exclusively uses this component?
- If one feature → `features/{name}/components/{component}.js`
- If multiple unrelated features → `shared/components/{component}.js`
- **Update `copilot-instructions.md`** to list the new component in the project layout.

### Models

- Always goes in the owning feature: `features/{name}/models/{entity}Model.js`
- Export as `export class {Entity}Model { constructor(data = {}) { … } }`
- **Update `copilot-instructions.md`** if it is a significant new model.

### Enums

- Always goes in the owning feature: `features/{name}/enums/{name}Enum.js`
- Export as `export const {Name} = Object.freeze({ … })`
- **Update `copilot-instructions.md`** to reflect new enums.

### Utils

- Single-feature utility → `features/{name}/utils/utils.js` (or a named helper file)
- Cross-cutting utility with no owner → `shared/utils/utils.js` or a new file in `shared/utils/`
- **Update `copilot-instructions.md`** if adding new util files.

---

## Keeping copilot-instructions.md Up To Date (Required)

**Every agent session that adds, removes, or renames a feature, component, page, model, enum, util, or class MUST update `copilot-instructions.md` as part of the same commit.**

Specifically:
- Add new features to the Project Layout tree.
- Update component ownership in the layout tree when a component moves.
- Add/remove routes from the routing table if routes change.
- Add new forms to the Forms inventory table.
- Update the Shared section if `shared/` contents change.
- This file is the agent's living knowledge base — keeping it accurate is not optional.

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
| `#/users`, `#/user?id=...`, `#/create_participant`, `#/invites`, `#/invite-detail` | Admin |
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
- Wrap all Firestore read/write calls in try/catch to prevent permission errors from crashing the app.

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
- **ES module imports** — use relative paths. Paths from `features/foo/classes/` to `shared/` need `../../../shared/`. Paths from `features/foo/components/` to the owning feature's classes need `../classes/`.
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
