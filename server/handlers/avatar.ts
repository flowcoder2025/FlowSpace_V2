import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../src/features/space/socket/internal/types";
import { spacePlayersMap } from "./room";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function handleAvatar(_io: IO, socket: TypedSocket) {
  socket.on("avatar:update", ({ avatar }) => {
    const spaceId = socket.data.spaceId;
    const userId = socket.data.userId;
    if (!spaceId || !userId) return;

    // 메모리 내 플레이어 데이터 업데이트
    const players = spacePlayersMap.get(spaceId);
    const player = players?.get(userId);
    if (player) {
      player.avatar = avatar;
    }

    // 같은 스페이스 내 다른 유저에게 브로드캐스트
    socket.to(spaceId).emit("player:avatar-updated", { userId, avatar });
  });
}
