import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PlayerData,
} from "../../src/features/space/socket/internal/types";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// spaceId → Map<userId, PlayerData>
export const spacePlayersMap = new Map<string, Map<string, PlayerData>>();

function getSpacePlayers(spaceId: string): Map<string, PlayerData> {
  if (!spacePlayersMap.has(spaceId)) {
    spacePlayersMap.set(spaceId, new Map());
  }
  return spacePlayersMap.get(spaceId)!;
}

export function handleRoom(io: IO, socket: TypedSocket) {
  socket.on("join:space", ({ spaceId, nickname, avatar }) => {
    // 인증된 userId 사용 (클라이언트 값 무시)
    const userId = socket.data.userId;
    if (!userId) return;

    // Socket.io room 참가
    socket.join(spaceId);
    socket.data.spaceId = spaceId;

    // 기본 role/restriction 설정 (DB 조회 전 기본값)
    socket.data.role = socket.data.role ?? "PARTICIPANT";
    socket.data.restriction = socket.data.restriction ?? "NONE";

    // DB에서 멤버 정보 비동기 로드
    loadMemberInfo(spaceId, userId, socket).catch((err) =>
      console.error("[Room] Failed to load member info:", err)
    );

    const player: PlayerData = {
      userId,
      nickname,
      avatar,
      position: { x: 400, y: 300 }, // 기본 스폰 위치
    };

    const players = getSpacePlayers(spaceId);
    players.set(userId, player);

    // 기존 플레이어 목록 전송
    socket.emit("players:list", {
      players: Array.from(players.values()),
    });

    // 다른 플레이어에게 입장 알림
    socket.to(spaceId).emit("player:joined", player);

    console.log(
      `[Room] ${nickname} joined ${spaceId} (${players.size} players)`
    );
  });

  socket.on("leave:space", ({ spaceId }) => {
    leaveSpace(io, socket, spaceId);
  });

  // 연결 해제 시 자동 퇴장
  socket.on("disconnect", () => {
    const spaceId = socket.data.spaceId;
    if (spaceId) {
      leaveSpace(io, socket, spaceId);
    }
  });
}

function leaveSpace(io: IO, socket: TypedSocket, spaceId: string) {
  const userId = socket.data.userId;
  const players = getSpacePlayers(spaceId);

  players.delete(userId);
  socket.leave(spaceId);

  // 다른 플레이어에게 퇴장 알림
  io.to(spaceId).emit("player:left", { userId });

  // 빈 공간 정리
  if (players.size === 0) {
    spacePlayersMap.delete(spaceId);
  }

  console.log(`[Room] ${userId} left ${spaceId} (${players.size} players)`);
}

/** DB에서 SpaceMember 정보 로드하여 socket.data에 할당 */
async function loadMemberInfo(spaceId: string, userId: string, socket: TypedSocket): Promise<void> {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const member = await prisma.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId, userId } },
      select: { id: true, role: true, restriction: true },
    });

    if (member) {
      socket.data.memberId = member.id;
      socket.data.role = member.role as "OWNER" | "STAFF" | "PARTICIPANT";
      socket.data.restriction = member.restriction as "NONE" | "MUTED" | "BANNED";
    }

    await prisma.$disconnect();
  } catch (err) {
    console.error("[Room] Prisma member load error:", err);
  }
}
