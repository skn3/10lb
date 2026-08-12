# Firebase Setup Guide — 10lb Challenge

## Overview

The 10lb Challenge application works **completely offline without Firebase**. Firebase is
entirely optional and only used when you explicitly enable Online Mode.

This guide covers setting up Firebase for the optional cloud synchronisation feature.

---

## Important: Security model

The application uses its own PBKDF2 password-based login system. Firebase is used
only for:

1. **Firestore** — shared cloud storage for challenge data.
2. **Firebase project configuration** — used to connect this browser app to your
   Firestore database.

**Password hashes are never sent to Firebase.** They remain in IndexedDB only.

### Client-side Firebase configuration is not a secret

The Firebase API key, project ID, and other config values in the Settings → Storage
& Sync tab are standard **web client configuration**. They are safe to store locally
and do not grant admin access to your Firebase project.

**Never put a Firebase service-account private key or Admin SDK credential into this
application.** Those are server-side secrets and have no place in a browser application.

---

## Step 1 — Create a Firebase project

1. Go to <https://console.firebase.google.com>.
2. Click **Add project**.
3. Give it a name (e.g. `10lb-challenge`).
4. Disable Google Analytics if you don't need it.
5. Click **Create project**.

---

## Step 2 — Enable Firestore

1. In the Firebase console, go to **Build → Firestore Database**.
2. Click **Create database**.
3. Choose **Start in production mode** (the security rules in this repo enforce access).
4. Choose a region close to your users.

---

## Step 3 — Authentication provider setup is not required

This app no longer uses Firebase Anonymous Authentication.

- You do **not** need to enable any Firebase Authentication sign-in provider for this setup.
- If Anonymous Auth is currently enabled in an older project, it can be left on or
  disabled; the app does not depend on it anymore.

---

## Step 4 — Deploy Firestore Security Rules

The security rules are in `firestore.rules` in this repository.

### Using the Firebase CLI

```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # select your project, use existing firestore.rules
firebase deploy --only firestore:rules
```

### Manually via the console

1. Go to **Firestore → Rules**.
2. Copy the contents of `firestore.rules` and paste them into the editor.
3. Click **Publish**.

---

## Step 5 — Deploy Firestore Indexes

The composite indexes are in `firestore.indexes.json`.

```bash
firebase deploy --only firestore:indexes
```

Or create them manually in the Firebase console under **Firestore → Indexes**.

---

## Step 6 — Create admin entries in Firestore

When Online Mode is first enabled, the master admin's Firebase UID must be added to
Firestore so that Firestore Security Rules grant admin access.

**During initial sync**, the application automatically writes the authenticated user's
Firebase UID into the `/challenges/default/admins/{firebaseUid}` document if they are
a master admin. This happens automatically — no manual setup needed for the first
master admin.

For additional admins, you can also add entries manually in the Firebase console:

```
Collection: challenges/default/admins
Document ID: {firebaseUid of the admin's browser session}
Fields: { grantedAt: "2026-08-11T00:00:00Z" }
```

---

## Step 7 — Get your Firebase web configuration

1. In the Firebase console, go to **Project settings** (gear icon).
2. Under **Your apps**, click **Add app → Web**.
3. Register the app (any nickname, e.g. `10lb-web`).
4. Copy the `firebaseConfig` object — it looks like:

```js
{
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
}
```

---

## Step 8 — Enter the configuration in the app

1. Open the 10lb Challenge app.
2. Log in as an admin.
3. Go to **Settings → Storage & Sync**.
4. Scroll down to **Firebase Configuration**.
5. Enter the values from Step 7.
6. Click **Test Connection** to verify.
7. Click **Save Config** to enable Online Mode.

---

## Firestore data structure

```
/challenges/
  default/
    admins/
      {firebaseUid}   → { grantedAt }
    users/
      {userId}        → User record (NO password field)
    rounds/
      {roundId}       → Round record
    submissions/
      {submissionId}  → Submission record
```

All records include sync metadata:
- `id` — UUID (same as local IndexedDB id)
- `version` — incrementing integer for optimistic concurrency
- `createdAt`, `updatedAt` — ISO 8601 UTC timestamps
- `createdBy`, `updatedBy` — local userId of the creator/last editor
- `clientId` — browser installation ID
- `deletedAt` — null if active, ISO timestamp if soft-deleted
- `firebaseUid` — (on users) the Firebase Anonymous Auth UID for this user's device

---

## Conflict resolution strategy

| Scenario | Resolution |
|---|---|
| Two devices create different records | Both records coexist (different UUIDs) |
| Same record, remote version higher | Remote wins |
| Same record, local version higher | Local wins (uploaded on next sync) |
| Same version, different content | Latest `updatedAt` wins; ties broken by `min(clientId)` |
| Tombstone vs update | Tombstone (`deletedAt`) wins if its `updatedAt` ≥ the update's `updatedAt` |
| Two admins edit same round | Version conflict detected; later write wins by `updatedAt` |

---

## Disabling Online Mode

You can return to Local Mode at any time via **Settings → Storage & Sync → Local**.

If you have unsynchronised changes, the app will warn you. All local data is preserved.
You can re-enable Online Mode later and the pending changes will be uploaded.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Test Connection fails | Check API key, auth domain, project ID, and Firestore availability |
| Rules rejected error | Re-deploy `firestore.rules` |
| Sync stuck in error | Click "↻ Retry sync" in the Storage & Sync settings |
| App crashes on startup | Firebase config is invalid; open browser console and check the error |

The app **never crashes in Local Mode** due to Firebase problems. If Online Mode
fails during startup, it falls back to Local Mode automatically.
