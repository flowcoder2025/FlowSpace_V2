import type { ChatMessage, ChatTab } from "./chat-types";

/** URL 정규식 */
const URL_REGEX = /https?:\/\/[^\s<]+/g;

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
      return messages.filter((m) => hasUrl(m));
    default:
      return messages;
  }
}

/** 탭별 안읽은 메시지 수 계산 */
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

  for (const tab of tabs) {
    const lastRead = lastReadTimestamps[tab] || "1970-01-01T00:00:00.000Z";
    const filtered = filterMessagesByTab(messages, tab, userId);
    counts[tab] = filtered.filter(
      (m) => m.timestamp > lastRead && m.userId !== userId
    ).length;
  }

  return counts;
}

/** URL 포함 여부 */
export function hasUrl(message: ChatMessage): boolean {
  return URL_REGEX.test(message.content);
}

/** URL 추출 */
export function extractUrls(content: string): string[] {
  const matches = content.match(URL_REGEX);
  return matches ?? [];
}

/** 콘텐츠 파싱 (텍스트 + URL 분리) */
export interface ContentPart {
  type: "text" | "url";
  value: string;
  href?: string;
}

export function parseContentWithUrls(content: string): ContentPart[] {
  const parts: ContentPart[] = [];
  let lastIndex = 0;

  const regex = new RegExp(URL_REGEX.source, "g");
  let match;

  while ((match = regex.exec(content)) !== null) {
    // 이전 텍스트
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    // URL
    parts.push({ type: "url", value: match[0], href: match[0] });
    lastIndex = match.index + match[0].length;
  }

  // 나머지 텍스트
  if (lastIndex < content.length) {
    parts.push({ type: "text", value: content.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: "text", value: content }];
}
