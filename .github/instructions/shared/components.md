---
applyTo: "source/shared/components/**"
---

# Shared Components

Shared UI components used across multiple features. All live in `source/shared/components/`.

## Component list

| File | Export | Purpose |
|---|---|---|
| `submitButton.js` | `SubmitButton` | Renders a `<button>` with icon + label |
| `menuBar.js` | `MenuBar` | Top nav bar (HTML and React variants) |
| `siteHeader.js` | `SiteHeader` | Auth chip / user info header (HTML and React variants) |
| `snackbar.js` | `Snackbar` | Toast notification system |
| `syncButton.js` | `SyncButton` | Sync retry button with busy state |
| `submissionStatusPanel.js` | `SubmissionStatusPanel` | Per-week submission status grid |
| `leaderboard.js` | `Leaderboard` | Week leaderboard table |
| `weekPager.js` | `WeekPager` | Previous/next week navigation |
| `weightChart.js` | `WeightChart` | Canvas weight progress chart |
| `dataTable.js` | `DataTable` | Generic sortable table |
| `qrCode.js` | `InviteQRCode` | QR code generator for invite links |

## SubmitButton

```js
SubmitButton.render({
  text: 'Save',          // button label
  icon: 'save',          // Material Symbol name
  submit: true,          // type="submit" vs type="button"
  theme: 'secondary',    // '' | 'secondary' | 'danger' | 'small'
  id: 'btn-id',          // optional id attribute
  attrs: { 'data-x': 'y' }  // additional HTML attributes
})
```

Returns an HTML string. Always use `SubmitButton.render()` for action buttons — do not write raw `<button>` tags in page HTML.

## Snackbar

```js
Snackbar.push(text, kind)   // kind: 'success' | 'error'
Snackbar.remove(id)
Snackbar.render(element)    // render into DOM element
Snackbar.setOnChange(fn)    // auto-render callback
```

`App.setMessage(msg, err)` is the preferred way to show snackbars from feature pages.

## SyncButton

```js
SyncButton.BUTTON_ID           // 'btn-sync-retry'
SyncButton.render()            // returns button HTML
SyncButton.bind(el, isSyncing, handler)  // attach click handler with busy state
```

## WeightChart

```js
WeightChart.attach(round, users, submissions, selectedWeek, unit, existingInstance)
// Returns updated chart instance (pass back in on next render to reuse canvas)
```

Call `App._attachWeightChart()` after rendering the overview page — it handles the instance lifecycle automatically.

## MenuBar

```js
MenuBar.render(items, activeRoute, hrefFn)         // HTML string
MenuBar.attachClickHandler(nav, onNavigate)        // bind clicks
MenuBar.renderReact(items, activeRoute, handlers)  // React element
```

## InviteQRCode

```js
InviteQRCode.renderPlaceholder()     // placeholder div (before QR code is generated)
InviteQRCode.attach(url)             // replace placeholder with generated QR code
```

## Coding conventions

- Components return HTML strings (via template literals) or React elements — never modify the DOM directly inside a component.
- Use `Utils.esc()` on all user-supplied data inside component templates.
- Components should be stateless — state lives on `app.state`.
- React components (`MenuBar.renderReact`, `SiteHeader.renderReact`) are only used when `app.react.enabled` is true.
