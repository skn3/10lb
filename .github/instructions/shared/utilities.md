---
applyTo: "source/shared/utils/**, source/shared/classes/**"
---

# Shared Utilities and Classes

Shared pure utilities and helper classes used across multiple features.

## `shared/utils/utils.js` — Utils

General-purpose utility functions. Always import from this path:
```js
import { Utils } from '../../shared/utils/utils.js';
```

### String / HTML

| Function | Purpose |
|---|---|
| `Utils.esc(str)` | HTML-escape a string for safe `innerHTML` insertion |
| `Utils.escAttr(str)` | HTML-escape a string for safe `attribute="..."` insertion |
| `Utils.fullName(user)` | `user.firstName + ' ' + user.lastName` |
| `Utils.parseName(fullName)` | Split "First Last" into `{ firstName, lastName }` |

**All user-supplied values MUST be passed through `Utils.esc()` or `Utils.escAttr()` before placing in innerHTML.**

### Validation

| Function | Purpose |
|---|---|
| `Utils.validEmail(str)` | Returns true if str is a valid email address |
| `Utils.validPassword(str)` | ≥8 chars, includes letter, number, symbol |
| `Utils.passwordInputAttrs(autocomplete)` | Returns HTML attributes string for password fields |

### Numbers / Money

| Function | Purpose |
|---|---|
| `Utils.safeNum(val, fallback)` | Parse number; returns fallback (default 0) on NaN |
| `Utils.round2(n)` | Round to 2 decimal places |
| `Utils.pct(n, total)` | Percentage string |
| `Utils.money(amount, currency)` | Format as currency string (e.g. `£10.00`) |

### Dates

| Function | Purpose |
|---|---|
| `Utils.dateTime(iso)` | Format ISO timestamp as human-readable string |
| `Utils.date(iso)` | Format ISO date string |
| `Utils.weekdayName(dayIndex)` | 0=Sunday … 6=Saturday |

### IDs / Tokens

| Function | Purpose |
|---|---|
| `Utils.id()` | Generate a random UUID v4 |

### Cookies

| Function | Purpose |
|---|---|
| `Utils.getCookie(name)` | Read a cookie value |
| `Utils.setCookie(name, value, days)` | Set a cookie with expiry |
| `Utils.clearCookie(name)` | Delete a cookie |

## `shared/classes/security.js` — Security

Password hashing and verification using PBKDF2-SHA-256 (100k iterations).

```js
Security.createPasswordRecord(password) → Promise<string>
// Returns "v1:salt:hash" string

Security.verifyPassword(password, record) → Promise<boolean>
// Verifies against the stored "v1:salt:hash" record

Security.sessionToken() → string
// Returns a random 32-byte hex string
```

Only used in offline mode. Firebase Auth manages passwords in Firebase mode.

## `shared/classes/device.js` — Device

```js
Device.getId() → string
// Returns a stable per-browser client ID stored in localStorage
// Key: 'tenlb_clientId'
```

Used as part of the Firebase session ID: `${userId}:${Device.getId()}`.

## Coding conventions

- `Utils.esc()` and `Utils.escAttr()` are **mandatory** for all user-supplied data in HTML strings.
- Do not add new utility functions to `utils.js` unless they are used by 2+ features.
- Feature-specific utilities belong in `source/features/{name}/utils/utils.js`.
- `Security` methods are async (return Promises) — always await them.
