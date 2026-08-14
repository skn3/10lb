# 10lb Challenge

## Project layout

```
source/             — public files compiled and deployed to GitHub Pages
  index.html        — application shell
  sw.js             — service worker
  fonts/            — self-hosted WOFF2 fonts
config.json         — runtime configuration (deployed separately, see below)
firestore.rules     — Firestore security rules
firestore.indexes.json — Firestore composite indexes
FIREBASE_SETUP.md   — Firebase project setup guide
README.md           — this file
```

The GitHub Actions workflow (`static.yml`) uses **esbuild** to bundle JavaScript files from `source/` into a single bundle, then deploys a hard-coded whitelist of files (`index.html`, `sw.js`, `fonts/`, bundle) to the GitHub Pages root. `config.json` must be deployed manually alongside the app or via your hosting provider — it is not bundled.

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
