import type { AdminCommandType, ParsedInput } from "./chat-types";
import { ADMIN_COMMAND_ALIASES } from "./chat-constants";

/** 에디터 명령어 설정 (모듈 경계 유지를 위해 옵션으로 주입) */
interface EditorCommandConfig {
  commands: string[];
}

interface ParseOptions {
  isAdmin?: boolean;
  editorConfig?: EditorCommandConfig;
}

// ── 유효한 관리자 명령어 ──
const VALID_ADMIN_COMMANDS: AdminCommandType[] = [
  "mute", "unmute", "kick", "announce", "ban", "help", "proximity",
];

/**
 * 입력 파싱
 *
 * 우선순위:
 * 1. Editor command: @+config (isAdmin && editorConfig)
 * 2. Admin command: @mute/@unmute/@kick/@announce/@ban/@help/@proximity (한/영)
 * 3. Whisper: /닉네임 메시지
 * 4. Regular message
 */
export function parseInput(
  input: string,
  options?: ParseOptions
): ParsedInput {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { type: "message", content: "" };
  }

  // 1. @ 시작: 에디터 or 관리자 명령어
  if (trimmed.startsWith("@")) {
    // 1a. 에디터 명령어 체크 (editorConfig가 있고 admin인 경우)
    if (options?.isAdmin && options.editorConfig) {
      const editorParsed = parseEditorCommand(trimmed, options.editorConfig);
      if (editorParsed) return editorParsed;
    }

    // 1b. 관리자 명령어
    if (options?.isAdmin) {
      const parsed = parseAdminCommand(trimmed);
      if (parsed) return parsed;
    }
  }

  // 2. Whisper: /nickname message
  if (trimmed.startsWith("/")) {
    const parsed = parseWhisper(trimmed);
    if (parsed) return parsed;
  }

  // 3. Regular message
  return { type: "message", content: trimmed };
}

/** Admin 명령어 파싱 (한/영 별칭 지원) */
function parseAdminCommand(input: string): ParsedInput | null {
  const withoutAt = input.slice(1);
  const spaceIndex = withoutAt.indexOf(" ");

  // help/도움말은 인자 없이도 동작
  const rawCommand = spaceIndex === -1 ? withoutAt : withoutAt.slice(0, spaceIndex);
  const rest = spaceIndex === -1 ? "" : withoutAt.slice(spaceIndex + 1).trim();

  // 한/영 별칭 해석
  const normalizedCommand = ADMIN_COMMAND_ALIASES[rawCommand.toLowerCase()];
  if (!normalizedCommand) return null;
  if (!VALID_ADMIN_COMMANDS.includes(normalizedCommand as AdminCommandType)) return null;

  const command = normalizedCommand as AdminCommandType;

  // help 명령어: 인자 불필요
  if (command === "help") {
    return {
      type: "admin",
      content: rest,
      adminCommand: "help",
    };
  }

  // announce/proximity: 내용 필요
  if (command === "announce" || command === "proximity") {
    if (!rest) return null;
    return {
      type: "admin",
      content: rest,
      adminCommand: command,
    };
  }

  // mute/unmute/kick/ban: 타겟 닉네임 추출
  const targetParts = rest.split(" ");
  const targetNickname = targetParts[0];
  if (!targetNickname) return null;

  return {
    type: "admin",
    content: rest,
    targetNickname,
    adminCommand: command,
  };
}

/** 에디터 명령어 파싱 */
function parseEditorCommand(
  input: string,
  config: EditorCommandConfig
): ParsedInput | null {
  const withoutAt = input.slice(1);
  const spaceIndex = withoutAt.indexOf(" ");
  const command = spaceIndex === -1 ? withoutAt : withoutAt.slice(0, spaceIndex);
  const rest = spaceIndex === -1 ? "" : withoutAt.slice(spaceIndex + 1).trim();

  if (!config.commands.includes(command.toLowerCase())) return null;

  // 파라미터 파싱: key=value key2=value2
  const params: Record<string, string> = {};
  if (rest) {
    const pairs = rest.match(/(\w+)=("[^"]*"|\S+)/g);
    if (pairs) {
      for (const pair of pairs) {
        const eqIdx = pair.indexOf("=");
        const key = pair.slice(0, eqIdx);
        let value = pair.slice(eqIdx + 1);
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        params[key] = value;
      }
    }
  }

  return {
    type: "editor_command",
    content: command.toLowerCase(),
    editorParams: params,
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

// ── 유틸리티 헬퍼 ──

/** 귓속말 형식인지 확인 */
export function isWhisperFormat(input: string): boolean {
  const trimmed = input.trim();
  return trimmed.startsWith("/") && trimmed.length > 1 && !trimmed.startsWith("//");
}

/** 타겟 닉네임 추출 (입력 중 프리뷰용) */
export function extractTargetNickname(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  const withoutSlash = trimmed.slice(1);
  const spaceIndex = withoutSlash.indexOf(" ");

  if (spaceIndex === -1) {
    return withoutSlash.length > 0 ? withoutSlash : null;
  }

  return withoutSlash.slice(0, spaceIndex) || null;
}

/** 에디터 명령어 형식인지 확인 */
export function isEditorCommandFormat(input: string): boolean {
  return input.trim().startsWith("@") && input.trim().length > 1;
}

/** 에디터 명령어 자동완성 후보 */
export function getEditorCommandSuggestions(
  input: string,
  config?: EditorCommandConfig
): string[] {
  if (!config || !input.startsWith("@")) return [];

  const partial = input.slice(1).toLowerCase();
  return config.commands.filter((cmd) => cmd.startsWith(partial));
}

/** 관리자 명령어 자동완성 후보 (한/영) */
export function getAdminCommandSuggestions(input: string): string[] {
  if (!input.startsWith("@")) return [];

  const partial = input.slice(1).toLowerCase();
  if (!partial) return Object.keys(ADMIN_COMMAND_ALIASES);

  return Object.keys(ADMIN_COMMAND_ALIASES).filter((alias) =>
    alias.startsWith(partial)
  );
}
