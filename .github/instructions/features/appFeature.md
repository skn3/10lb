---
applyTo: "source/features/app/**"
---

# App Feature

The `app` feature is the **core orchestrator** of the application. It owns `App` (the single application object), all lifecycle methods, routing, rendering, navigation, and cross-cutting UI helpers.

## What this feature owns

- **`appController.js`** — the `App` object: `init()`, `render()`, `refresh()`, `navigate()`, `resolveScreen()`, `bindScreenEvents()`, `attachNav()`, `loginAs()`, `logout()`, and all helpers.
- **`appService.js`** — re-exports `App` for `main.js`.
- **Pages**: `deniedPage.js`, `installPage.js`, `loginPage.js`, `joinPage.js`.
- **Utils**: form/button helpers in `utils/utils.js`.

## App object

`App` is a plain object (not a class). It is the single source of truth for all mutable state.

### State shape

```js
App.state = {
  route, message, error, rounds, users, submissions, invites, sessions,
  selectedRoundId, weekCursor, createDraft, settingsTab,
  currentUser, appSettings, sessionToken, redirectAfterLogin,
  selectedUsers, selectedUserId, syncMeta, inviteDetail, pendingInviteCode, userFilters
}
```

### Key lifecycle methods

| Method | Purpose |
|---|---|
| `App.init()` | Load config, open DB, create plugin, restore session, render |
| `App.refresh()` | Reload all state collections from IndexedDB |
| `App.render()` | Attach nav, resolve screen, write to DOM, bind events |
| `App.navigate(route, opts)` | Update hash + re-render |
| `App.resolveScreen()` | Map `state.route` to a page render function |
| `App.bindScreenEvents()` | Bind all DOM event handlers after render |
| `App.loginAs(user)` | Set currentUser, call plugin.onLogin |
| `App.logout()` | Clear session, navigate to default route |

### Delegation pattern

`App` does **not** contain business logic — it delegates:
- Page rendering → imported `renderXxxPage(app)` functions from feature pages.
- Event binding → imported `bindXxxEvents(app)` functions from feature pages.
- Business logic → feature services (e.g. `ChallengeService`, `SubmissionService`).
- Auth → `AuthService` / plugin.

## Pages

Each page module exports two functions:
```js
export function renderXxxPage(app) { /* returns HTML string */ }
export function bindXxxEvents(app) { /* binds DOM events after render */ }
```

### Install page (`installPage.js`)
- Form id: `install-form`
- Calls `app.plugin.canInstall()` before proceeding
- Uses `AuthService.provisionFirebaseMaster()` in Firebase mode
- Calls `app.loginAs()` after success

### Login page (`loginPage.js`)
- Form id: `login-form`
- Firebase mode: calls `FirestoreAdapter.signInWithEmail()` then `AuthService.resolveFirebaseUser()`
- Offline mode: calls `Security.verifyPassword()` then `app.loginAs()`

### Join page (`joinPage.js`)
- Form id: `join-form`
- Only meaningful in Firebase mode; offline shows "Registration unavailable"
- Validates invite code, creates Firebase Auth account, activates invited user

### Denied page (`deniedPage.js`)
- Stateless — no `app` parameter needed

## Form helpers (`utils/utils.js`)

| Function | Purpose |
|---|---|
| `applyFormCustomValidity(form, fieldLabelFn)` | Set HTML5 custom validity messages |
| `prepareFormFields(form, fieldErrorSlotFn)` | Assign ids, link labels, create error slots |
| `fieldLabel(field)` | Get human-readable label for a field |
| `fieldErrorSlot(field)` | Ensure `<div class="field-error">` slot exists |
| `fieldValidationMessage(field, labelFn)` | Get user-friendly validation message |
| `setFieldValidation(field, message)` | Toggle error class + fill error slot |
| `clearFormValidation(form)` | Clear all validation state on a form |
| `enhanceFormValidation(form)` | Bind real-time validation (idempotent) |
| `validateForm(form, failFn)` | Full validate — highlights fields, returns boolean |

## Button helpers (`utils/utils.js`)

| Function | Purpose |
|---|---|
| `buttonLabelText(button)` | Get visible label text of a button |
| `enhanceButtons(iconForButtonFn)` | Add icon + label spans to all buttons |
| `setButtonLabel(button, label, iconFn)` | Update visible label |
| `setButtonBusy(button, busy, iconFn)` | Show/hide spinner; returns release function |

## Coding notes

- `App._renderDenied()` is a convenience alias for `renderDeniedPage()` used inside `appController.js`.
- `App._saveWithConflictResolver(kind, attempted, saveFn)` handles optimistic-concurrency conflicts for all features.
- `App.bindAsyncFormSubmit(form, handler)` wraps every form submission with validation, sync-wait, busy state, and error handling.
- `App.iconForButton(button)` maps button ids/data attributes to Material Symbol icon names.
- All form submit handlers must go through `App.bindAsyncFormSubmit()` — **never** attach raw `form.onsubmit`.
