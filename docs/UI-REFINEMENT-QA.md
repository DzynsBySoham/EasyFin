# Navigation, motion, scrolling and sources

- Inline Safari/inbox notice temporarily hidden; connection functionality remains in Settings.
- Vertical native panning allowed over sliders (`touch-action:pan-y`); horizontal confirmation, pointer cancellation and keyboard controls retained. Body overscroll restored. No JavaScript wheel/touchmove scroll hijacking added.
- Removed full-screen backdrop blur from sheets; kept bounded navigation translucency. Modal focus restores with preventScroll; route changes reset scroll immediately rather than animating through outgoing-page coordinates.
- Amount changes use a short local blur/opacity/translation animation, render the latest accessible value immediately, and cancel the previous animation. Initial loads do not animate. Reduced motion disables transitions/animations and smooth programmatic scrolling.
- Bottom navigation now uses blue icon wells rather than solid black active pills; visible labels and >=44px targets retained, with aria-current for the active destination.
- Add Client renamed Add Source; Add Income retained. Manage Sources offers explicit removal confirmation and restore. Removal archives the source so historical names, income, filters, totals and backup references remain intact. Archived sources are excluded from new income selection. Adding an archived source name restores the existing ID.
- Service worker cache bumped to v6.

Verification: syntax checks, 7 server tests and 41 browser tests passed before the final new scrolling test/plus-glyph adjustment; all 4 UI-refinement tests passed afterwards. Existing 38 browser regressions passed in the full run. New coverage includes archival/restore/reload/history retention, nav bounds at 320/390/1280 in both themes, hidden notice, gesture CSS, reduced motion, latest amount updates, long-page wheel scrolling and modal scroll-position restoration. Phone-width light/dark screenshots reviewed locally. Production deployment and physical iPhone inertial scrolling not verified; Chromium does not establish Safari performance.
