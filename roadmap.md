# Roadmap

## Open

- Possible third persona-field removal: the user's message was cut off after "and remove" — awaiting clarification.

## Done (latest)

- Invite link now always opens directly on the account creation form with the sender's name in the banner; the link is built from the current site address, so it works on any domain the app is deployed to. Verified signed-out in the live preview.

## Done (recent)

- Persona creation form: removed the "Gender (voice)" selector and replaced "Age range" with a single "Age" field (still stored in the existing profile data). Verified in the live preview.
- Invite sharing: WhatsApp, Telegram, X, and Copy Link buttons in Directory & matching with the pre-filled AI Match Challenge text; inviter featured at the top of the friend's match list with an "Invited you" badge. Confirmed no GitHub connector code exists (the idea was dropped) and speaker buttons stay removed. Verified in the live preview; 28 tests pass.
- Invite flow: Directory link copying, signup invite banner, signup profile creation fallback, automatic invited AI chat pairing with retry/resume, and per-message speaker-button removal. Verified end-to-end with two real test signups, conversation readback, and no duplicate after reload; 25 targeted tests pass.
- Remix setup: updated `SECURITY_QUESTION_PEPPER` and `OPENAI_API_KEY` through the secure form; verified copied migrations are already absent and the PostgreSQL migration journal has no entries. No database changes were made.
- Resume scanner error surfacing: real failure reason now shown instead of the generic "Edge Function returned a non-2xx status code" (`describeScanError` + tests, all passing).
