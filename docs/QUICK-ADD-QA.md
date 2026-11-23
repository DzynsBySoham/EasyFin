# Focused Quick Add / native launcher delivery and QA

Date: 23 November 2026. This extends the earlier `QA-REPORT.md`; the older report describes the previous redesign, not this iteration's test count.

## Implemented and verified in a browser

- `/?action=quick-add` (also accepts the older `?view=quick-add`) renders a compact expense panel. Dashboard, branding header, normal navigation, Today list and onboarding are not displayed. The route is recognized before first paint and initialized once.
- Skipping onboarding for this route does not mark normal onboarding complete. X discards the draft and returns to Expenses. Reload keeps focused mode.
- Uses original `easyfin` IndexedDB, version 1, same stores. No migration, second database, production test seed or data reset.
- Visible local category detection; unknown descriptions require six-category selection BEFORE a completed slide can save. Picking a category alone saves no expense. Learned category mappings remain local.
- Save guard, stable draft ID, field locking during persistence, pointer capture/cancel/reset and keyboard interaction. UI reports success after the storage promise resolves at transaction completion.
- Normal and focused tabs in the same browser storage container read the same records. Dashboard and Balance are checked after Quick Add saves.
- Client duplicate checks and creation now share a serialized read/write transaction. Client/income/subscription forms have a busy guard and surfaced write failures, retaining retryable input.
- Fixed a real theme initialization race: an outstanding startup read could overwrite a newly selected theme. Revision check and lightweight preference ordering prevent it; restoring a backup explicitly reapplies restored appearance.
- A long error toast was intercepting pointer input over the slider. Status feedback is now pointer-transparent, so retry remains possible.
- Subscription transaction result now distinguishes a saved payment from an already-handled/no-op cycle instead of showing false payment success.
- Single page titles, month selector beside Expenses/Income, requested filter order, no pink subscription dot, quieter subscription-management row, coherent outline icons, aligned amounts and date groups including the year. Settings remains reachable from navigation without redundant branding above each page.
- Both themes, reduced motion, focused-route small/landscape dimensions, original offline shell and offline records are preserved. Service-worker cache advanced to v3.

## Test execution

Commands: `npm run check`, `npm test`, `git diff --check`.

Final implementation tested: **814d6fb**. Documentation-only commits after that do not change the tested application/native source.

**25 Playwright browser tests passed, 0 failed**, locally (~1.5 minutes) and in GitHub CI (58.2 seconds):
https://github.com/DzynsBySoham/EasyFin/actions/runs/45184343097

These use real Chromium IndexedDB and CDP touch emulation, not an IndexedDB mock or a physical iPhone. The first pushed web run failed; the revised harness explicitly waits for asynchronous category detection before dragging. GitHub reporter annotations now expose failures even where the log download host is blocked.

| Category | Passed evidence | Failed in final web run | Not tested / limits |
|---|---|---:|---|
| Focused route | First paint mode, no onboarding/nav, reload, close/discard, single initialization, normal onboarding still available | 0 | Physical Shortcut/PWA routing |
| Expense entry | Known/unknown category, selection-before-save, partial/complete slide, cancel, keyboard, duplicate lock, write failure/retry, persistence and totals | 0 | Physical iOS gesture/keyboard behavior |
| Clients/income | Required fields, duplicate clients including concurrent writes, failed client write/retry, rapid submission guards, filtering and reload persistence | 0 | Exhaustive imported-client edge cases |
| Subscriptions | Create/invalid fields, monthly 29/30/31/leap dates, payment/cancellation slides, close without payment, exact name/amount matching, duplicate prevention/history | 0 | Real cross-device reminder delivery |
| Reminders | Local due-tomorrow, five/ten-day overdue and cancelled suppression | 0 | Closed-app push is not configured/implemented end-to-end |
| Filters/UI | All six views, light/dark, widths 320/390/844/1280, combined expense filters, month/client filter, sorting and no horizontal document overflow | 0 | Physical 60fps/accessibility/VoiceOver audit |
| PWA | Worker control, manifest/icon requests, offline reload/add, offline focused route, theme persistence | 0 | Home Screen install, actual standalone launch, deployed v2→v3 transition |
| Backup | Export download, invalid JSON/schema, preview, explicit replace, merge preserves existing and restored records | 0 | Exhaustive malformed backups/quota fault injection |
| Storage boundary | Two same-context tabs see one `easyfin` database and shared records | 0 | Safari vs installed PWA vs other browser sharing: not assumed |

## Native status

Source in `native/ios/` supplies SwiftUI host, WidgetKit Lock Screen launcher, ControlWidget, authenticated OpenIntent and App Shortcuts. It is a **launcher only**, not a native financial form.

Native app, extension/control and test target compiled successfully in macOS CI on 26431b5:
https://github.com/DzynsBySoham/EasyFin/actions/runs/45182819754

The 814d6fb macOS CI run **passed**, including unsigned compilation and the navigation unit-test execution step on an available iPhone simulator (4m25s):
https://github.com/DzynsBySoham/EasyFin/actions/runs/45184343385

A simulator compile/test is not proof of widget installation, system authentication, App Intent process routing, Siri invocation or Safari/standalone handoff on a real iPhone. No native financial records are stored, synced or uploaded. No IPA/TestFlight/App Store release has been produced.

Build/sign/install requirements and exact configuration steps: `native/ios/README.md`.

## Research decisions / unsupported combination

See `IOS-INTEGRATION-RESEARCH.md` for source links and feasibility analysis.

- Now Playing and Media Session are for genuine media, not arbitrary expense forms. No audio or metadata abuse is implemented.
- OpenIntent/WidgetKit are the supported native launch mechanisms. System authentication is required; no locked editable form is claimed.
- Live Activities have no genuine ongoing activity to display for this use case; not implemented.
- Universal Links require signed native association and do not share browser IndexedDB. No placeholder AASA/URL scheme is deployed.
- App Groups cannot mount the PWA's browser database; none is used for financial data.
- A native WKWebView would create a different storage context, so it is intentionally not used.
- Jailbreak work is research only. No downloads, exploits, profiles, tweaks, authentication bypasses or primary-device modifications. Device-specific feasibility is unknown without the model/OS; any future experiment needs an approved isolated test device. It is not needed for the supported launcher.

## Deployment

The implementation was pushed only to `arena/b0ce49e2-easyfin`.

Vercel GitHub status reports a completed branch deployment for 814d6fb:
https://vercel.com/dzynsbysoham/easyfin-veyra/ALiU2WNsaXYfYGVshK8iUW5sxfNj

The preview URL was opened through page retrieval and redirects to Vercel login protection. It cannot be claimed as an authenticated visual/functional preview verification:
https://easyfin-veyra-git-arena-b0ce49e2-easyfin-dzynsbysoham.vercel.app/?action=quick-add

The existing public domain was retrieved during the baseline audit and still represented the earlier app; direct browser/shell access to the Vercel host is blocked by the sandbox network. No merge to main or production promotion was performed. Do not confuse this successful branch deployment with a verified production update.

Draft review PR: https://github.com/DzynsBySoham/EasyFin/pull/2

## Physical iPhone verification — NONE performed

No physical iPhone or signing identity is available. User has not provided exact model/iOS version. Source API minimum is iOS 18.0, not a certification for the user's phone. Action Button use additionally requires that hardware.

Still required before native release: signed install, Lock Screen widget/control setup, Control Center, failed/cancelled authentication, cold/warm OpenIntent launches, repeated invocation, returning from Safari, exact default-browser/PWA handoff, intended existing database visibility, physical keyboard/safe areas/slider, optional Siri/Action Button/Back Tap, and real transaction persistence on that device.

**Unachieved full objective:** a browser-free native expense form writing directly into the existing installed PWA's IndexedDB. The provided launcher deliberately retains the browser handoff rather than creating a misleading isolated store. Use the installed PWA icon if a browser handoff opens a different record container.
