import { describe, it, expect } from "vitest";
import {
  parseInput,
  isWhisperFormat,
  extractTargetNickname,
  getAdminCommandSuggestions,
} from "./chat-parser";

describe("parseInput", () => {
  // ── Regular Messages ──
  it("should parse regular message", () => {
    const result = parseInput("hello world");
    expect(result).toEqual({ type: "message", content: "hello world" });
  });

  it("should return empty message for whitespace", () => {
    const result = parseInput("   ");
    expect(result).toEqual({ type: "message", content: "" });
  });

  // ── Whisper ──
  it("should parse whisper: /nickname message", () => {
    const result = parseInput("/홍길동 안녕하세요");
    expect(result).toEqual({
      type: "whisper",
      content: "안녕하세요",
      targetNickname: "홍길동",
    });
  });

  it("should not parse whisper without message", () => {
    const result = parseInput("/홍길동");
    expect(result).toEqual({ type: "message", content: "/홍길동" });
  });

  it("should not parse whisper without target", () => {
    const result = parseInput("/ message");
    expect(result).toEqual({ type: "message", content: "/ message" });
  });

  // ── Admin Commands (English) ──
  it("should parse @mute command for admin", () => {
    const result = parseInput("@mute 홍길동", { isAdmin: true });
    expect(result).toEqual({
      type: "admin",
      content: "홍길동",
      targetNickname: "홍길동",
      adminCommand: "mute",
    });
  });

  it("should parse @announce command", () => {
    const result = parseInput("@announce 서버 점검 안내", { isAdmin: true });
    expect(result).toEqual({
      type: "admin",
      content: "서버 점검 안내",
      adminCommand: "announce",
    });
  });

  it("should parse @help without arguments", () => {
    const result = parseInput("@help", { isAdmin: true });
    expect(result).toEqual({
      type: "admin",
      content: "",
      adminCommand: "help",
    });
  });

  it("should not parse admin commands for non-admin", () => {
    const result = parseInput("@mute 홍길동");
    expect(result).toEqual({ type: "message", content: "@mute 홍길동" });
  });

  // ── Admin Commands (Korean aliases) ──
  it("should parse @음소거 (Korean alias)", () => {
    const result = parseInput("@음소거 홍길동", { isAdmin: true });
    expect(result).toEqual({
      type: "admin",
      content: "홍길동",
      targetNickname: "홍길동",
      adminCommand: "mute",
    });
  });

  it("should parse @공지 (Korean alias)", () => {
    const result = parseInput("@공지 서버 점검", { isAdmin: true });
    expect(result).toEqual({
      type: "admin",
      content: "서버 점검",
      adminCommand: "announce",
    });
  });

  it("should parse @강퇴 (Korean alias)", () => {
    const result = parseInput("@강퇴 홍길동", { isAdmin: true });
    expect(result).toEqual({
      type: "admin",
      content: "홍길동",
      targetNickname: "홍길동",
      adminCommand: "kick",
    });
  });

  it("should parse @도움말 (Korean alias)", () => {
    const result = parseInput("@도움말", { isAdmin: true });
    expect(result).toEqual({
      type: "admin",
      content: "",
      adminCommand: "help",
    });
  });

  it("should parse @근접 on (Korean alias)", () => {
    const result = parseInput("@근접 on", { isAdmin: true });
    expect(result).toEqual({
      type: "admin",
      content: "on",
      adminCommand: "proximity",
    });
  });

  // ── Admin commands without required args ──
  it("should not parse @mute without target", () => {
    const result = parseInput("@mute", { isAdmin: true });
    expect(result).toEqual({ type: "message", content: "@mute" });
  });

  it("should not parse @announce without content", () => {
    const result = parseInput("@announce", { isAdmin: true });
    expect(result).toEqual({ type: "message", content: "@announce" });
  });

  // ── Editor Commands ──
  it("should parse editor command with config", () => {
    const result = parseInput("@place type=chair x=10", {
      isAdmin: true,
      editorConfig: { commands: ["place", "remove"] },
    });
    expect(result).toEqual({
      type: "editor_command",
      content: "place",
      editorParams: { type: "chair", x: "10" },
    });
  });

  it("should not parse editor command without config", () => {
    const result = parseInput("@place type=chair", { isAdmin: true });
    // Falls through to admin command parsing, no match → regular message
    expect(result).toEqual({ type: "message", content: "@place type=chair" });
  });

  // ── Priority: editor > admin ──
  it("should prioritize editor over admin when command matches", () => {
    const result = parseInput("@mute key=val", {
      isAdmin: true,
      editorConfig: { commands: ["mute"] },
    });
    // "mute" is in editorConfig, so it should be parsed as editor_command
    expect(result.type).toBe("editor_command");
  });
});

describe("isWhisperFormat", () => {
  it("should return true for /nickname", () => {
    expect(isWhisperFormat("/홍길동")).toBe(true);
  });

  it("should return false for //", () => {
    expect(isWhisperFormat("//")).toBe(false);
  });

  it("should return false for regular text", () => {
    expect(isWhisperFormat("hello")).toBe(false);
  });
});

describe("extractTargetNickname", () => {
  it("should extract nickname from partial input", () => {
    expect(extractTargetNickname("/홍길동")).toBe("홍길동");
  });

  it("should extract nickname before space", () => {
    expect(extractTargetNickname("/홍길동 안녕")).toBe("홍길동");
  });

  it("should return null for non-whisper", () => {
    expect(extractTargetNickname("hello")).toBeNull();
  });
});

describe("getAdminCommandSuggestions", () => {
  it("should return all aliases for @", () => {
    const suggestions = getAdminCommandSuggestions("@");
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions).toContain("mute");
    expect(suggestions).toContain("음소거");
  });

  it("should filter by partial input", () => {
    const suggestions = getAdminCommandSuggestions("@mu");
    expect(suggestions).toContain("mute");
    expect(suggestions).not.toContain("kick");
  });

  it("should return empty for non-@ input", () => {
    expect(getAdminCommandSuggestions("hello")).toEqual([]);
  });
});
