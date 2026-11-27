# Record management and bottom-navigation clearance

Supersedes the archival-only source-removal behavior in UI-REFINEMENT-QA.md.

## Implemented
- Move navigation clearance from a fixed-height body's padding onto `main`, after all real content. Root/body use auto height and minimum viewport height. Measure the dock's height + actual bottom offset + 24px, with CSS safe-area-aware fallback, resize/rotation and visual viewport listeners. Focused Quick Add remains a dock-free layout.
- Add accessible 44px pencil controls on Today/Expenses and Income. Expense editing supports amount, description and category. Income editing supports amount, source and thumbnail count. Original timestamps/month keys remain unchanged. Delete requires a second explicit destructive action.
- Source management now permanently deletes the source and **all** its income in one IndexedDB transaction after a count/total preview and explicit confirmation. Previously archived sources can be deleted too; nothing is deleted automatically by this update. Other sources, income and expenses remain untouched.
- Refresh every financial view after changes; sequence month options before rendering and reset vanished month/source selections consistently.
- Check the original record inside the write transaction to prevent stale editors resurrecting records. Income insertion validates that its source still exists within the same transaction.
- Link newly created subscription payments to expense IDs. Legacy linkage is inferred only from a unique matching subscription name + exact paid timestamp + amount. Updating an expense updates its linked payment amount. Deleting it removes the linked payment and reopens a cycle only if it is the latest advanced cycle. Older deletion does not rewind newer payment history. Ambiguous legacy payment matches abort rather than guessing.
- Retain inbox receipts after expense deletion so an ACK/retry cannot resurrect it. Local expense mutations cancel queued outbox copies. Inbox is not bidirectional sync: already sent copies (or an upload already in progress) require correction in the receiving app. The sender editor warns about this explicitly. Changing a local record never silently overwrites a conflicting received record.
- Service-worker cache v7; no automatic data reset, history migration/deletion, production sample records or new dependencies.

## Verification
Final verification: syntax checks, all 7 server tests and all 50 browser tests passed, including 8 record-management tests.

Coverage: actual IndexedDB edit/delete/reload; expense/income totals, balance and dashboard; source reassignment and combined filters; source-delete cancellation and cascade isolation; stale writes and orphan prevention; subscription payment consistency; deleted inbox receipt replay; pending outbox cancellation. Last-content bounds are tested at maximum scroll across Home, Dashboard, Balance, Income, Expenses and Subscriptions at 320×568, 390×664 and 844×390, in both themes. Additional test simulates a 46px dock bottom offset. Narrow phone expense screenshots reviewed locally.

Limitations: Chromium geometry/gesture tests are not physical iPhone Safari/PWA verification. Production rollout and actual safe-area/keyboard/inertial scrolling must still be checked on device. These controls modify the current local database, not backups already exported or copies in other browser containers.
