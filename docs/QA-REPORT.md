# EasyFin implementation and QA — 23 November 2026

## Scope and data safety
Modified the existing vanilla HTML/CSS/JS app, not a replacement. IndexedDB remains `easyfin`, version 1, with the original stores and key paths. No production data was read, reset or seeded. Automated data lives in isolated local browser contexts. No runtime framework or remote database was added; npm dependencies are development-only.

## Confirmed root causes
- **Fresh database initialization failed:** the upgrade callback called `db.objectStore`, which does not exist on IDBDatabase. Actual Chromium execution raised TypeError and aborted the version-change transaction. It now uses the upgrade transaction's objectStore. This prevented startup and saving on fresh devices.
- **Slider defects:** pointercancel shared the success handler; no submission lock; async saves were not awaited/caught; a `.done` transform with `!important` pulled the thumb backwards. Replaced the binding with captured primary-pointer tracking, thumb-only start, explicit cancellation, actual measured bounds, 94% release threshold, busy lock, awaited completion and failure recovery. Keyboard: Arrow Right to 100, Enter to commit; Escape resets. Only the slider disables touch scrolling.
- **Onboarding absent:** no first-launch invocation or completion flag existed. Four screens now run after database initialization; Skip/Finish persist a lightweight local preference. Settings can reopen Quick Setup.
- **Theme announcement:** direct toast call on toggle. Removed; appearance selector is in Settings. Theme persists in the original settings store, with a local preference for flash-free startup.
- **Subscription payments:** payment, expense and next-cycle update were separate transactions and duplicate checks raced. Now one read/write transaction re-reads the current subscription and commits all three changes together.
- **Month-end dates:** local Date mutations followed by UTC ISO formatting could shift billing dates in positive time zones. Uses UTC calendar arithmetic with original-day clamping.
- **Backup restore:** merge overwrote existing keys; settings were exported but not restored; replace used separate clear/write transactions. Added schema/record validation and one atomic restore transaction. Merge preserves existing keys. Preview and explicit replace/merge choice remain.
- **Notifications:** frontend posted an invalid placeholder endpoint and reported success without checking the response. Cron marked reminders sent without delivering. False success removed. Both endpoints explicitly report unconfigured delivery; cron checks CRON_SECRET. No records are uploaded.
- **Cancellation:** the cancellation sheet existed but was unreachable. Active subscription rows now expose it.
- **Service worker:** old cache-first assets could remain indefinitely; all failed requests fell back to HTML. Updated version, network-first same-origin cache, old-cache cleanup, navigation-only HTML fallback and API exclusion. Vercel config no longer rewrites all missing paths/APIs to HTML.

## Design
Light: white surfaces, soft blue ambient header, one purposeful blue financial hero/slider accent. Dark: #050506 foundation, #111113 primary layers, #1b1b1f inputs. Native Apple/system sans, lighter large headings, tabular money, tighter tracking and consistent small labels. Six category emoji and navigation glyphs replaced by coherent inline outline SVGs. Refined pill navigation, 44px close targets, focus outlines, modal focus containment/return, labels, safe-area clearance, landscape fallback, reduced-motion support. Blur is reserved for navigation/modal backdrops and existing short number transitions.

## Executed tests
Commands: `npm run check`, `npm test`, `git diff --check`.

Final local run: **15 Playwright tests passed, 0 failed** (about 1.3 minutes). Browser: headless Chromium supplied through a development-only npm package after Playwright's CDN was blocked. These are browser integration tests with real IndexedDB, not mocks. CDP touch emulation is not physical iOS Safari verification.

| Category | Passed | Failed | Not tested / limits |
|---|---|---|---|
| Code checks | All five frontend JS files and worker parse; whitespace check | 0 | No separate app build exists |
| Quick Add | Validation, known/unknown category, remembered selection, discard, partial drag/reset, pointer cancel, keyboard, busy lock, write failure/retry, persistence, Dashboard/Expenses update | 0 | iOS physical gestures |
| Income | Empty/duplicate client, missing fields, fractional thumbnail rejection, valid entry, combined client/month filter | 0 | Exhaustive multi-client ordering matrix not separately asserted |
| Subscriptions | Form validation/create, 29/30/31 and leap February, exact mismatch cases, concurrent duplicate prevention, payment slider, close without payment, cancellation slider, history retention, Quick Add match | 0 | Cross-tab physical-device concurrency not tested |
| Reminders | Due tomorrow, overdue five/ten days, cancelled suppression (local helper) | 0 | Closed-app push unavailable |
| Backup | Exported JSON download, schema rejection, invalid JSON, preview, explicit replace, merge preserves keys, atomic restore paths | 0 | Exhaustive malformed-record corpus/quota fault injection not tested |
| PWA | Manifest/icons HTTP checks, actual worker control, offline reload and offline expense save | 0 | Actual install, standalone launch and real deployment cache transition not tested |
| UI | All six views, both themes, widths 320/390/844/1280, no horizontal document overflow, silent theme persistence, all onboarding screens/revisit | 0 | No full accessibility/performance audit; no physical keyboard/safe-area/60fps proof |
| Production | Existing base commit has a successful Vercel GitHub status | — | Public domain and Vercel API blocked by sandbox network; no production verification |

Locally captured light/dark screenshots were inspected. The browser console check covers navigation in both themes; the controlled failure test intentionally logs its injected storage error. No claim is made that every conceivable interaction or every requested matrix permutation was tested.

## iPhone installation and Shortcuts
Safari → Share → Add to Home Screen → enable Open as Web App if offered → Add → launch the Home Screen icon. Completion of the setup screens does not detect or certify installation.

No signed/importable Shortcut or iCloud link is supplied. Onboarding describes manually creating URL/Open URLs actions for Quick Add, and Choose from Menu branches for today/week/month/home. App routes load local data only after opening. Week opens current-week expenses, not a native Shortcut-generated financial report. Settings path is copyable: Settings → Accessibility → Touch → Back Tap. No unsupported settings deep link. URL actions may open Safari rather than the installed PWA; the reliable fallback is launching the Home Screen icon.

**Not physically verified:** Safari installation, standalone launch, Back Tap Double/Triple, Shortcut handoff, iPhone keyboard/safe areas/touch gestures, notification permissions or delivery. No physical iPhone is available.

## Push and deployment limits
Web Push is not implemented end-to-end. A real implementation still needs validated PushManager registration, VAPID keys, an authenticated per-device reminder store/sync and server-side delivery with successful-send-only idempotency. Adding environment variables alone is insufficient. The UI reports unavailability instead of asking for pointless permission or claiming enabled reminders.

The sandbox permits outbound requests only to GitHub/npm/PyPI hosts. `curl -I https://easyfin-soham.vercel.app` failed at TLS connection; the Vercel API/CLI cannot be used to promote or inspect production here. The base commit's GitHub status points to the existing `dzynsbysoham/easyfin-veyra` Vercel project. No new Vercel project/domain was created. Work is pushed only to the Arena working branch; it is not merged into main. Any Git-integrated branch preview is not a verified production release.
