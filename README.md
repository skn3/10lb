# 10lb Challenge

## Runtime configuration

The app now reads `/config.json` at startup. This file must be deployed with the static files.

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

- `serverMode: "offline"` → no invites, no Firebase UI/actions, participant-focused local operation.
- `serverMode: "firebase"` → online mode with Firebase sync and invite-based onboarding.

Server mode and Firebase values are read-only in the app UI and cannot be edited from settings.

## Installation lock

- Initial setup is available only when the app is not installed.
- Use `/install` (or legacy `?setup=1`) for first-time setup.
- After installation, setup is locked and future `/install` access is rejected.

## User types

Supported account types:

- `master` (single account)
- `admin`
- `user`
- `participant` (non-login)

Users and invites are managed in a unified Users screen with filter, sort, and search controls.
