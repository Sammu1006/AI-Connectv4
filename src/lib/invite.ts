const KEY = "persona-invite";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVITE_TOPIC = "AI Match Challenge";

export interface PendingInvite { inviterId: string; inviterName: string | null }

const parseInvite = (value: unknown): PendingInvite | null => {
  if (!value || typeof value !== "object" || !("inviterId" in value) ||
    typeof value.inviterId !== "string" || !UUID_PATTERN.test(value.inviterId)) return null;
  const name = "inviterName" in value && typeof value.inviterName === "string"
    ? value.inviterName.trim().slice(0, 60) || null : null;
  return { inviterId: value.inviterId, inviterName: name };
};

export const buildInviteLink = (origin: string, userId: string, name?: string | null) => {
  const url = new URL("/", origin);
  url.searchParams.set("invite", userId);
  if (name) url.searchParams.set("from", name);
  return url.toString();
};

export const INVITE_SHARE_TEXT =
  "My AI persona is waiting to debate yours! Create your persona here and see if we score over 65%:";

/** One-click share targets for the AI Match Challenge invite. */
export const buildShareLinks = (inviteLink: string) => {
  const text = `${INVITE_SHARE_TEXT} ${inviteLink}`;
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(INVITE_SHARE_TEXT)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
  };
};

/** Reads ?invite= from the URL, stores it, and strips it from the address bar. */
export const captureInviteFromUrl = (): PendingInvite | null => {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const inviterId = params.get("invite");
  if (inviterId && UUID_PATTERN.test(inviterId)) {
    const invite = parseInvite({ inviterId, inviterName: params.get("from") });
    if (!invite) return readPendingInvite();
    try { localStorage.setItem(KEY, JSON.stringify(invite)); } catch { /* Keep the invite in page state. */ }
    params.delete("invite"); params.delete("from");
    const qs = params.toString();
    window.history.replaceState(window.history.state, "", window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash);
    return invite;
  }
  return readPendingInvite();
};

export const readPendingInvite = (): PendingInvite | null => {
  try { const raw = localStorage.getItem(KEY); return raw ? parseInvite(JSON.parse(raw)) : null; } catch { return null; }
};

export const clearPendingInvite = () => {
  try { localStorage.removeItem(KEY); } catch { /* Storage may be unavailable. */ }
};

type InviteConversation = { id: string; created_by: string; topic: string | null };
type InviteLaunch = {
  action: "start_conversation";
  targetUserIds: string[];
  mode: "chat";
  topic: string;
  rounds: number;
};

/** Reuse an already-started invite run when returning after a refresh or interrupted response. */
export const pairInvitedPersonas = async ({
  invite, currentUserId, conversations, participantsByConversation, startConversation,
}: {
  invite: PendingInvite;
  currentUserId: string;
  conversations: InviteConversation[];
  participantsByConversation: Record<string, string[]>;
  startConversation: (payload: InviteLaunch) => Promise<string>;
}): Promise<string | null> => {
  if (invite.inviterId === currentUserId) return null;
  const existing = conversations.find((conversation) => {
    const participants = participantsByConversation[conversation.id] ?? [];
    return conversation.created_by === currentUserId && conversation.topic === INVITE_TOPIC &&
      participants.length === 2 && participants.includes(currentUserId) && participants.includes(invite.inviterId);
  });
  if (existing) return existing.id;
  const conversationId = await startConversation({
    action: "start_conversation", targetUserIds: [invite.inviterId], mode: "chat", topic: INVITE_TOPIC, rounds: 7,
  });
  if (!conversationId) throw new Error("The invite conversation could not be started.");
  return conversationId;
};
