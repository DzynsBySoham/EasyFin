# Optional Safari → app expense inbox

## Status
Implemented and tested with an in-memory relay via two isolated Chromium browser contexts. Not configured on production; not physically tested on iPhone. This is an expense transfer inbox, NOT shared IndexedDB or full financial sync. No native distribution is required for the inbox; the separate native launcher still requires signing/installing.

## Deployment
Create a private Upstash-compatible Redis REST instance, then configure these **server-only** Vercel environment variables and redeploy:

- `EASYFIN_INBOX_ENABLED=true`
- `UPSTASH_REDIS_REST_URL` (HTTPS REST endpoint)
- `UPSTASH_REDIS_REST_TOKEN` (private REST credential)

Never put the Redis credential in HTML, public JS, URLs, Git, or chat. Disabled/missing configuration leaves expense tracking local and shows an unavailable message rather than a fake connection. `/api/inbox` GET reports only configuration status, not a live storage health check. Monitor provider limits, usage and billing before enabling a public deployment. The application uses Redis only as a bounded encrypted transient transport, not as the financial source of truth.

## Pairing
1. In the **Home Screen app**, Settings → Connect Safari Quick Add → Create private connection.
2. Copy the private setup link and open it in Safari. Only accept a link you created in your own main app.
3. Confirm Connect. Existing Safari records are not sent automatically.
4. Use your existing Shortcut Quick Add link. A new expense commits locally with an encrypted outbox envelope before any upload is attempted.
5. Open Home Screen EasyFin to import. Settings also has manual import/retry controls.

The private link contains a sender write capability and AES key in its URL fragment. It does not contain receiver read/revoke credentials. The fragment is removed immediately by the document bootstrap; no-referrer is set. Treat clipboard and any copied link as sensitive. Anyone holding it can create valid encrypted entries; never share it. Encryption protects contents from the relay, not compromised browser code, extensions, clipboard access, traffic timing/size analysis, or a compromised deployment.

## Delivery and recovery
- AES-GCM encrypts each expense with a random IV and authenticated pair/envelope identifiers.
- IndexedDB v2 preserves original stores and adds a durable outbox and deduplication receipts.
- Receiver commits expense, subscription effects (if matched), and receipt together before acknowledgement. ID conflicts never overwrite original records. ACK retries cannot duplicate an import/payment.
- Sender retries on focus/online; receiver imports on focus/visibility or manual action. **No closed-app background import is promised.**
- Pair authorization expires after 30 days. Queue capacity is 200 encrypted entries. Pending queue storage expires 30 days after its last insertion; pair expiry does not grant further access. Import promptly and retain local backups.
- Explicit “Send existing Safari expenses…” previews count/total and requires a button press. It supports at most 200 existing expenses; larger histories should use the existing explicit JSON backup/merge workflow. This is not incremental history sync.
- Income, clients, settings and complete backups are never sent. Connection secrets are omitted from backup export and rejected on import. Restoring a replacement backup removes current pairing; reconnect explicitly afterwards. Unsent outbox records remain local and are not part of portable backups; the original expense records are included.
- Disconnect does not delete local expenses. Revoke removes the server pair/queue; import pending records before revoking. Never clear Safari storage or uninstall the main app as a troubleshooting step.
- Safari copies are retained after import: the receiving app is the main financial view, but this is not bidirectional synchronization. Later edits/deletions do not propagate. Recover using original IDs to avoid duplicate imports.

## Verification (2026-11-23)
`npm run check`, 7 server tests and 38 Chromium browser tests passed. New browser tests cover two independent databases, explicit pairing consent and fragment removal, ciphertext-only requests, import exactly once, offline reopening/retry, failed ACK with atomic subscription payment, tamper rejection, explicit history recovery, backup secret exclusion and v1 data-preserving upgrade. Existing tests cover month totals, combined filters, narrow widths and both themes, Quick Add gestures and local data persistence.

Still required before claiming live iPhone support: configure a real relay; deploy and test real Redis REST permissions/TTL/capacity; verify Safari and installed-PWA pairing, clipboard, Shortcut entry, app reopening, offline retries and revocation on a physical iPhone. Native authentication/launcher testing and any research-only jailbreak work are separate and unchanged.

## UI changes
Dark-theme-only brighter blue accent/primary sliders and balance card, with legible disabled states. Light accent colors unchanged. Long subscription names, narrow cancellation actions, dashboard breakdown icons and numeric wrapping receive layout safeguards across themes. No new animation or permission prompt.
