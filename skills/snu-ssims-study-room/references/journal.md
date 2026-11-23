# 같은 PC의 신청 시도 기록

The journal uses local Node.js 24 or later with built-in `node:sqlite`. It has no network access. It does not drive Chrome or determine what SSIMS accepted. Give it outcomes only after evaluating official evidence under [the browser workflow](ssims.md).

Run these from the skill folder. Run `init` as part of installation. If the helper reports an earlier supported journal version after an upgrade, rerun `init` on the original journal to migrate it in place. On Windows the stable per-user file is `%LOCALAPPDATA%/SnuSsimsStudyRoom/attempts.sqlite`; on macOS/Linux the stable per-user directory is under `~/.snu-ssims-study-room/`. Allow ordinary access only to this specific local state directory if the host requires it. Read-only search still works without Node or access to this journal. If the database is missing after installation or its origin is uncertain, restore the original or reconcile earlier requests in SSIMS before recreating it. Do not create another file to proceed with a blocked submission.

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
node scripts/attempts.mjs check '2026-11-27T16:00+09:00' '2026-11-27T18:00+09:00'
node scripts/attempts.mjs claim '2026-11-27T16:00+09:00' '2026-11-27T18:00+09:00' '<room-base64url>'
node scripts/attempts.mjs settle '<attempt-id>' received
```

- `check` is read-only and shows overlapping attempts. `claim` atomically records an unresolved attempt for one exact interval before any possibly committing action. If it returns `blocked`, errors, or its response is lost, stop and reconcile. Only the open run that successfully claimed may act on that application.
- `settle <attempt-id> received` records a directly connected official receipt or a reliably new matching official row. `not-received` requires a definitive official response that no application was accepted. After receipt, use `cancelled` or `denied` only when the same official record shows cancellation or denial. If the exact earlier attempt or account cannot be linked to the evidence, preserve its current state. A new chat never treats a currently empty list as evidence of nonreceipt.
- The small journal stores a UUID, room label, interval, creation time and state. It conservatively blocks overlapping attempts across all reservation campuses and browser profiles on the same OS user. It does not sync between devices. It can never validate duplicate state for manual actions or another computer, so use the student's official reservation list as well. Adjacent, nonoverlapping intervals can proceed independently.
