export const USER_CHAT_THRESHOLD = 65;

export type ConsentStatus = "none" | "accepted" | "declined";

export type UserChatState = "running" | "below_threshold" | "awaiting" | "declined" | "connected";

/** Decide whether the direct user chat is open for a finished AI conversation. */
export const getUserChatState = (
  conversationStatus: string,
  score: number | null | undefined,
  consents: ConsentStatus[],
): UserChatState => {
  if (conversationStatus === "active" || conversationStatus === "draft") return "running";
  if (score == null || score < USER_CHAT_THRESHOLD) return "below_threshold";
  if (consents.some((c) => c === "declined")) return "declined";
  if (consents.length > 1 && consents.every((c) => c === "accepted")) return "connected";
  return "awaiting";
};
