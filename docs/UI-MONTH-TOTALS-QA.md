# Header cleanup, filter layout and monthly totals

23 November 2026

## Changes
- Deleted the alphabet-avatar top bar from HTML and removed its JavaScript wiring. Settings remains available from the bottom navigation.
- Replaced the Quick Add marketing hero with one plain heading. Removed the helper paragraphs, privacy eyebrow and slide instruction below the home slider.
- The category action is hidden on an empty description. After typing, it displays the detected category or the necessary Choose category action; categorization and saving behavior are preserved.
- Removed the subscription badge element and count renderer entirely. Subscriptions remains a quiet icon/text link, with no colored dot or full-width pill.
- Expenses filters use a complete visible grid instead of clipped horizontal pills. Narrow screens use two columns; wider screens use a deliberate two-row layout. Client filters wrap, including long names. Touch targets remain at least 44 CSS px.
- Added totals to Expenses and Income. Headline total follows the month dropdown; All Time sums all records. A category/client selection shows a separate labeled filtered subtotal, without changing the meaning of the full month total. Filters do not reset each other.
- A manual month selection clears the special Today/This Week shortcut period constraint so it cannot silently restrict monthly totals.
- Service-worker cache version incremented to v4. No database/schema/storage changes or data clearing.

## Verification
- `npm run check`: passed.
- `npm test`: **30 passed, 0 failed** in local Chromium (~1.8 minutes).
- `git diff --check`: passed.
- Inspected light/dark screenshots of Expenses and the simplified Quick Add screen.
- New coverage: month and All Time totals; income/expense zero months; category/client subtotals; filter independence; deleted header/helper elements; category action behavior; all labels inside panels at 320/390/827/1280px in both themes; totals following actual IndexedDB saves.
- Existing coverage retained: touch-emulated slider, saving/duplicates/retry, onboarding, income/client validation, subscriptions, offline loading/saving, backup/restore and focused Quick Add routing.

All data used by tests is isolated local browser test data. No real financial data was accessed or modified. Physical iPhone verification was not performed. Branch changes are not a production release until separately merged/deployed.
