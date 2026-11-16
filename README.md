# BudgetTracker

Log an expense in two taps on your phone; see it seconds later in a tidy spreadsheet on your laptop.

- **Fast entry** — type the amount, tap a category. That's it. The expense type (Need / Want / One-off) is pre-selected and one tap to change.
- **Undo** — one button removes the last expense, from the phone and from the spreadsheet.
- **Your spreadsheet, your Drive** — every expense becomes a row in a Google Sheet called *BudgetTracker Expenses*, with a `Transactions` tab (filterable, banded) and a `Summary` tab (category × month table, totals, charts). Open it in Google Sheets or download it as `.xlsx` for Excel.
- **Works offline** — expenses are saved on the phone first and synced when there is a connection.
- **Settings** — default currency, your own categories and expense types.
- **Lock Screen "+" (iOS)** — a widget that opens the app directly on the keypad.
- **Detected expenses** — bank payment notifications (Android) or Apple Pay transactions (iOS, via Shortcuts) show up pre-filled; you just confirm the category.

## How it is built

| Decision | Choice | Why |
| --- | --- | --- |
| App framework | Expo (React Native) + TypeScript, Expo Router | One codebase for iPhone and Android |
| Where data lives | The Google Sheet **is** the database | No server to run or pay for, and users own their data in a format they already know. The phone keeps only the last 100 expenses (for Undo) and a queue of unsynced changes |
| Google access | `drive.file` scope | The app can only touch the one file it creates, never the rest of the user's Drive |
| Sync | Outbox of append/delete operations (`src/lib/sync.ts`) | Survives no-signal moments; retries never create duplicate rows because each row carries an ID |
| iOS widget | WidgetKit target in `targets/widget` | Lock Screen widgets must be native Swift |
| Android detection | `NotificationListenerService` in `modules/bank-notifications` | Notifications are matched and parsed on the phone only |

```
src/app/            screens: index (add), settings, add (deep-link entry)
src/lib/            store, sync, Google Sheets client, sheet layout, notification parser
modules/            Android notification listener (Kotlin, local Expo module)
targets/widget/     iOS Lock Screen / Home Screen widget (Swift)
```

## Running it

```bash
npm install
npm run web         # quick UI preview in a browser (no Google sign-in)
npm test
npm run typecheck
```

The real app uses native code (Google sign-in, widget, notification listener), so it needs a development build rather than Expo Go:

```bash
npx expo run:android
npx expo run:ios      # needs a Mac with Xcode 16+
```

or build in the cloud with `npx eas-cli@latest build --profile development`.

## Google setup (once)

1. In [Google Cloud Console](https://console.cloud.google.com/) create a project and enable **Google Sheets API** and **Google Drive API**.
2. Configure the OAuth consent screen and add the scope `.../auth/drive.file`.
3. Create OAuth client IDs: **Web**, **iOS** (bundle ID `com.courius.budgettracker`) and **Android** (package `com.courius.budgettracker` + your signing SHA-1).
4. Copy `.env.example` to `.env` and fill in the web client ID, the iOS client ID and the iOS URL scheme (the reversed iOS client ID, `com.googleusercontent.apps.…`). Set `APPLE_TEAM_ID` so the widget can be signed.

## Deep link

`budgettracker://add` opens the keypad. `budgettracker://add?amount=33&merchant=Lidl&currency=EUR` queues an expense for confirmation.

### Automatic detection on iPhone

iOS does not allow any app to read other apps' notifications, so bank notifications cannot be read there. The equivalent for Apple Pay: in the **Shortcuts** app create an Automation → **Transaction** (iOS 17+) → pick your cards → action **Open URLs** with
`budgettracker://add?amount=[Amount]&merchant=[Merchant]`, set to *Run Immediately*.

### Automatic detection on Android

Settings → *Detect card payments* → grant notification access. Payment notifications are queued on the device, you get a "New expense detected" prompt, and the expense appears pre-filled in the app.

## Status

Verified here: type check, unit tests (notification parser, sync planning, sheet formulas, keypad), the full add / undo / detected / settings flow in a browser, and native project generation (`expo prebuild`) including the widget target and the Android module.

Not yet run on a device: Google sign-in and the live Sheets calls (they need the OAuth client IDs above), the Swift widget and the Kotlin notification listener.
