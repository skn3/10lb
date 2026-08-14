---
applyTo: "source/features/users/**"
---

# Users Feature

The `users` feature handles user listing, individual user admin, type management, password reset, and participant creation.

## What this feature owns

- **`usersController.js`** — user CRUD + role/login label helpers
- **`usersService.js`** — public API
- **`userModel.js`** — `UserModel` class
- **Pages**: `usersPage.js`, `userAdminPage.js`, `createParticipantPage.js`

## UsersService (public API)

```js
UsersService.listUsers()
UsersService.getUserById(id)
UsersService.createUser(data)
UsersService.updateUser(data)
UsersService.deleteUser(id)
UsersService.roleLabel(user)
UsersService.userLoginLabel(user)
UsersService.managedUserTypeOptions(user)
```

## UserModel fields

| Field | Type | Notes |
|---|---|---|
| id | string | UUID |
| username | string | Email address (login handle) |
| firstName | string | |
| lastName | string | |
| password | string \| null | PBKDF2 hash (offline only; null in Firebase mode) |
| userType | string | master / admin / user / participant |
| isAdmin | boolean | |
| isMaster | boolean | |
| canLogin | boolean | false for participants |
| firebaseUid | string \| null | Firebase Auth UID |
| inviteCode | string \| null | Invite code used to register |
| invitedAt | string \| null | ISO timestamp of invite creation |
| inviteAcceptedAt | string \| null | ISO timestamp of account activation |
| lastLoginAt | string \| null | |

## Pages

### Users page (`usersPage.js`)
- Route: `#/users`
- Lists users + pending invites with filterable/sortable table
- Filters: type, status (invited/confirmed), current-challenge-only, search, sort
- Bulk operations: bulk-delete selected users
- Invite row actions: view-invite, delete-invite (handled via `data-user-action-apply`)
- Click user row → navigate `#/user?id=...`

### User admin page (`userAdminPage.js`)
- Route: `#/user?id=...`
- Forms: `edit-user-form` (name), `user-type-form` (role)
- Actions: reset password, send invite (Firebase), view pending invites, delete user
- Password reset: Firebase mode → `FirestoreAdapter.sendPasswordResetEmail()`; offline mode → `Security.createPasswordRecord()`
- Role changes protected: cannot demote self, cannot change master type

### Create participant page (`createParticipantPage.js`)
- Route: `#/create_participant`
- Form id: `create-participant-form`
- Accepts full name; splits into first/last via `Utils.parseName()`
- Created with `canLogin: false`, `userType: 'participant'`

## managedUserTypeOptions

Returns the set of user types an admin can assign to a given user:

| User current state | Options returned |
|---|---|
| `isMaster` | `[master]` (locked) |
| has no login credentials | `[participant]` only (cannot promote without login) |
| has login credentials | `[participant, user, admin]` |

## Coding notes

- Master user cannot be deleted or have their type changed.
- Admin cannot demote their own account from `admin`.
- Participants without `firebaseUid` appear in the users list but cannot log in.
- Filter state is stored on `app.state.userFilters` and persists across re-renders.
- The users page merges `app.state.users` + pending-invite rows from `app.state.invites` into a unified display list.
