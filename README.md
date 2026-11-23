# EasyFin — Personal Finance PWA

Premium, local-first, iPhone-first expense & income tracker. Vanilla HTML/CSS/JS, IndexedDB, PWA, Vercel serverless reminders. No frameworks.

## Run locally
```bash
python3 -m http.server 8000
# open http://localhost:8000 (install prompt via browser menu)
```

## Deploy (Vercel)
1. Push the working branch to GitHub for the existing Vercel project’s branch preview.
2. Review checks/preview and merge a pull request into the configured Production Branch to update production. Do not create another Vercel project. A preview status is not production verification.
3. Web Push is **not implemented/configured**. Adding environment variables alone does not enable delivery. The subscribe endpoint returns 503; cron requires `CRON_SECRET` and reports no delivery. In-app due/overdue statuses remain available.
4. `vercel.json` cron runs daily at 03:00 UTC (≈08:30 IST).

## Install on iPhone
Safari → Share → **Add to Home Screen**. Opens standalone, works offline.

## Features
- **Quick Add** (default): amount + description → local keyword categorisation (6 fixed categories) → blue Slide to Add. ✕ discards.
- **Dashboard / Balance**: current-month income − expenses, animated numbers, tappable cards.
- **Income**: clients (name only), amount + client + thumbnail count (all compulsory), month + client filters.
- **Expenses**: category chips + month dropdown (combined), newest-first, grouped by day.
- **Subscriptions** (inside Expenses): monthly only, anchored billing day (31st-safe), Slide to Confirm (blue), Slide to Confirm Cancellation (pink, asks “Have you cancelled…?”), exact name+amount Quick Add auto-match with duplicate prevention.
- **Backup**: Export/Import JSON (schema v1) with preview, replace-or-merge.
- **Back Tap**: setup guide in Profile. iOS cannot deep-link to Back Tap settings from a PWA — guide shows exact steps; Shortcuts open the app via URL (`?view=expenses` etc.) and the app loads real data after launch.
- **Privacy**: financial records remain in IndexedDB. No reminder metadata or endpoints are currently uploaded.

## Focused Quick Add and optional iOS launcher

`https://easyfin-soham.vercel.app/?action=quick-add` opens compact expense entry, skips onboarding/navigation, and uses the same `easyfin` database **in the same browser storage container**. Category selection happens before the saving slide; selection alone does not record an expense. X discards the draft and returns to Expenses.

The optional [SwiftUI/WidgetKit companion](native/ios/README.md) provides authenticated Lock Screen/Control Center/App Shortcuts **launcher source**, targeting iOS 18+. It is not installed or distributed by Vercel. It hands off to the default browser and cannot guarantee standalone-PWA launch, browser-free entry, or Safari/PWA IndexedDB sharing. No native expense database is introduced. Use the installed PWA icon if handoff opens the wrong storage container.

- [iOS mechanisms, storage boundaries and jailbreak feasibility](docs/IOS-INTEGRATION-RESEARCH.md)
- [Current 25-test web QA, native CI and remaining physical-device checks](docs/QUICK-ADD-QA.md)
- [Draft review pull request](https://github.com/DzynsBySoham/EasyFin/pull/2)

## Automated checks
```bash
npm ci
npm run check
npm test
```
The development-only Chromium package supplies the Linux browser; the test runner extracts its libraries to a temporary directory. Test records exist only in isolated browser contexts. No runtime dependencies or application build step are needed. See `docs/QUICK-ADD-QA.md` for this iteration and `docs/QA-REPORT.md` for the earlier audit.

## Physical iPhone QA still required
- Expense: recognised/unknown keyword, empty description, cancel via ✕, offline add.
- Income: duplicate client, missing thumbnails, filters.
- Subscription: exact match auto-pay, duplicate prevention, confirm/cancel slides.
- PWA: install, standalone, offline, backup restore.
- iPhone: Back Tap Double/Triple, keyboard, safe-area, light/dark.
