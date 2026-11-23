# EasyFin — Personal Finance PWA

Premium, local-first, iPhone-first expense & income tracker. Vanilla HTML/CSS/JS, IndexedDB, PWA, Vercel serverless reminders. No frameworks.

## Run locally
```bash
python3 -m http.server 8000
# open http://localhost:8000 (install prompt via browser menu)
```

## Deploy (Vercel)
1. Push to GitHub.
2. Import repo in Vercel (static + `api/` functions auto-detected).
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

## Automated checks
```bash
npm ci
npm run check
npm test
```
The development-only Chromium package supplies the Linux browser; the test runner extracts its libraries to a temporary directory. Test records exist only in isolated browser contexts. No runtime dependencies or application build step are needed. See `docs/QA-REPORT.md`.

## Physical iPhone QA still required
- Expense: recognised/unknown keyword, empty description, cancel via ✕, offline add.
- Income: duplicate client, missing thumbnails, filters.
- Subscription: exact match auto-pay, duplicate prevention, confirm/cancel slides.
- PWA: install, standalone, offline, backup restore.
- iPhone: Back Tap Double/Triple, keyboard, safe-area, light/dark.
