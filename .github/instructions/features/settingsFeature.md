---
applyTo: "source/features/settings/**"
---

# Settings Feature

The `settings` feature handles all app configuration: user profile, server settings, and storage/sync settings.

## What this feature owns

- **`settingsController.js`** — save profile, save server settings, change password, reset server
- **`settingsService.js`** — public API
- **Components**: `userSettingsTab.js`, `serverSettingsTab.js`, `syncSettingsTab.js`
- **Pages**: `settingsPage.js`

## SettingsService (public API)

```js
SettingsService.saveUserProfile(currentUser, firstName, lastName)
SettingsService.saveAppSettings(appSettings, updates)
SettingsService.changeOfflinePassword(currentUser, currentPassword, newPassword, Security)
SettingsService.resetServer(isFirebaseMode, FirestoreAdapter, SyncEngine)
```

## Settings page

- Route: `#/settings`
- Three tabs: User settings, Server settings (admin only), Storage & Sync (master + Firebase only)
- Tab state stored on `app.state.settingsTab`
- Each tab is a separate component rendered into the page card

## Forms

| Form ID | Tab | Purpose |
|---|---|---|
| `user-settings-form` | User | Update first/last name |
| `user-password-form` | User | Change password |
| `server-settings-form` | Server | Server name, weight format, currency, theme, session days |
| `server-reset-form` | Server | Uninstall / reset server |
| `firebase-config-form` | Sync | Read-only Firebase config display + test connection button |

## Tab components

### User settings tab (`userSettingsTab.js`)

Renders profile form + password change form. Password change:
- Firebase mode: calls `FirestoreAdapter.signInWithEmail()` to re-authenticate, then `FirestoreAdapter.updatePassword()`
- Offline mode: calls `Security.verifyPassword()` + `Security.createPasswordRecord()`, then saves via `SettingsService`

### Server settings tab (`serverSettingsTab.js`)

Renders server settings form + server reset section. Only visible to admins. Reset section only visible to master.

Server reset flow:
1. Re-authenticate (Firebase: `signInWithEmail`; offline: `Security.verifyPassword`)
2. Call `SettingsService.resetServer()` which: stops SyncEngine, resets Firestore, clears IndexedDB, deletes Firebase Auth user
3. Clear `app.state.currentUser`, `sessionToken`, navigate to default route

### Sync settings tab (`syncSettingsTab.js`)

Displays sync status badge, storage mode, last sync time, active session count. Shows `SyncButton` when in online mode. Read-only Firebase config panel with test connection button.

Test connection calls `AuthController.testFirebaseConnection(cfg)` and displays result.

## Coding notes

- `ThemeOptions` array is defined locally in `settingsPage.js` — do not import from constants.
- The `server-settings-form` shows Firebase config fields but they are all `disabled` (read-only from `config.js`).
- After saving server settings, if offline and session token exists, refresh the `tenlb_session` cookie with the new `sessionDurationDays`.
- Reset server also calls `Utils.clearCookie('tenlb_session')` and replaces the history state.
