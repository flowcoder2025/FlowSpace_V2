/** 채팅 메시지 타입 */
export type ChatType = "group" | "whisper" | "party" | "system";

/** 채팅 메시지 인터페이스 */
export interface ChatMessage {
  id: string;
  userId: string;
  nickname: string;
  content: string;
  type: ChatType;
  timestamp: string;
}
