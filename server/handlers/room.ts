import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PlayerData,
} from "../../src/features/space/socket/internal/types";
import { getPrisma } from "../lib/prisma";

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
  socket.on("join:space", async ({ spaceId, nickname, avatar }) => {
    // 인증된 userId 사용 (클라이언트 값 무시)
    const userId = socket.data.userId;
    if (!userId) return;

    // join 전 동기 인가 검증: 공간 존재/활성 + 멤버십 + BANNED 차단.
    // 통과하기 전에는 socket.join / role / presence 등록을 하지 않는다.
    let role: "OWNER" | "STAFF" | "PARTICIPANT";
    let restriction: "NONE" | "MUTED" | "BANNED";
    let memberId: string;
    try {
      const prisma = await getPrisma();

      const space = await prisma.space.findUnique({
        where: { id: spaceId },
        select: { id: true, status: true },
      });
      if (!space || space.status !== "ACTIVE") {
        socket.emit("space:error", {
          code: "SPACE_NOT_FOUND",
          message: "공간을 찾을 수 없거나 비활성 상태입니다.",
        });
        return;
      }

      const member = await prisma.spaceMember.findUnique({
        where: { spaceId_userId: { spaceId, userId } },
        select: { id: true, role: true, restriction: true },
      });
      if (!member) {
        socket.emit("space:error", {
          code: "NOT_A_MEMBER",
          message: "이 공간의 멤버가 아닙니다.",
        });
        return;
      }
      if (member.restriction === "BANNED") {
        socket.emit("space:error", {
          code: "BANNED",
          message: "이 공간에서 차단되었습니다.",
        });
        return;
      }

      memberId = member.id;
      role = member.role as "OWNER" | "STAFF" | "PARTICIPANT";
      restriction = member.restriction as "NONE" | "MUTED" | "BANNED";
    } catch (err) {
      console.error("[Room] join authorization failed:", err);
      socket.emit("space:error", {
        code: "JOIN_FAILED",
        message: "입장 처리 중 오류가 발생했습니다.",
      });
      return;
    }

    // 인가 통과 후에만 room 참가 + 검증된 권한 정보 설정
    socket.join(spaceId);
    socket.data.spaceId = spaceId;
    socket.data.memberId = memberId;
    socket.data.role = role;
    socket.data.restriction = restriction;

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

  socket.on("leave:space", () => {
    // 클라이언트가 보낸 spaceId 는 신뢰하지 않는다(communication invariant #3) —
    // 서버가 인가한 socket.data.spaceId 만 사용.
    const spaceId = socket.data.spaceId;
    if (spaceId) leaveSpace(io, socket, spaceId);
  });

  // 연결 해제 시 자동 퇴장
  socket.on("disconnect", () => {
    const spaceId = socket.data.spaceId;
    if (spaceId) {
      leaveSpace(io, socket, spaceId);
    }
  });
}

/**
 * 소켓을 공간에서 물리적으로 분리: 자기 id 를 제외한 모든 room(공간 + 파티) 이탈 +
 * 공간 범위 socket.data 무효화. 이후 모든 이벤트 핸들러가 socket.data.spaceId 가드로
 * early-return 하므로 stale 인가(퇴장/추방 후 잔존 chat/admin/editor/media)가 차단된다.
 * presence/broadcast 는 호출측 책임(단일 소켓 분리라 사용자 단위 알림과 분리).
 */
export function detachSocketFromSpace(socket: TypedSocket): void {
  for (const room of [...socket.rooms]) {
    if (room !== socket.id) socket.leave(room);
  }
  socket.data.spaceId = undefined;
  socket.data.partyId = undefined;
  socket.data.partyName = undefined;
  socket.data.role = undefined;
  socket.data.restriction = undefined;
  socket.data.memberId = undefined;
}

/** presence 에서 사용자 제거 + 주변에 player:left 1회(사용자 단위, 다중 탭 중복 방지). */
export function removeUserPresence(io: IO, spaceId: string, userId: string): void {
  const players = spacePlayersMap.get(spaceId);
  if (players) {
    players.delete(userId);
    if (players.size === 0) spacePlayersMap.delete(spaceId);
  }
  io.to(spaceId).emit("player:left", { userId });
}

/** 단일 소켓 퇴장(leave:space/disconnect): presence 정리 1회 + 자기 소켓 분리. */
export function leaveSpace(io: IO, socket: TypedSocket, spaceId: string) {
  const userId = socket.data.userId;
  removeUserPresence(io, spaceId, userId);
  detachSocketFromSpace(socket);
  console.log(`[Room] ${userId} left ${spaceId}`);
}
