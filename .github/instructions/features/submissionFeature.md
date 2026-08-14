---
applyTo: "source/features/submission/**"
---

# Submission Feature

The `submission` feature handles weekly weigh-in recording (weight, holiday, forfeit), the overview leaderboard, and user stats.

## What this feature owns

- **`submissionController.js`** — submission CRUD + userStats + Domain delegates
- **`submissionService.js`** — public API
- **`submissionModel.js`** — `SubmissionModel` class
- **`submissionEnums.js`** — `SubmissionType` enum
- **Pages**: `overviewPage.js`, `submitPage.js`

## SubmissionService (public API)

```js
SubmissionService.listSubmissions()
SubmissionService.recordSubmission(submission, snapshot)
SubmissionService.userStats(user, rounds, submissions, users)
SubmissionService.activeRound(rounds)
SubmissionService.currentWeek(round, users, submissions)
SubmissionService.weekView(round, users, submissions, week)
```

## SubmissionType enum

```js
SubmissionType.WEIGHT  = 'weight'
SubmissionType.HOLIDAY = 'holiday'
SubmissionType.FORFEIT = 'forfeit'
```

## SubmissionModel fields

| Field | Type | Notes |
|---|---|---|
| id | string | UUID |
| roundId | string | Parent round |
| userId | string | Submitting user |
| weekNumber | number | 1-based week index |
| type | SubmissionType | weight / holiday / forfeit |
| weight | number \| null | Weight value (only for type=weight) |
| photoName | string \| null | Photo filename (optional) |
| createdAt | string | ISO timestamp |

## Pages

### Overview (`overviewPage.js`)
- Route: `#/overview`
- Displays round header, week pager, start weights (week 1), leaderboard (week 2+), and final winners
- Bind: `[data-week-nav]` — week cursor navigation; `[data-open-round]` — round selection
- Weight chart attached via `App._attachWeightChart()` after render

### Submit (`submitPage.js`)
- Route: `#/submit`
- Form id: `submit-form`
- Normal users: see only their own row; admins: select any eligible user
- `updateSubmitUI()` called on change to show/hide weight fields and forfeit confirmation
- After successful submission: checks if all users submitted and round is complete → auto-complete round to `status: 'completed'`
- Calls `SubmissionService.recordSubmission()` which writes both submission + weekly snapshot atomically

## userStats

`SubmissionService.userStats(user, rounds, submissions, users)` returns:

```js
{
  roundsParticipated: number,   // rounds with submissions or participation
  totalCashWon: number,         // sum of prizes from completed rounds
  totalWeightDelta: number,     // sum of (firstWeight - latestWeight) across completed rounds
  inCurrentRound: boolean       // user enrolled in the active round
}
```

## Coding notes

- Submissions for a given week are irreversible once the week is finalised via `finishWeek`.
- `Domain.isWeekComplete()` checks that every non-forfeited participant has submitted.
- The auto-complete path (after all submits received) only triggers if `round.status === 'active'` and all weeksCount submissions are done.
- Holiday weeks count against `round.holidaysAllowed`; forfeit is permanent for the rest of the round.
