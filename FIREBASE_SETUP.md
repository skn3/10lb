# Firebase Setup Guide — 10lb Challenge

## Overview

The application supports two runtime auth modes:

- **Offline** — auth is fully local. The master account email, password hash, and sessions live in IndexedDB.
- **Firebase** — Firebase Email/Password is the real auth provider. Firestore stores shared app data plus invite/session records used by the admin UI.

## Important security model

- Firebase **web config values are not secrets**. They are safe to ship in `config.json`.
- **Do not** put a Firebase service-account key or Admin SDK credential into this repository or the browser app.
- Offline password hashes stay local in IndexedDB. Firestore must not store them.

## Step 1 — Create a Firebase project

1. Go to <https://console.firebase.google.com>.
2. Create a project.
3. Disable Google Analytics unless you need it.

## Step 2 — Enable Firestore

1. Open **Build → Firestore Database**.
2. Create the database in production mode.
3. Choose a region near your users.

## Step 3 — Enable Email/Password Authentication

1. Open **Build → Authentication**.
2. Click **Get started**.
3. Under **Sign-in providers**, enable **Email/Password**.

This mode is required for:
- master-account install
- admin/user login
- invite-based account activation

## Step 4 — Deploy Firestore Security Rules

The security rules live in `/home/runner/work/10lb/10lb/firestore.rules`.

### Using the Firebase CLI

```bash
npm install -g firebase-tools
firebase login
firebase init firestore
firebase deploy --only firestore:rules
```

### Via the Firebase console

1. Open **Firestore → Rules**.
2. Paste in the contents of `firestore.rules`.
3. Publish the rules.

## Step 5 — Deploy Firestore Indexes

The composite indexes live in `/home/runner/work/10lb/10lb/firestore.indexes.json`.

```bash
firebase deploy --only firestore:indexes
```

## Step 6 — Understand bootstrap behavior

In `serverMode: "firebase"`:

1. The install screen creates the master Firebase Auth account.
2. The app signs that user in immediately.
3. The install flow writes the master admin/user records and completes setup.

The first signed-in master user bootstraps the initial admin record in Firestore. After that, admin access is controlled by the `/admins` collection and the deployed rules.

## Step 7 — Get your Firebase web configuration

1. Open **Project settings**.
2. Add a **Web app**.
3. Copy the `firebaseConfig` values.

## Step 8 — Deploy `config.json`

Create `/config.json` beside the static app files:

```json
{
  "serverMode": "firebase",
  "firebase": {
    "apiKey": "AIzaSy...",
    "authDomain": "your-project.firebaseapp.com",
    "projectId": "your-project",
    "storageBucket": "your-project.appspot.com",
    "messagingSenderId": "123456789",
    "appId": "1:123456789:web:abc123"
  }
}
```

## Firestore data structure

```text
/challenges/
  default/
    admins/
      {firebaseUid}
    users/
      {userId}
    invites/
      {inviteCode}
    sessions/
      {sessionId}
    rounds/
      {roundId}
    submissions/
      {submissionId}
```

### Notes

- `users` holds profile/account metadata used by the app UI.
- `invites` holds pending and consumed invite records.
- `sessions` holds active Firebase-backed session records for admin visibility.
- `password` must never be written to Firestore.

## Invite flow

In Firebase mode:

1. An admin creates an invite.
2. The invite link opens `#/join`.
3. The invited user enters email and password.
4. The app creates the Firebase Auth account and marks the invite as used.
5. The new user is signed in immediately.

## Troubleshooting

| Problem | Solution |
|---|---|
| Login fails | Confirm Email/Password auth is enabled |
| Invite link says invalid | Check the Firestore invite record exists and has not been used |
| Rules rejected error | Re-deploy `firestore.rules` |
| Test Connection fails | Check API key, auth domain, and project ID |
| App falls back to offline behavior | Verify `config.json` is deployed and readable |
