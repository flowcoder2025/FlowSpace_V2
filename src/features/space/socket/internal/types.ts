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
  "chat:send": (data: {
    content: string;
    type: "group" | "whisper" | "party";
    targetId?: string;
  }) => void;
  "party:join": (data: { zoneId: string }) => void;
  "party:leave": (data: { zoneId: string }) => void;
}

/** Server → Client 이벤트 */
export interface ServerToClientEvents {
  "player:joined": (data: PlayerData) => void;
  "player:left": (data: { userId: string }) => void;
  "player:moved": (data: { userId: string } & MovementData) => void;
  "players:list": (data: { players: PlayerData[] }) => void;
  "chat:message": (data: {
    userId: string;
    nickname: string;
    content: string;
    type: string;
    timestamp: string;
  }) => void;
  "party:updated": (data: { zoneId: string; members: string[] }) => void;
  error: (data: { message: string }) => void;
}
