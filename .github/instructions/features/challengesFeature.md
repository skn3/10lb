---
applyTo: "source/features/challenges/**"
---

# Challenges Feature

The `challenges` feature owns everything related to challenge round lifecycle: creation, editing, deletion, and week finalisation.

## What this feature owns

- **`challengeController.js`** — round CRUD + Domain delegates
- **`challengeService.js`** — public API
- **`roundModel.js`** — `RoundModel` class
- **`roundEnums.js`** — `RoundStatus` enum
- **Pages**: `roundListPage.js`, `createRoundPage.js`, `editRoundPage.js`, `deleteRoundPage.js`, `finishWeekPage.js`

## ChallengeService (public API)

```js
ChallengeService.listRounds()
ChallengeService.createRound(data)
ChallengeService.updateRound(data)
ChallengeService.deleteRound(id)
ChallengeService.buildCreateDefaults(rounds, users)
```

## RoundStatus enum

```js
RoundStatus.PENDING   = 'pending'
RoundStatus.ACTIVE    = 'active'
RoundStatus.COMPLETED = 'completed'
```

## RoundModel fields

| Field | Type | Notes |
|---|---|---|
| id | string | UUID |
| title | string | Display name |
| weeksCount | number | Total weeks |
| holidaysAllowed | number | Max holiday weeks per user |
| entryFee | number | Per-person entry fee |
| startDate | string | ISO date |
| weighDay | number | 0=Sun … 6=Sat |
| participantIds | string[] | User IDs enrolled |
| userNames | string[] | Names at creation time |
| prizeSplits | number[] | Payout per rank |
| payoutMode | string | preset3 \| preset5 \| preset7 \| custom |
| status | RoundStatus | current state |
| completedWeeks | number[] | Weeks with finalised results |

## Pages

### Round List (`roundListPage.js`)
- Route: `#/rounds`
- Renders all rounds with progress + prize pool; click a round to navigate `#/overview`
- Bind: `[data-open-round]` — sets `app.state.selectedRoundId`

### Create Round (`createRoundPage.js`)
- Route: `#/create`
- Form id: `create-form`
- Manages `app.state.createDraft` for real-time payout calculator
- Validates prize sum ≤ prize pool

### Edit Round (`editRoundPage.js`)
- Route: `#/edit`
- Form id: `edit-form`
- Only allows title + prize splits to be edited
- Uses `app._saveWithConflictResolver()`

### Delete Round (`deleteRoundPage.js`)
- Route: `#/delete`
- Form id: `delete-form`
- Requires checkbox confirmation

### Finish Week (`finishWeekPage.js`)
- Route: `#/finish-week`
- Form id: `finish-week-form`
- Appends current week number to `round.completedWeeks`
- Triggers overview week advance

## Coding notes

- Only one active round is allowed at a time — `Domain.activeRound()` enforces this.
- Prize splits are stored as raw currency amounts, not percentages.
- `buildCreateDefaults()` seeds form from the most recent round for continuity.
- The payout calculator in `createRoundPage.js` uses `app.state.createDraft` for live re-render; clear draft after successful save.
