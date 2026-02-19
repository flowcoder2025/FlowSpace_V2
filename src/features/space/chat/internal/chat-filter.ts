import type { ChatMessage, ChatTab } from "./chat-types";
import type { WhisperDirection } from "./chat-types";

/** URL 정규식 — http(s), www., 도메인 전용 */
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<]+/gi;

/** 프로토콜 보장 */
export function ensureProtocol(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

/** 탭별 메시지 필터링 */
export function filterMessagesByTab(
  messages: ChatMessage[],
  tab: ChatTab,
  currentUserId: string
): ChatMessage[] {
  switch (tab) {
    case "all":
      return messages;
    case "party":
      return messages.filter((m) => m.type === "party");
    case "whisper":
      return messages.filter(
        (m) =>
          m.type === "whisper" &&
          (m.userId === currentUserId || m.targetNickname !== undefined)
      );
    case "system":
      return messages.filter((m) => m.type === "system" || m.type === "announcement");
    case "links":
      return messages.filter((m) => isLinkMessage(m));
    default:
      return messages;
  }
}

/** 탭별 안읽은 메시지 수 계산 (크로스탭 인식) */
export function calculateUnreadCounts(
  messages: ChatMessage[],
  lastReadTimestamps: Record<ChatTab, string>,
  userId: string
): Record<ChatTab, number> {
  const counts: Record<ChatTab, number> = {
    all: 0,
    party: 0,
    whisper: 0,
    system: 0,
    links: 0,
  };

  const tabs: ChatTab[] = ["all", "party", "whisper", "system", "links"];

  // 귓속말 탭의 lastRead를 "all" 탭에도 적용 (크로스탭 읽음 처리)
  const whisperLastRead = lastReadTimestamps["whisper"] || "1970-01-01T00:00:00.000Z";

  for (const tab of tabs) {
    const lastRead = lastReadTimestamps[tab] || "1970-01-01T00:00:00.000Z";
    const filtered = filterMessagesByTab(messages, tab, userId);
    counts[tab] = filtered.filter((m) => {
      if (m.userId === userId) return false;
      if (m.timestamp <= lastRead) return false;

      // 크로스탭: 귓속말 탭에서 읽은 메시지는 all 탭에서도 읽음 처리
      if (tab === "all" && m.type === "whisper" && m.timestamp <= whisperLastRead) {
        return false;
      }

      return true;
    }).length;
  }

  return counts;
}

/** URL 포함 메시지 (시스템/공지 제외) */
export function isLinkMessage(message: ChatMessage): boolean {
  if (message.type === "system" || message.type === "announcement") return false;
  return hasUrl(message.content);
}

/** URL 포함 여부 */
export function hasUrl(content: string): boolean {
  // 정규식 lastIndex 리셋
  URL_REGEX.lastIndex = 0;
  return URL_REGEX.test(content);
}

/** URL 추출 (중복 제거) */
export function extractUrls(content: string): string[] {
  URL_REGEX.lastIndex = 0;
  const matches = content.match(URL_REGEX);
  if (!matches) return [];
  // 중복 제거
  return [...new Set(matches)];
}

/** 콘텐츠 파싱 (텍스트 + URL 분리) */
export interface ContentPart {
  type: "text" | "url";
  value: string;
  href?: string;
}

/** URL 표시 문자열 (50자 초과 시 말줄임) */
function truncateUrl(url: string, maxLen = 50): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 3) + "...";
}

export function parseContentWithUrls(content: string): ContentPart[] {
  const parts: ContentPart[] = [];
  let lastIndex = 0;

  const regex = new RegExp(URL_REGEX.source, "gi");
  let match;

  while ((match = regex.exec(content)) !== null) {
    // 이전 텍스트
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    // URL (프로토콜 보장 + 말줄임)
    const href = ensureProtocol(match[0]);
    const displayText = truncateUrl(match[0]);
    parts.push({ type: "url", value: displayText, href });
    lastIndex = match.index + match[0].length;
  }

  // 나머지 텍스트
  if (lastIndex < content.length) {
    parts.push({ type: "text", value: content.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: "text", value: content }];
}

/** 귓속말 방향 판별 */
export function getWhisperDirection(
  message: ChatMessage,
  currentUserId: string
): WhisperDirection {
  return message.userId === currentUserId ? "sent" : "received";
}
