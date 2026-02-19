/** 메시지 타입 */
export type MessageType = "message" | "party" | "whisper" | "system" | "announcement";

/** 채팅 탭 */
export type ChatTab = "all" | "party" | "whisper" | "system" | "links";

/** 리액션 타입 */
export type ReactionType = "thumbsup" | "heart" | "check";

/** 메시지 리액션 */
export interface MessageReaction {
  type: ReactionType;
  userId: string;
  userNickname: string;
}

/** 답장 참조 */
export interface ReplyTo {
  id: string;
  senderNickname: string;
  content: string;
}

/** 채팅 메시지 인터페이스 */
export interface ChatMessage {
  id: string;
  tempId?: string;
  userId: string;
  nickname: string;
  content: string;
  type: MessageType;
  timestamp: string;
  reactions?: MessageReaction[];
  targetNickname?: string;
  partyId?: string;
  partyName?: string;
  replyTo?: ReplyTo;
  isDeleted?: boolean;
  failed?: boolean;
}

/** 관리 명령어 타입 */
export type AdminCommandType = "mute" | "unmute" | "kick" | "announce";

/** 파싱된 입력 결과 */
export interface ParsedInput {
  type: "message" | "whisper" | "admin";
  content: string;
  targetNickname?: string;
  adminCommand?: AdminCommandType;
}

/** 멤버 뮤트 데이터 */
export interface MemberMutedData {
  memberId: string;
  nickname: string;
  mutedBy: string;
  duration?: number;
}

/** 메시지 삭제 데이터 */
export interface MessageDeletedData {
  messageId: string;
  deletedBy: string;
}

/** 공지 데이터 */
export interface AnnouncementData {
  content: string;
  announcer: string;
}

/** 하위 호환 별칭 */
export type ChatType = MessageType;
