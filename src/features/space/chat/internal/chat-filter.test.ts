import { describe, it, expect } from "vitest";
import {
  filterMessagesByTab,
  hasUrl,
  extractUrls,
  ensureProtocol,
  parseContentWithUrls,
  isLinkMessage,
  getWhisperDirection,
  calculateUnreadCounts,
} from "./chat-filter";
import type { ChatMessage, ChatTab } from "./chat-types";

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "msg-1",
    userId: "user-1",
    nickname: "TestUser",
    content: "hello",
    type: "message",
    timestamp: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("filterMessagesByTab", () => {
  const messages: ChatMessage[] = [
    makeMessage({ id: "1", type: "message", content: "일반 메시지" }),
    makeMessage({ id: "2", type: "party", content: "파티 메시지" }),
    makeMessage({ id: "3", type: "whisper", userId: "user-1", targetNickname: "Other" }),
    makeMessage({ id: "4", type: "system", content: "시스템" }),
    makeMessage({ id: "5", type: "announcement", content: "공지" }),
    makeMessage({ id: "6", type: "message", content: "https://example.com" }),
  ];

  it("all tab returns all messages", () => {
    expect(filterMessagesByTab(messages, "all", "user-1")).toHaveLength(6);
  });

  it("party tab filters party messages", () => {
    const filtered = filterMessagesByTab(messages, "party", "user-1");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].type).toBe("party");
  });

  it("whisper tab filters whisper messages", () => {
    const filtered = filterMessagesByTab(messages, "whisper", "user-1");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].type).toBe("whisper");
  });

  it("system tab includes system and announcement", () => {
    const filtered = filterMessagesByTab(messages, "system", "user-1");
    expect(filtered).toHaveLength(2);
  });

  it("links tab filters URL-containing messages (excluding system)", () => {
    const filtered = filterMessagesByTab(messages, "links", "user-1");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].content).toContain("example.com");
  });
});

describe("hasUrl", () => {
  it("detects http URLs", () => {
    expect(hasUrl("check http://example.com")).toBe(true);
  });

  it("detects https URLs", () => {
    expect(hasUrl("visit https://google.com")).toBe(true);
  });

  it("detects www. URLs", () => {
    expect(hasUrl("go to www.naver.com")).toBe(true);
  });

  it("returns false for plain text", () => {
    expect(hasUrl("no links here")).toBe(false);
  });
});

describe("extractUrls", () => {
  it("extracts multiple URLs", () => {
    const urls = extractUrls("check https://a.com and http://b.com");
    expect(urls).toEqual(["https://a.com", "http://b.com"]);
  });

  it("deduplicates URLs", () => {
    const urls = extractUrls("https://a.com https://a.com");
    expect(urls).toEqual(["https://a.com"]);
  });

  it("returns empty for no URLs", () => {
    expect(extractUrls("no links")).toEqual([]);
  });
});

describe("ensureProtocol", () => {
  it("adds https to www URLs", () => {
    expect(ensureProtocol("www.example.com")).toBe("https://www.example.com");
  });

  it("preserves existing http", () => {
    expect(ensureProtocol("http://example.com")).toBe("http://example.com");
  });

  it("preserves existing https", () => {
    expect(ensureProtocol("https://example.com")).toBe("https://example.com");
  });
});

describe("parseContentWithUrls", () => {
  it("parses text-only content", () => {
    const parts = parseContentWithUrls("hello world");
    expect(parts).toEqual([{ type: "text", value: "hello world" }]);
  });

  it("parses URL in content", () => {
    const parts = parseContentWithUrls("visit https://example.com now");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toEqual({ type: "text", value: "visit " });
    expect(parts[1].type).toBe("url");
    expect(parts[1].href).toBe("https://example.com");
    expect(parts[2]).toEqual({ type: "text", value: " now" });
  });

  it("truncates long URLs to 50 chars", () => {
    const longUrl = "https://example.com/" + "a".repeat(50);
    const parts = parseContentWithUrls(longUrl);
    expect(parts[0].type).toBe("url");
    expect(parts[0].value.length).toBeLessThanOrEqual(50);
    expect(parts[0].value).toContain("...");
  });
});

describe("isLinkMessage", () => {
  it("returns true for message with URL", () => {
    const msg = makeMessage({ content: "check https://example.com" });
    expect(isLinkMessage(msg)).toBe(true);
  });

  it("returns false for system message with URL", () => {
    const msg = makeMessage({ type: "system", content: "https://example.com" });
    expect(isLinkMessage(msg)).toBe(false);
  });

  it("returns false for announcement with URL", () => {
    const msg = makeMessage({ type: "announcement", content: "https://example.com" });
    expect(isLinkMessage(msg)).toBe(false);
  });
});

describe("getWhisperDirection", () => {
  it("returns sent for own messages", () => {
    const msg = makeMessage({ userId: "me" });
    expect(getWhisperDirection(msg, "me")).toBe("sent");
  });

  it("returns received for others' messages", () => {
    const msg = makeMessage({ userId: "other" });
    expect(getWhisperDirection(msg, "me")).toBe("received");
  });
});

describe("calculateUnreadCounts", () => {
  it("counts unread messages per tab", () => {
    const messages: ChatMessage[] = [
      makeMessage({ id: "1", userId: "other", type: "message", timestamp: "2026-01-02T00:00:00Z" }),
      makeMessage({ id: "2", userId: "other", type: "whisper", targetNickname: "me", timestamp: "2026-01-02T00:00:00Z" }),
      makeMessage({ id: "3", userId: "me", type: "message", timestamp: "2026-01-02T00:00:00Z" }),
    ];

    const lastRead: Record<ChatTab, string> = {
      all: "2026-01-01T00:00:00Z",
      party: "2026-01-01T00:00:00Z",
      whisper: "2026-01-01T00:00:00Z",
      system: "2026-01-01T00:00:00Z",
      links: "2026-01-01T00:00:00Z",
    };

    const counts = calculateUnreadCounts(messages, lastRead, "me");
    expect(counts.all).toBe(2); // excludes own message
    expect(counts.whisper).toBe(1);
    expect(counts.party).toBe(0);
  });
});
