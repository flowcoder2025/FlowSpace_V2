import type { AdminCommandType, ParsedInput } from "./chat-types";

const ADMIN_COMMANDS: AdminCommandType[] = ["mute", "unmute", "kick", "announce"];

/**
 * 입력 파싱
 *
 * 우선순위:
 * 1. Admin command: @mute/@unmute/@kick/@announce
 * 2. Whisper: /닉네임 메시지
 * 3. Regular message
 */
export function parseInput(
  input: string,
  options?: { isAdmin?: boolean }
): ParsedInput {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { type: "message", content: "" };
  }

  // 1. Admin command: @command
  if (trimmed.startsWith("@") && options?.isAdmin) {
    const parsed = parseAdminCommand(trimmed);
    if (parsed) return parsed;
  }

  // 2. Whisper: /nickname message
  if (trimmed.startsWith("/")) {
    const parsed = parseWhisper(trimmed);
    if (parsed) return parsed;
  }

  // 3. Regular message
  return { type: "message", content: trimmed };
}

/** Admin 명령어 파싱 */
function parseAdminCommand(input: string): ParsedInput | null {
  // @mute 닉네임 [duration]
  // @unmute 닉네임
  // @kick 닉네임
  // @announce 메시지
  const withoutAt = input.slice(1);
  const spaceIndex = withoutAt.indexOf(" ");

  if (spaceIndex === -1) return null;

  const command = withoutAt.slice(0, spaceIndex).toLowerCase();
  const rest = withoutAt.slice(spaceIndex + 1).trim();

  if (!ADMIN_COMMANDS.includes(command as AdminCommandType)) return null;

  if (command === "announce") {
    return {
      type: "admin",
      content: rest,
      adminCommand: "announce",
    };
  }

  // mute/unmute/kick: 타겟 닉네임 추출
  const targetParts = rest.split(" ");
  const targetNickname = targetParts[0];

  if (!targetNickname) return null;

  return {
    type: "admin",
    content: rest,
    targetNickname,
    adminCommand: command as AdminCommandType,
  };
}

/** 귓속말 파싱: /닉네임 메시지 */
function parseWhisper(input: string): ParsedInput | null {
  const withoutSlash = input.slice(1);
  const spaceIndex = withoutSlash.indexOf(" ");

  if (spaceIndex === -1) return null;

  const targetNickname = withoutSlash.slice(0, spaceIndex).trim();
  const content = withoutSlash.slice(spaceIndex + 1).trim();

  if (!targetNickname || !content) return null;

  return {
    type: "whisper",
    content,
    targetNickname,
  };
}
