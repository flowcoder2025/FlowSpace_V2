/**
 * 채팅 시스템 공유 상수
 * 서버/클라이언트 공통 (React 의존성 없음)
 */

// ── 메시지 제한 ──
export const MAX_MESSAGES = 200;
export const MAX_CONTENT_LENGTH = 500;
export const RATE_LIMIT_MS = 500;

// ── 캐싱 ──
export const DEBOUNCE_MS = 500;
export const CACHE_EXPIRY_DAYS = 7;
export const STORAGE_PREFIX = "flowspace-chat-";

// ── 닉네임 ──
export const DEFAULT_NICKNAME = "Unknown";

// ── 소켓 재연결 ──
export const RECONNECTION_ATTEMPTS = 30;
export const RECONNECTION_DELAY = 500;
export const RECONNECTION_DELAY_MAX = 5000;
export const RECONNECTION_TIMEOUT = 20000;

// ── 이동 쓰로틀 ──
export const MOVE_THROTTLE_MS = 100;

// ── 폰트 크기 ──
export type ChatFontSize = "small" | "medium" | "large";

export const FONT_SIZE_PX: Record<ChatFontSize, number> = {
  small: 12,
  medium: 14,
  large: 16,
};

export const CHAT_FONT_SIZE_ORDER: ChatFontSize[] = ["small", "medium", "large"];

export const FONT_SIZE_STORAGE_KEY = "flowspace-chat-fontSize";

// ── 관리자 명령어 별칭 (한/영) ──
export const ADMIN_COMMAND_ALIASES: Record<string, string> = {
  mute: "mute",
  음소거: "mute",
  unmute: "unmute",
  음소거해제: "unmute",
  kick: "kick",
  강퇴: "kick",
  ban: "ban",
  차단: "ban",
  announce: "announce",
  공지: "announce",
  help: "help",
  도움말: "help",
  proximity: "proximity",
  근접: "proximity",
};
