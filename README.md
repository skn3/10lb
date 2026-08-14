# 10lb Challenge

## Project layout

```
source/                     — JavaScript source (bundled by esbuild)
  main.js                   — entry point
  app.js                    — legacy monolith (kept for reference; replaced by features/app/)
  config.js                 — RuntimeConfig loader
  domain.js                 — pure business logic (no side effects)
  constants.js              — ThemeOptions and other compile-time constants
  routes.js                 — allowed route names
  shared/                   — code shared across multiple features
    classes/
      security.js           — PBKDF2 password hashing + session token
      device.js             — stable per-browser client ID
    components/             — shared React / innerHTML UI components
    enums/
      userTypeEnum.js       — UserType frozen enum
    models/
      appSettingsModel.js   — AppSettingsModel class
    utils/
      utils.js              — pure utility functions (esc, fullName, validEmail, …)
  features/
    app/                    — core App orchestrator
      classes/
        appController.js    — thin App object (init, render, navigate, state)
        appService.js       — re-exports App for main.js
      pages/
        deniedPage.js       — #/denied
        installPage.js      — #/install
        loginPage.js        — #/login
        joinPage.js         — #/join
      utils/
        utils.js            — form helpers + button helpers
    authentication/         — auth plugins + Firebase auth helpers
      classes/
        serverPlugin.js     — abstract plugin base
        offlinePlugin.js    — offline session management
        firebasePlugin.js   — Firebase auth session management
        authController.js   — Firebase helpers (loadSDK, resolveUser, sessions, …)
        authService.js      — public API
      models/
        sessionModel.js
    challenges/             — round CRUD + pages
      classes/
        challengeController.js
        challengeService.js
      enums/
        roundEnums.js       — RoundStatus
      models/
        roundModel.js
      pages/
        roundListPage.js, createRoundPage.js, editRoundPage.js,
        deleteRoundPage.js, finishWeekPage.js
    submission/             — weight/holiday/forfeit submission + overview
      classes/
        submissionController.js
        submissionService.js
      enums/
        submissionEnums.js  — SubmissionType
      models/
        submissionModel.js
      pages/
        overviewPage.js, submitPage.js
    users/                  — user admin + participant management
      classes/
        usersController.js
        usersService.js
      models/
        userModel.js
      pages/
        usersPage.js, userAdminPage.js, createParticipantPage.js
    invites/                — invite CRUD + QR/link sharing
      classes/
        invitesController.js
        invitesService.js
      models/
        inviteModel.js
      pages/
        invitesPage.js, inviteDetailPage.js
      utils/
        inviteCodeUtils.js  — generateInviteCode() with rejection sampling
    settings/               — user, server, and sync settings
      classes/
        settingsController.js
        settingsService.js
      components/
        userSettingsTab.js, serverSettingsTab.js, syncSettingsTab.js
      pages/
        settingsPage.js
    storage/                — IndexedDB + Firestore adapters + sync engine
      classes/
        offlineAdapter.js
        firestoreAdapter.js
        syncEngine.js
      models/
        data.js             — Data singleton (active adapter reference)
  index.html                — application shell (HTML + CSS)
  sw.js                     — service worker (cache-first, network fallback)
  fonts/                    — self-hosted WOFF2 fonts
dist/                       — compiled output (generated, not committed)
  bundle.js                 — esbuild output
  index.html, sw.js, fonts/ — copied from source/
config.json                 — runtime configuration (deployed separately, see below)
firestore.rules             — Firestore security rules
firestore.indexes.json      — Firestore composite indexes
FIREBASE_SETUP.md           — Firebase project setup guide
README.md                   — this file
```

The GitHub Actions workflow (`static.yml`) uses **esbuild** to bundle JavaScript files from `source/` into a single `dist/bundle.js`, then deploys a whitelist of files (`index.html`, `sw.js`, `fonts/`, bundle) to the GitHub Pages root. `config.json` must be deployed manually alongside the app or via your hosting provider — it is not bundled.

### Build command

```bash
esbuild source/main.js --bundle --format=iife --outfile=dist/bundle.js
```

## Runtime configuration

The app reads `/config.json` at startup. This file must be deployed with the static files.

```json
{
  "serverMode": "offline",
  "firebase": {
    "apiKey": "",
    "authDomain": "",
    "projectId": "",
    "storageBucket": "",
    "messagingSenderId": "",
    "appId": ""
  }
}
```

- `serverMode: "offline"` → local-only operation. The master account is stored in IndexedDB, passwords are verified locally, and sessions use the `tenlb_session` cookie plus IndexedDB session records.
- `serverMode: "firebase"` → Firebase Email/Password is the real auth provider. Firestore stores users, invites, and active session records for the admin UI.

Server mode and Firebase values are read-only in the app UI and cannot be edited from settings.

## Installation lock

- Initial setup is available only when the app is not installed.
- Use `#/install` for first-time setup.
- After installation, setup is locked and future `#/install` access is rejected.

## Routing and forms

- The app uses hash routing for all in-app navigation (`#/login`, `#/join`, `#/overview`, `#/create_participant`, `#/user?id=...`, etc.) so it works on GitHub Pages static hosting.
- All form submissions are handled in JavaScript and prevented from native URL redirects.

## User types

Supported account types:

- `master` (single account)
- `admin`
- `user`
- `participant` (non-login until invited in Firebase mode)

Users and invites are managed from the Users screen, with dedicated admin pages for creating participants and managing individual users.
