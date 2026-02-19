import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../src/features/space/socket/internal/types";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/** OWNER/STAFF 권한 체크 */
function canEdit(socket: TypedSocket): boolean {
  return socket.data.role === "OWNER" || socket.data.role === "STAFF";
}

export function handleEditor(io: IO, socket: TypedSocket) {
  // 타일 업데이트
  socket.on("editor:tile-update", (data) => {
    if (!canEdit(socket) || !socket.data.spaceId) return;

    socket.to(socket.data.spaceId).emit("editor:tile-updated", {
      userId: socket.data.userId,
      ...data,
    });
  });

  // 오브젝트 배치
  socket.on("editor:object-place", (data) => {
    if (!canEdit(socket) || !socket.data.spaceId) return;

    socket.to(socket.data.spaceId).emit("editor:object-placed", {
      userId: socket.data.userId,
      ...data,
    });
  });

  // 오브젝트 이동
  socket.on("editor:object-move", (data) => {
    if (!canEdit(socket) || !socket.data.spaceId) return;

    socket.to(socket.data.spaceId).emit("editor:object-moved", {
      userId: socket.data.userId,
      ...data,
    });
  });

  // 오브젝트 삭제
  socket.on("editor:object-delete", (data) => {
    if (!canEdit(socket) || !socket.data.spaceId) return;

    socket.to(socket.data.spaceId).emit("editor:object-deleted", {
      userId: socket.data.userId,
      ...data,
    });
  });
}
