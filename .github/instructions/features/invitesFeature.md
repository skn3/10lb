---
applyTo: "source/features/invites/**"
---

# Invites Feature

The `invites` feature manages invite code generation, sharing, and consumption for Firebase mode.

## What this feature owns

- **`invitesController.js`** — invite CRUD + Firebase invite helpers
- **`invitesService.js`** — public API
- **`inviteModel.js`** — `InviteModel` class
- **`inviteCodeUtils.js`** — `generateInviteCode()` utility
- **Pages**: `invitesPage.js`, `inviteDetailPage.js`

## InvitesService (public API)

```js
InvitesService.listInvites()
InvitesService.createInvite(invite)
InvitesService.deleteInvite(id)
InvitesService.deleteAllPendingInvites(invites)
```

## InviteModel fields

| Field | Type | Notes |
|---|---|---|
| id | string | Same as code |
| code | string | 8-char unambiguous uppercase code |
| inviteType | string | `user` \| `admin` |
| userId | string \| null | Pre-linked user ID (set when invited via user admin) |
| createdAt | string | ISO timestamp |
| usedAt | string \| null | Set when invite is accepted |
| usedBy | string \| null | User ID of the accepting user |
| usedByFirebaseUid | string \| null | Firebase UID of the accepting user |

## generateInviteCode

```js
import { generateInviteCode } from '../utils/inviteCodeUtils.js';
const code = generateInviteCode(); // returns 8-char string e.g. "H3KXMP4N"
```

Uses rejection sampling over `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (excludes ambiguous chars `0O1I`) to avoid modulo bias.

## Pages

### Invites page (`invitesPage.js`)
- Accessible via Users → actions
- Lists pending and used invites in separate sections
- Actions: create invite, view invite (→ invite detail), delete invite, delete all pending
- `btn-create-invite` creates a new standalone invite (not pre-linked to a user)

### Invite detail page (`inviteDetailPage.js`)
- Route: `#/invite-detail`
- Displays QR code (attached via `InviteQRCode.attach()`), code display, copyable invite link
- Actions: copy link, create another invite, delete this invite
- QR code is generated after render via `InviteQRCode.attach(inviteLink)`

## Invite flow (Firebase mode)

1. Admin creates invite (standalone or via User admin → "Invite as user/admin").
2. Invite stored in both IndexedDB (`Data.adapter.createInvite`) and Firestore (`AuthController.saveFirebaseInvite`).
3. Admin shares invite link with recipient (QR code or copyable URL: `#/join?invite=CODE`).
4. Recipient visits join page, enters code + creates account → invite `usedAt` set, user record activated.

## Coding notes

- Invites are unavailable in offline mode — all invite methods silently no-op without Firebase.
- `app.state.inviteDetail` holds the invite being viewed on the invite-detail page.
- Invite IDs are equal to the invite code (8-char string used as Firestore document ID).
- When an admin creates a user-targeted invite, the user's `userType` is updated to the intended invite type (`user` or `admin`) and `canLogin: true`.
