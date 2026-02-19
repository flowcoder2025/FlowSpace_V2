/**
 * 명령어 힌트 및 도움말 모듈
 */

/** 명령어 카테고리 */
interface CommandHelp {
  command: string;
  alias?: string;
  description: string;
  usage: string;
  adminOnly: boolean;
}

const COMMAND_HELP_LIST: CommandHelp[] = [
  // ── 일반 ──
  {
    command: "/닉네임 메시지",
    description: "귓속말 보내기",
    usage: "/홍길동 안녕하세요",
    adminOnly: false,
  },
  // ── 관리자 ──
  {
    command: "@mute",
    alias: "@음소거",
    description: "사용자 채팅 금지",
    usage: "@mute 닉네임",
    adminOnly: true,
  },
  {
    command: "@unmute",
    alias: "@음소거해제",
    description: "사용자 채팅 금지 해제",
    usage: "@unmute 닉네임",
    adminOnly: true,
  },
  {
    command: "@kick",
    alias: "@강퇴",
    description: "사용자 추방",
    usage: "@kick 닉네임",
    adminOnly: true,
  },
  {
    command: "@ban",
    alias: "@차단",
    description: "사용자 차단",
    usage: "@ban 닉네임",
    adminOnly: true,
  },
  {
    command: "@announce",
    alias: "@공지",
    description: "공지사항 전송",
    usage: "@announce 공지 내용",
    adminOnly: true,
  },
  {
    command: "@help",
    alias: "@도움말",
    description: "명령어 도움말 표시",
    usage: "@help",
    adminOnly: true,
  },
  {
    command: "@proximity",
    alias: "@근접",
    description: "근접 채팅 범위 설정",
    usage: "@proximity 범위값",
    adminOnly: true,
  },
];

/** 도움말 텍스트 생성 */
export function generateHelpText(isAdmin: boolean): string {
  const lines: string[] = ["── 채팅 명령어 도움말 ──", ""];

  // 일반 명령어
  lines.push("■ 일반 명령어:");
  for (const cmd of COMMAND_HELP_LIST.filter((c) => !c.adminOnly)) {
    lines.push(`  ${cmd.command} — ${cmd.description}`);
    lines.push(`    예: ${cmd.usage}`);
  }

  // 관리자 명령어
  if (isAdmin) {
    lines.push("");
    lines.push("■ 관리자 명령어:");
    for (const cmd of COMMAND_HELP_LIST.filter((c) => c.adminOnly)) {
      const aliasText = cmd.alias ? ` (${cmd.alias})` : "";
      lines.push(`  ${cmd.command}${aliasText} — ${cmd.description}`);
      lines.push(`    예: ${cmd.usage}`);
    }
  }

  return lines.join("\n");
}

/** 회전 힌트 메시지 */
const ROTATING_HINTS = [
  "/닉네임 으로 귓속말을 보낼 수 있습니다.",
  "@help 명령어로 도움말을 확인하세요.",
  "화살표 ↑↓ 키로 이전 귓속말 대상을 탐색할 수 있습니다.",
  "A-/A+ 버튼으로 채팅 폰트 크기를 조절할 수 있습니다.",
  "Links 탭에서 공유된 URL만 모아볼 수 있습니다.",
];

let hintIndex = 0;

/** 다음 순환 힌트 메시지 */
export function getNextRotatingHint(): string {
  const hint = ROTATING_HINTS[hintIndex % ROTATING_HINTS.length];
  hintIndex++;
  return hint;
}

/** 환영 메시지 생성 */
export function getWelcomeMessage(nickname: string): string {
  return `${nickname}님이 입장했습니다. ${ROTATING_HINTS[0]}`;
}
