import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../src/features/space/socket/internal/types";
import { spacePlayersMap } from "./room";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const MAX_CONTENT_LENGTH = 500;

function sanitizeContent(raw: string): string {
  // 앞뒤 공백 제거 후 길이 제한
  const trimmed = raw.trim().slice(0, MAX_CONTENT_LENGTH);
  // 기본 HTML 태그 제거 (XSS 방지)
  return trimmed.replace(/[<>]/g, "");
}

export function handleChat(io: IO, socket: TypedSocket) {
  socket.on("chat:send", ({ content, type, targetId }) => {
    const spaceId = socket.data.spaceId;
    const userId = socket.data.userId;

    if (!spaceId || !userId) return;

    const sanitized = sanitizeContent(content);
    if (sanitized.length === 0) return;

    // spacePlayersMap에서 닉네임 조회
    const spacePlayers = spacePlayersMap.get(spaceId);
    const player = spacePlayers?.get(userId);
    const nickname = player?.nickname ?? "Unknown";

    const message = {
      userId,
      nickname,
      content: sanitized,
      type,
      timestamp: new Date().toISOString(),
    };

    switch (type) {
      case "whisper": {
        if (!targetId) return;
        // targetId는 userId → 해당 유저의 소켓을 찾아 전송
        const targetPlayer = spacePlayers?.get(targetId);
        if (!targetPlayer) return;
        // 같은 space의 소켓 중 targetId를 가진 소켓에 전송
        const sockets = io.sockets.adapter.rooms.get(spaceId);
        if (sockets) {
          for (const socketId of sockets) {
            const s = io.sockets.sockets.get(socketId);
            if (s?.data.userId === targetId) {
              s.emit("chat:message", message);
            }
          }
        }
        // 보낸 사람에게도 표시
        socket.emit("chat:message", message);
        break;
      }
      case "group":
      case "party":
      default:
        // 같은 space 전체에 브로드캐스트
        io.to(spaceId).emit("chat:message", message);
        break;
    }

    console.log(`[Chat] ${nickname} (${type}): ${sanitized.slice(0, 50)}`);
  });
}
