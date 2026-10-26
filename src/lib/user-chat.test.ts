import { describe, expect, it } from "vitest";
import { getUserChatState } from "./user-chat";

describe("user chat unlock", () => {
  it("stays locked below 65%", () => {
    expect(getUserChatState("completed", 64, ["accepted", "accepted"])).toBe("below_threshold");
  });
  it("offers connection at exactly 65%", () => {
    expect(getUserChatState("completed", 65, ["accepted", "none"])).toBe("awaiting");
  });
  it("opens only when both users accept", () => {
    expect(getUserChatState("completed", 80, ["accepted", "accepted"])).toBe("connected");
  });
  it("stays closed if anyone passes", () => {
    expect(getUserChatState("completed", 90, ["accepted", "declined"])).toBe("declined");
  });
  it("is locked while the AI chat is running", () => {
    expect(getUserChatState("active", 90, ["accepted", "accepted"])).toBe("running");
  });
});
