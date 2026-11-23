# EasyFin iOS launcher companion

**Status: native source + XcodeGen project and CI build job. Not a distributed app. Physical-device behavior has NOT been verified.** See GitHub Actions for actual build status; do not infer a successful build from these files.

## What this implements
- SwiftUI launcher host.
- WidgetKit circular/rectangular Lock Screen widget.
- iOS 18+ ControlWidget for Lock Screen controls, Control Center, and a supported device's Action Button.
- Shared `OpenQuickAddIntent: OpenIntent`, with `requiresAuthentication`, compiled into BOTH app and extension.
- App Shortcuts exposure for Siri/Shortcuts/optional Back Tap.
- Navigation-only handoff to `https://easyfin-soham.vercel.app/?action=quick-add`.
- No amounts on the Lock Screen. No audio, background playback, Live Activities, custom URL scheme, or private settings links.

## Critical storage and UX limitation
This is a **launcher, not a native expense form**. After iOS opens/authenticates the companion, it asks the system to open the focused web route. That may open Safari or another default browser; **it does not guarantee standalone PWA launch or remove browser chrome**.

Only the web app writes financial records, in its existing `easyfin` IndexedDB. No native expense store, pending expense queue, JavaScript bridge, App Group financial file, or server sync exists. A successful UIApplication URL callback means only that a link was accepted, never that an expense was saved.

Safari, other browsers, Home Screen web apps, and native WKWebView containers must not be assumed to share IndexedDB. Use one verified browser/container as your source of truth. If your records are in an installed PWA, do not assume a Safari handoff sees them: verify on-device before recording real expenses, and fall back to the PWA icon if not. Export a backup before any deliberate move between containers; the existing import preview/merge/replace flow is the only provided transfer, not automatic synchronization.

A WKWebView wrapper would remove Safari UI but create an isolated web data store. It is deliberately NOT included. App Groups share data among apps/extensions in the same signed group, not with an unrelated Safari/PWA origin. Universal Links could launch a signed native app after domain association but do not transfer website storage. No placeholder AASA file is deployed and no native app claims the production domain.

Consequently the full combination **locked form + no browser UI + unchanged Safari/PWA IndexedDB** is not implemented or claimed. Keep the existing PWA as the finance app.

## Requirements
- A Mac, Xcode 16+ with iOS 18 SDK (or newer compatible Xcode), and XcodeGen.
- Current source deployment target: **iOS 18.0**, iPhone only. This is an API minimum, not a claim of testing on every iOS 18+ release.
- A signing team and unique App/extension bundle IDs. Included reverse-DNS IDs are proposed identifiers, not registered/provisioned claims.
- For TestFlight/App Store distribution: Apple Developer Program membership, App Store Connect app record, signing/provisioning and review. A Vercel deployment cannot install this companion or its widgets.
- Xcode device development may use available Personal Team provisioning with its restrictions; that is not a distribution channel and is not verified here.
- No App Groups, Associated Domains, notification entitlement, or background-audio entitlement is required by this launcher. No passcode/Face ID/Touch ID bypass is attempted.

## Build on a Mac
```sh
brew install xcodegen
xcodegen generate --spec native/ios/project.yml
open native/ios/EasyFinCompanion.xcodeproj
```
1. Select the **EasyFinCompanion** scheme.
2. Set your signing team on both EasyFinCompanion and EasyFinWidgets. Change bundle identifiers together if needed (extension identifier must be prefixed by the app's identifier).
3. Select your connected, unlocked iPhone with Developer Mode enabled as required by Xcode.
4. Build and Run. Launch once before adding a widget/control.

Unsigned simulator compilation (does not prove runtime or device behavior):
```sh
xcodebuild build-for-testing \
  -project native/ios/EasyFinCompanion.xcodeproj \
  -scheme EasyFinCompanion \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO
```
To execute the two unit tests, choose a locally available iPhone simulator in Xcode and Product → Test, or use `xcodebuild test` with that simulator's concrete destination. The supplied CI job compiles tests and requests execution on an available iPhone simulator. Check its actual result: a successful compile is not a passed test run, and neither proves authentication/handoff behavior.

## Configure on iPhone after signing/installing
1. **Lock Screen widget:** unlock, touch and hold the Lock Screen → Customize → Lock Screen → Add Widgets → EasyFin → Quick Add.
2. **Lock Screen bottom control (iOS 18+):** Customize Lock Screen → remove/replace an existing control → choose EasyFin Quick Add.
3. **Control Center:** open Control Center → edit/add a control → search EasyFin → Quick Add.
4. **Action Button, only if the device has one:** choose the installed EasyFin action through Controls where offered, or use a Shortcut invoking EasyFin Quick Add. Do not assume all iPhones have this button.
5. **Siri/Shortcuts:** select the native EasyFin Quick Add action. This is different from an existing Shortcut containing only URL + Open URLs; that existing shortcut can instead use the focused URL but remains a browser handoff.
6. **Optional Back Tap:** Settings → Accessibility → Touch → Back Tap → choose a Shortcut invoking the native action. No settings URL is fabricated.

## Required physical test before release
- Confirm exact model and iOS build; user has not supplied them.
- Install app and widgets, then test cold/warm app launches.
- Tap each widget/control while locked and verify system authentication (including failed/cancelled authentication).
- Verify request routes to Quick Add without showing Dashboard or onboarding.
- Verify returning from Safari does not launch it again; repeated intentional taps should still work.
- Determine which browser/container opens. Verify it sees the user's intended existing database BEFORE entering real records.
- Add an isolated expense, check transaction completion, refresh persistence, Dashboard and Balance; delete only the test record.
- Verify no financial information appears on the locked screen or app-switcher snapshot.
- Test default-browser changes and Home Screen PWA handoff behavior.

**No physical iPhone, Apple signing identity, or local Xcode is available in the coding sandbox. None of these physical tests has been performed.**
