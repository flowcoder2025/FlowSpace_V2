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

/** 관리 명령어 타입 (확장) */
export type AdminCommandType =
  | "mute"
  | "unmute"
  | "kick"
  | "announce"
  | "ban"
  | "help"
  | "proximity";

/** 스페이스 역할 */
export type SpaceRole = "OWNER" | "STAFF" | "PARTICIPANT";

/** 채팅 제한 */
export type ChatRestriction = "NONE" | "MUTED" | "BANNED";

/** 파싱된 입력 결과 */
export interface ParsedInput {
  type: "message" | "whisper" | "admin" | "editor_command";
  content: string;
  targetNickname?: string;
  adminCommand?: AdminCommandType;
  /** 에디터 명령어 파라미터 */
  editorParams?: Record<string, string>;
}

/** 에디터 명령어 파싱 결과 */
export interface ParsedEditorCommand {
  command: string;
  params: Record<string, string>;
}

/** 멤버 뮤트 데이터 */
export interface MemberMutedData {
  memberId: string;
  nickname: string;
  mutedBy: string;
  duration?: number;
}

/** 멤버 언뮤트 데이터 */
export interface MemberUnmutedData {
  memberId: string;
  nickname: string;
  unmutedBy: string;
}

/** 멤버 추방 데이터 */
export interface MemberKickedData {
  memberId: string;
  nickname: string;
  kickedBy: string;
}

/** 역할 변경 데이터 */
export interface RoleChangedData {
  memberId: string;
  nickname: string;
  newRole: SpaceRole;
  changedBy: string;
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

/** 소켓 에러 데이터 */
export interface SocketError {
  code: string;
  message: string;
  timestamp: string;
}

/** 파티존 정보 */
export interface PartyZoneInfo {
  zoneId: string;
  name: string;
  members: string[];
}

/** 귓속말 방향 */
export type WhisperDirection = "sent" | "received";

/** 하위 호환 별칭 */
export type ChatType = MessageType;
