---
applyTo: "source/shared/models/**"
---

# Shared Models

Models shared across multiple features.

## `shared/enums/userTypeEnum.js` — UserType

```js
import { UserType } from '../../shared/enums/userTypeEnum.js';

UserType.MASTER      = 'master'
UserType.ADMIN       = 'admin'
UserType.USER        = 'user'
UserType.PARTICIPANT = 'participant'
```

Used by authentication, users, and invites features.

## `shared/models/appSettingsModel.js` — AppSettingsModel

Represents the application-wide settings stored under `settings['app']` in IndexedDB.

```js
class AppSettingsModel {
  constructor({
    installed = false,
    serverName = '10lb Challenge',
    weightFormat = 'lb',
    currency = '£',
    theme = 'teal',
    sessionDurationDays = 7,
    installLockedAt = null,
    updatedAt = null
  })
}
```

`Data.adapter.getAppSettings()` returns a plain object matching this shape (not a class instance). Use the class for documentation and type reference only.

## Coding conventions

- Shared models and enums are used when the same data structure appears in 2+ features.
- Feature-specific models live in `source/features/{name}/models/`.
- All model classes use plain `constructor({ field = default, ... })` pattern.
- Enum objects use `Object.freeze({})` to prevent mutation.
