# 10lb Challenge

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

- The app uses hash routing for all in-app navigation (`#/login`, `#/join`, `#/overview`, etc.) so it works on GitHub Pages static hosting.
- All form submissions are handled in JavaScript and prevented from native URL redirects.

## User types

Supported account types:

- `master` (single account)
- `admin`
- `user`
- `participant` (non-login until invited in Firebase mode)

Users and invites are managed in a unified Users screen with filter, sort, and search controls.
