import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PlayerData,
} from "../../src/features/space/socket/internal/types";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// 서버측 위치 추적 (spaceId → Map<userId, PlayerData>)
// room.ts의 spacePlayersMap과 공유 필요 → 추후 리팩토링
// 현재는 간단히 브로드캐스트만 수행

export function handleMovement(_io: IO, socket: TypedSocket) {
  socket.on("move", ({ x, y, direction }) => {
    const spaceId = socket.data.spaceId;
    const userId = socket.data.userId;

    if (!spaceId || !userId) return;

    // 같은 공간의 다른 플레이어에게 브로드캐스트
    socket.to(spaceId).emit("player:moved", {
      userId,
      x,
      y,
      direction,
    });
  });
}
