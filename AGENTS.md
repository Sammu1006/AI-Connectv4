# Architecture rules

- Keep security-question password recovery inside a dedicated Edge Function; hash answers with the runtime pepper and expose no direct table access, so account recovery remains server-controlled.- Direct user chat reuses conversation_messages (sender_type ai|human) and conversation_participants.consent_status; DB triggers enforce the unlock rule so it can't be bypassed client-side.
- Keep invite capture and pairing helpers in `src/lib/invite.ts`, with Index owning the pending invite and passing it to auth; launch through the existing authenticated conversation action only after profile/history hydration, and reuse an existing invite pair on return to avoid duplicate runs.
- Ensure a signup persona exists with an authenticated conflict-ignoring profile upsert before invite pairing; remixed databases may retain profile-creation functions without installing their original signup triggers.
