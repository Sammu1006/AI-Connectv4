import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildInviteLink, buildShareLinks, captureInviteFromUrl, clearPendingInvite, INVITE_SHARE_TEXT, pairInvitedPersonas, readPendingInvite } from "./invite";

const inviterId = "11111111-1111-4111-8111-111111111111";
const inviteeId = "22222222-2222-4222-8222-222222222222";
const invite = { inviterId, inviterName: "Sam & Jo" };

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("invite links", () => {
  it("shares the inviting user's identity and safely encodes their name", () => {
    const link = new URL(buildInviteLink("https://example.com", inviterId, "Sam & Jo"));
    expect(link.origin).toBe("https://example.com");
    expect(link.pathname).toBe("/");
    expect(link.searchParams.get("invite")).toBe(inviterId);
    expect(link.searchParams.get("from")).toBe("Sam & Jo");
  });

  it("captures an incoming invite and retains it through signup reloads", () => {
    window.history.replaceState(null, "", `/?invite=${inviterId}&from=Sam%20%26%20Jo&next=profile#signup`);
    expect(captureInviteFromUrl()).toEqual(invite);
    expect(readPendingInvite()).toEqual(invite);
    expect(window.location.search).toBe("?next=profile");
    expect(window.location.hash).toBe("#signup");
    expect(captureInviteFromUrl()).toEqual(invite);
  });

  it("ignores malformed inviter IDs rather than trying to pair them", () => {
    window.history.replaceState(null, "", `/?invite=${"-".repeat(36)}`);
    expect(captureInviteFromUrl()).toBeNull();
    localStorage.setItem("persona-invite", JSON.stringify({ inviterId: "not-an-account" }));
    expect(readPendingInvite()).toBeNull();
  });

  it("caps names captured from invite links", () => {
    window.history.replaceState(null, "", `/?invite=${inviterId}&from=${"a".repeat(80)}`);
    expect(captureInviteFromUrl()?.inviterName).toBe("a".repeat(60));
  });

  it("clears a completed or dismissed invite", () => {
    localStorage.setItem("persona-invite", JSON.stringify(invite));
    clearPendingInvite();
    expect(readPendingInvite()).toBeNull();
  });
});

describe("social share links", () => {
  const link = buildInviteLink("https://example.com", inviterId, "Sam");
  const share = buildShareLinks(link);

  it("pre-fills every share target with the challenge text and invite link", () => {
    for (const url of [share.whatsapp, share.telegram, share.x]) {
      expect(decodeURIComponent(url)).toContain(INVITE_SHARE_TEXT);
      expect(decodeURIComponent(url)).toContain(link);
    }
  });

  it("targets the WhatsApp, Telegram, and X share endpoints", () => {
    expect(share.whatsapp.startsWith("https://wa.me/?text=")).toBe(true);
    expect(share.telegram.startsWith("https://t.me/share/url?")).toBe(true);
    expect(share.x.startsWith("https://twitter.com/intent/tweet?text=")).toBe(true);
  });
});

describe("automatic invite pairing", () => {
  it("starts an AI chat with only the inviting friend's persona", async () => {
    const startConversation = vi.fn().mockResolvedValue("new-conversation");
    expect(await pairInvitedPersonas({ invite, currentUserId: inviteeId, conversations: [], participantsByConversation: {}, startConversation })).toBe("new-conversation");
    expect(startConversation).toHaveBeenCalledExactlyOnceWith({ action: "start_conversation", targetUserIds: [inviterId], mode: "chat", topic: "AI Match Challenge", rounds: 7 });
  });

  it("does not pair a user with their own invite", async () => {
    const startConversation = vi.fn();
    expect(await pairInvitedPersonas({ invite, currentUserId: inviterId, conversations: [], participantsByConversation: {}, startConversation })).toBeNull();
    expect(startConversation).not.toHaveBeenCalled();
  });

  it("reuses a previously launched invite pair instead of duplicating it", async () => {
    const startConversation = vi.fn();
    expect(await pairInvitedPersonas({ invite, currentUserId: inviteeId, conversations: [{ id: "existing", created_by: inviteeId, topic: "AI Match Challenge" }], participantsByConversation: { existing: [inviterId, inviteeId] }, startConversation })).toBe("existing");
    expect(startConversation).not.toHaveBeenCalled();
  });

  it("does not reuse a group conversation as an invited pair", async () => {
    const startConversation = vi.fn().mockResolvedValue("new-pair");
    expect(await pairInvitedPersonas({ invite, currentUserId: inviteeId, conversations: [{ id: "group", created_by: inviteeId, topic: "AI Match Challenge" }], participantsByConversation: { group: [inviterId, inviteeId, "third-person"] }, startConversation })).toBe("new-pair");
    expect(startConversation).toHaveBeenCalledOnce();
  });

  it("keeps the pending invite when pairing fails so it can be retried", async () => {
    localStorage.setItem("persona-invite", JSON.stringify(invite));
    await expect(pairInvitedPersonas({ invite, currentUserId: inviteeId, conversations: [], participantsByConversation: {}, startConversation: vi.fn().mockRejectedValue(new Error("Unavailable")) })).rejects.toThrow("Unavailable");
    expect(readPendingInvite()).toEqual(invite);
  });

  it("rejects a missing conversation result rather than treating it as paired", async () => {
    await expect(pairInvitedPersonas({ invite, currentUserId: inviteeId, conversations: [], participantsByConversation: {}, startConversation: vi.fn().mockResolvedValue("") })).rejects.toThrow("could not be started");
  });
});