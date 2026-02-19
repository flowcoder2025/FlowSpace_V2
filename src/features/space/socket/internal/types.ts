// Socket.io 이벤트 타입 (event-protocol.md 준수)

/** 플레이어 정보 */
export interface PlayerData {
  userId: string;
  nickname: string;
  avatar: string;
  position: { x: number; y: number };
}

/** 위치 업데이트 (경량 payload) */
export interface MovementData {
  x: number;
  y: number;
  direction: string;
}

/** 소켓 부가 데이터 */
export interface SocketData {
  userId: string;
  name: string;
  spaceId: string;
  partyId?: string;
  partyName?: string;
  role?: "OWNER" | "STAFF" | "PARTICIPANT";
  restriction?: "NONE" | "MUTED" | "BANNED";
  memberId?: string;
}

/** Client → Server 이벤트 */
export interface ClientToServerEvents {
  "join:space": (data: {
    spaceId: string;
    userId: string;
    nickname: string;
    avatar: string;
  }) => void;
  "leave:space": (data: { spaceId: string }) => void;
  move: (data: MovementData) => void;

  // Chat
  "chat:send": (data: {
    content: string;
    type: "group" | "whisper" | "party";
    targetId?: string;
    replyTo?: { id: string; senderNickname: string; content: string };
  }) => void;

  // Whisper
  "whisper:send": (data: {
    targetNickname: string;
    content: string;
  }) => void;

  // Party
  "party:join": (data: { zoneId: string }) => void;
  "party:leave": (data: { zoneId: string }) => void;
  "party:message": (data: { content: string }) => void;

  // Reaction
  "reaction:toggle": (data: {
    messageId: string;
    reactionType: "thumbsup" | "heart" | "check";
  }) => void;

  // Admin
  "chat:delete": (data: { messageId: string }) => void;
  "admin:mute": (data: { targetNickname: string; duration?: number }) => void;
  "admin:unmute": (data: { targetNickname: string }) => void;
  "admin:kick": (data: { targetNickname: string }) => void;
  "admin:announce": (data: { content: string }) => void;

  // Editor
  "editor:tile-update": (data: {
    layer: string;
    col: number;
    row: number;
    tileIndex: number;
  }) => void;
  "editor:object-place": (data: {
    id: string;
    objectType: string;
    positionX: number;
    positionY: number;
    label?: string;
  }) => void;
  "editor:object-move": (data: {
    id: string;
    positionX: number;
    positionY: number;
  }) => void;
  "editor:object-delete": (data: { id: string }) => void;
}

/** Server → Client 이벤트 */
export interface ServerToClientEvents {
  "player:joined": (data: PlayerData) => void;
  "player:left": (data: { userId: string }) => void;
  "player:moved": (data: { userId: string } & MovementData) => void;
  "players:list": (data: { players: PlayerData[] }) => void;

  // Chat
  "chat:message": (data: {
    id?: string;
    tempId?: string;
    userId: string;
    nickname: string;
    content: string;
    type: string;
    timestamp: string;
    replyTo?: { id: string; senderNickname: string; content: string };
    partyId?: string;
    partyName?: string;
  }) => void;
  "chat:messageIdUpdate": (data: { tempId: string; realId: string }) => void;
  "chat:messageFailed": (data: { tempId: string; error: string }) => void;
  "chat:messageDeleted": (data: { messageId: string; deletedBy: string }) => void;

  // Whisper
  "whisper:receive": (data: {
    id?: string;
    senderId: string;
    senderNickname: string;
    content: string;
    timestamp: string;
  }) => void;
  "whisper:sent": (data: {
    id?: string;
    targetNickname: string;
    content: string;
    timestamp: string;
  }) => void;

  // Party
  "party:message": (data: {
    userId: string;
    nickname: string;
    content: string;
    partyId: string;
    partyName: string;
    timestamp: string;
  }) => void;
  "party:updated": (data: { zoneId: string; members: string[] }) => void;

  // Reaction
  "reaction:updated": (data: {
    messageId: string;
    reactions: Array<{
      type: "thumbsup" | "heart" | "check";
      userId: string;
      userNickname: string;
    }>;
  }) => void;

  // Admin
  "member:muted": (data: {
    memberId: string;
    nickname: string;
    mutedBy: string;
    duration?: number;
  }) => void;
  "member:unmuted": (data: {
    memberId: string;
    nickname: string;
    unmutedBy: string;
  }) => void;
  "member:kicked": (data: {
    memberId: string;
    nickname: string;
    kickedBy: string;
  }) => void;
  "space:announcement": (data: {
    content: string;
    announcer: string;
    timestamp: string;
  }) => void;

  // Editor
  "editor:tile-updated": (data: {
    userId: string;
    layer: string;
    col: number;
    row: number;
    tileIndex: number;
  }) => void;
  "editor:object-placed": (data: {
    userId: string;
    id: string;
    objectType: string;
    positionX: number;
    positionY: number;
    label?: string;
  }) => void;
  "editor:object-moved": (data: {
    userId: string;
    id: string;
    positionX: number;
    positionY: number;
  }) => void;
  "editor:object-deleted": (data: {
    userId: string;
    id: string;
  }) => void;

  // Error events (세분화)
  "chat:error": (data: { code: string; message: string }) => void;
  "whisper:error": (data: { code: string; message: string }) => void;
  "party:error": (data: { code: string; message: string }) => void;
  "admin:error": (data: { code: string; message: string }) => void;

  // Whisper optimistic update support
  "whisper:messageIdUpdate": (data: { tempId: string; realId: string }) => void;
  "whisper:messageFailed": (data: { tempId: string; error: string }) => void;

  error: (data: { message: string }) => void;
}
