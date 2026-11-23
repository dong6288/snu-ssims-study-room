# 같은 PC의 신청 시도 기록

The journal uses local Node.js 24 or later with built-in `node:sqlite`. It has no network access. It does not drive Chrome or determine what SSIMS accepted. Give it outcomes only after evaluating official evidence under [the browser workflow](ssims.md).

Run these from the skill folder. On Windows the stable per-user file is `%LOCALAPPDATA%/SnuSsimsStudyRoom/attempts.sqlite`. The helper uses `~/.snu-ssims-study-room/` on macOS/Linux. Allow ordinary access only to this specific local state directory if the host requires it.

For an application, verify Node.js 24 or later with `node --version`, then run `status` before filling the form or asking the student to enter participant details. `ready` means the existing journal can be read. It does not check an interval or authorize submission. If preflight fails, explain the missing prerequisite in Korean and keep lookup available. For first-time application setup, give the `init` instructions. If the database is missing after prior use or its origin is uncertain, restore the original or reconcile earlier requests in SSIMS before recreating it. Do not automatically run `init` during a booking request or create another file to proceed with a blocked submission. If the helper reports an earlier supported journal version, the student can run `init` on the original journal to migrate it in place.

Encode the visible room label outside the shell. With the Chrome tool, use a read-only callback on the verified room title element so the page text is read as data. In a structured Node tool with a separate data argument, `Buffer.from(roomLabel, 'utf8').toString('base64url')` is equivalent. Keep the callback's source fixed and use only the title value.

```javascript
titleLocator.evaluate(element => {
  const bytes = new TextEncoder().encode(element.textContent.trim());
  const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
});
```

Before assembling a shell command, verify the resulting room token contains only ASCII letters, digits, `_`, or `-`. The date and time arguments must match the exact KST syntax shown below. Attempt IDs must come from the journal as a UUID. Use only the named outcomes. If a safe structured encoding path is unavailable, use read-only lookup or hand off in Chrome.

```powershell
node scripts/attempts.mjs init
node scripts/attempts.mjs status
node scripts/attempts.mjs check '2026-11-27T16:00+09:00' '2026-11-27T18:00+09:00'
node scripts/attempts.mjs claim '2026-11-27T16:00+09:00' '2026-11-27T18:00+09:00' '<room-base64url>'
node scripts/attempts.mjs hold '2026-11-27T16:00+09:00' '2026-11-27T18:00+09:00' '<room-base64url>'
node scripts/attempts.mjs settle '<attempt-id>' received
```

- `status` reads the journal format without creating the database or returning attempt details. `check` is read-only and reports just `clear` or `blocked`. `claim` atomically records an unresolved attempt for one exact interval before any possibly committing action. It returns only `blocked` on overlap. A structured `blocked` result exits with code 2. If either command is blocked, errors, or has an unclear result, stop and reconcile. Only the open run that successfully claimed may act on that approved application.
- `hold` records a possible submission made by the student during handoff. Use it once when the exact prior room and interval are known under the [recovery workflow](ssims.md#after-submission-or-interruption). It protects the entire interval even if another record already overlaps part of it. `held` never permits a submission click. Keep the returned ID in the originating task for evidence-based reconciliation.
- `settle <attempt-id> received` records a directly connected official receipt or a reliably new matching official row. `not-received` requires a definitive official response that no application was accepted. After receipt, use `cancelled` or `denied` only when the same official record shows cancellation or denial. If the exact earlier attempt or account cannot be linked to the evidence, preserve its current state. A new chat never treats a currently empty list as evidence of nonreceipt.
- The small journal stores a UUID, room label, interval, creation time and state. It conservatively blocks overlapping attempts across all reservation campuses and browser profiles on the same OS user. It does not sync between devices. It can never validate duplicate state for manual actions or another computer, so use the student's official reservation list as well. Adjacent, nonoverlapping intervals can proceed independently.
