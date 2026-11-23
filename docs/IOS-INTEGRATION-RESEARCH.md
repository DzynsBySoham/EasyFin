# iOS Lock Screen feasibility and architecture — 23 November 2026

## Decision
Build a focused web destination and a small, optional native **launcher** with WidgetKit + authenticated OpenIntent. Do not build a second financial database or misrepresent browser handoff as native/PWA integration. The native source must be signed, installed and physically tested before release.

## Supported system mechanisms

| Mechanism | What it actually provides | EasyFin decision |
|---|---|---|
| MPNowPlayingInfoCenter + MPRemoteCommandCenter | OS-rendered media metadata and playback commands, including Lock Screen/Control Center | Not an expense form or general app launcher. No use. |
| Web Media Session | Metadata and handlers for playing media and standard playback interactions | No arbitrary text/amount fields; no use. No fake metadata, silent audio or media-control hijacking. |
| WidgetKit Lock Screen widgets | Small system-rendered widget views; buttons can execute App Intents on supported releases | Native circular/rectangular Quick Add launcher source supplied. No financial values in the widget. |
| ControlWidget (iOS 18+) | App actions in Control Center, Lock Screen and supported Action Buttons | Static Quick Add button uses the same OpenIntent. |
| OpenIntent | Foregrounds host app at a target, typically AppEnum/AppEntity | One enum target, Quick Add. Intent belongs to BOTH host and widget targets. Requires authentication. |
| App Shortcuts / Siri | Discoverable intent invocation; optional Shortcut trigger from Back Tap/Action Button | Native provider supplied. Existing URL-only Shortcut remains a browser handoff. |
| Live Activities | Glanceable state of an ongoing activity, with limited actions and deep links | Research only; expense entry has no genuine ongoing activity needing persistent display. Not a free-form TextField/amount-entry surface or permanent launch button. |
| Universal Links | Signed native app/domain association and routing to app content | Evaluated, NOT enabled. Needs a real Team ID, Associated Domains entitlement and matching AASA. Does not give native access to Safari's DB or force PWA opening. |
| App Groups | Shared container between entitled apps/extensions | Not needed for navigation-only launcher; cannot share Safari/PWA IndexedDB. No financial records stored in App Groups. |
| WKWebView host | Native-hosted web UI without Safari chrome, with app-specific website storage | Rejected for this iteration: silent creation of a different store would violate the user's existing-data/source-of-truth requirement. |

Apple documents that controls may launch a specific view and require device authentication; OpenIntent target membership must include both targets. The supplied companion follows that navigation architecture, but its destination then opens the external web route. This is intentionally less than a native form.

## Source of truth and safe handoff

1. Widget/control displays only `Quick Add` with an SF Symbol.
2. System invokes OpenQuickAddIntent subject to `requiresAuthentication`.
3. Intent posts a navigation-only request in the foreground host process.
4. SwiftUI consumes the request once and opens the fixed HTTPS URL with only `action=quick-add`.
5. Web startup opens the existing `easyfin` database, skips onboarding and hides ordinary navigation for this route.
6. Category resolves locally or is explicitly selected. Selection alone records NOTHING.
7. Only a completed slide validates and writes the expense. Success follows transaction completion.
8. The normal app's Expenses/Dashboard/Balance read the same database **within the same browser/origin storage container**.

No amounts, descriptions, backup payloads or IDs go through URLs, the native extension, App Groups, clipboard or servers. The companion does not listen for expense-save callbacks and never claims a record was saved.

Safari/default browser/standalone PWA storage separation is a release blocker for claiming a seamless PWA handoff. No supported public interface allows a launcher to mount an installed PWA's private IndexedDB. If the handoff opens the wrong container, use the PWA icon. A deliberate user-confirmed backup transfer is possible but is not sync and must not create two active sources of truth.

A future browser-free native/hybrid product would require an explicitly approved data-location decision and migration/synchronization contract, not simply embedding this URL in WKWebView. It is not implemented here.

## Compatibility

- Web route: current browser capabilities required by the existing PWA (IndexedDB, Pointer Events, JS ES6+). Device-specific support is tested in-browser, not certified on iPhone.
- Native source targets iPhone/iOS **18.0+**, Xcode **16+** SDK. This covers API availability for the supplied ControlWidget; it does not certify runtime behavior on all newer releases.
- Lock Screen widgets existed before iOS 18, but this companion intentionally has one iOS 18 minimum. An iOS 16/17 fallback build is NOT supplied.
- An Action Button is optional hardware. Control Center and Lock Screen controls do not require one.
- User's exact iPhone model and iOS version/build are **unknown**. Exact compatibility with the user's device cannot be asserted.
- No local Xcode, signing identity, or physical iPhone is available. See native README for signing and the physical release checklist.

## Jailbreak feasibility — research only, not an implementation path

A device-specific tweak framework can in principle modify SpringBoard/Lock Screen launch affordances on an already-compatible research device. ElleKit is a tweak injection/hooking framework, not a supported Apple Lock Screen API or an out-of-the-box finance interface. A working tweak would depend on private implementation details, rootless compatibility and the precise OS/SoC combination; it would not safely share web-origin IndexedDB merely by appearing on the Lock Screen.

Upstream Dopamine's retrieved README declares different ranges by architecture (including 15.0–17.3.1 arm64e, and additional A12/A13 ranges). These are upstream claims, not a device compatibility determination. No device model/version was provided and no jailbreak was downloaded or tested. Do not extrapolate jailbreak availability from an iOS major version alone.

The palera1n documentation specifically warns that A11 configurations may require losing passcode/SEP functionality while jailbroken. Any path requiring passcode/biometric disablement is excluded by this project's requirements. No instructions, exploit code, unsigned tweak, bypass, profile or system modification is supplied.

Risks include system/third-party app instability, financial-app/Apple Pay compatibility, reduced isolation, data exposure, battery drain and maintenance across reboots/updates. Private SpringBoard interfaces are not stable; an iOS update can break or remove the integration and jailbreak support. The ordinary EasyFin app has no jailbreak dependency.

**Conclusion:** not necessary to achieve a launcher. Do not experiment on the primary phone. Any future feasibility experiment needs prior approval, a separate expendable test device with no personal/banking data, an exact supported firmware/model assessment, backups and a recovery plan. No experiment was performed.

## Primary sources consulted

- Apple controls, lifecycle, OpenIntent launch and target membership: https://developer.apple.com/documentation/widgetkit/creating-controls-to-perform-actions-across-the-system
- OpenIntent routing: https://developer.apple.com/documentation/appintents/openintent
- Authentication policy: https://developer.apple.com/documentation/appintents/intentauthenticationpolicy
- Now Playing: https://developer.apple.com/documentation/mediaplayer/mpnowplayinginfocenter
- Media Session: https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API
- ActivityKit constraints/lifecycle: https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities
- Universal Links association/handoff: https://developer.apple.com/documentation/xcode/allowing-apps-and-websites-to-link-to-your-content
- WebKit data stores: https://developer.apple.com/documentation/webkit/wkwebsitedatastore
- Dopamine upstream README (retrieved): https://github.com/opa334/Dopamine
- ElleKit framework research: https://github.com/evelyneee/ellekit
- palera1n's compatibility/passcode caveat: https://docs.palera.in/docs/get-started/installing-palera1n-macos
- Apple security/stability warning: https://support.apple.com/guide/iphone/unauthorized-modification-of-ios-iph9385bb26a/ios

Some sources were retrieved through search/markdown documentation mirrors because the sandbox blocks direct outbound Apple/Vercel connections. No claim of live physical verification follows from documentation research.
