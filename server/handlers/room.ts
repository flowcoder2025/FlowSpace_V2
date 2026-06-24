import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PlayerData,
} from "../../src/features/space/protocol/internal/socket-events";
import { getPrisma } from "../lib/prisma";
import { recordingStates, spotlightStates, proximityStates } from "../state";
import { createKickCooldown, KICK_COOLDOWN_MS } from "../../src/lib/kick-cooldown";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// spaceId → Map<userId, PlayerData>
export const spacePlayersMap = new Map<string, Map<string, PlayerData>>();

/**
 * kick 쿨다운(WI-047). 강퇴된 (space,user)를 짧게 기록해, DB 무변경인 kick 직후
 * 클라가 소켓을 재생성/재연결해 join:space를 자동 재발송해도 즉시 복귀하지 못하게 막는다.
 * **이 게이트가 최종 강제력** — 클라 가드는 UX 보조이며 다중 탭/구버전 번들은 클라 메모리를
 * 공유하지 않으므로 서버에서 막아야 한다(codex). 단일 OCI 인스턴스·Redis 없음 → in-memory.
 * 서버 재시작 시 비워지나 kick은 임시(~30s)라 재시작=재입장 허용이 시맨틱과 무모순.
 */
const kickCooldown = createKickCooldown(KICK_COOLDOWN_MS);

function kickKey(spaceId: string, userId: string): string {
  return `${spaceId}:${userId}`;
}

/** (space,user)를 kick 쿨다운에 등록(enforce kick 적용 시). */
export function markUserKicked(spaceId: string, userId: string): void {
  kickCooldown.mark(kickKey(spaceId, userId), Date.now());
}

/** (space,user)가 kick 쿨다운 중인지(join 즉시 거부 판정). */
export function isUserKicked(spaceId: string, userId: string): boolean {
  return kickCooldown.isActive(kickKey(spaceId, userId), Date.now());
}

/**
 * archive 된 공간 deny cache(WI-036, TOCTOU 보강).
 * archive enforce 적용 시 추가되며, join:space 가 DB 조회와 별개로 즉시 입장을 거부한다.
 * archive 직전 status=ACTIVE 를 읽고 진행 중이던 in-flight join 이 archive 스냅샷 이후 room 에
 * 합류해 추방을 놓치는 좁은 창을 닫는다. **근본 방어는 join:space 의 DB status 게이트**이며
 * 이건 best-effort 보강 — 서버 재시작 시 비워지고 DB 게이트가 최종 방어다.
 * 공간은 ARCHIVED 단방향(되돌리는 API 없음)이라 항목은 제거하지 않으며, 누적 크기는
 * 서버 가동 중 archive 된 공간 수로 제한된다.
 */
const archivedSpaces = new Set<string>();

/** 공간을 archived deny cache 에 추가한다(archive enforce 적용 시). */
export function markSpaceArchived(spaceId: string): void {
  archivedSpaces.add(spaceId);
}

/** 공간이 archived deny cache 에 있는지(입장 즉시 거부 판정). */
export function isSpaceArchived(spaceId: string): boolean {
  return archivedSpaces.has(spaceId);
}

/**
 * 공간의 모든 인메모리 인덱스를 일괄 제거(WI-036 archive). spaceId 로 키된 상태는
 * presence(spacePlayersMap) + media(recording/spotlight/proximity) 가 전부다
 * (chat 의 rate-limit/reaction 맵은 userId/messageId 키라 공간 범위 아님).
 * archive 는 공간을 영구 종료시키므로 잔존 상태가 새지 않도록 직접 정리한다.
 */
export function purgeSpaceState(spaceId: string): void {
  spacePlayersMap.delete(spaceId);
  recordingStates.delete(spaceId);
  spotlightStates.delete(spaceId);
  proximityStates.delete(spaceId);
}

function getSpacePlayers(spaceId: string): Map<string, PlayerData> {
  if (!spacePlayersMap.has(spaceId)) {
    spacePlayersMap.set(spaceId, new Map());
  }
  return spacePlayersMap.get(spaceId)!;
}

/** WI-047: 강퇴 쿨다운 중 join 거부 통지(early 체크 + post-await TOCTOU 재확인 공용). */
const KICKED_JOIN_ERROR = {
  code: "KICKED",
  message: "강퇴되어 잠시 후 다시 입장할 수 있습니다.",
} as const;

export function handleRoom(io: IO, socket: TypedSocket) {
  socket.on("join:space", async ({ spaceId, nickname, avatar }) => {
    // 인증된 userId 사용 (클라이언트 값 무시)
    const userId = socket.data.userId;
    if (!userId) return;

    // WI-047: 최근 강퇴(kick) 쿨다운 중이면 즉시 거부. kick은 DB를 바꾸지 않으므로
    // 이 게이트가 없으면 클라 소켓 재생성/재연결의 자동 join 재발송으로 즉시 복귀한다.
    // 여기 early 체크는 효율(DB 조회 전 빠른 거부)용 — **권위 검증은 아래 모든 await 이후
    // socket.join 직전의 재확인**이다(그 사이 kick이 일어나는 TOCTOU를 닫는다).
    if (isUserKicked(spaceId, userId)) {
      socket.emit("space:error", KICKED_JOIN_ERROR);
      return;
    }

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

    // TOCTOU 보강(WI-036): DB status 를 읽은 뒤 archive 가 일어났을 수 있다.
    // 모든 await 이후·room 합류 직전에 deny cache 를 재확인해, in-flight join 이
    // archive 추방 스냅샷 이후 합류해 살아남는 좁은 창을 닫는다.
    if (isSpaceArchived(spaceId)) {
      socket.emit("space:error", {
        code: "SPACE_NOT_FOUND",
        message: "공간을 찾을 수 없거나 비활성 상태입니다.",
      });
      return;
    }

    // TOCTOU 보강(WI-047): DB 조회(await) 동안 이 사용자가 kick 됐을 수 있다. 그 경우
    // applyEnforcement 의 markUserKicked 는 아직 room 미합류인 이 소켓을 socketsForUser 로
    // 잡지 못하므로, archive 와 동일하게 socket.join 직전 쿨다운을 재확인해 강퇴 직후
    // in-flight join 이 살아남는 창을 닫는다(서버 게이트=최종 강제력).
    if (isUserKicked(spaceId, userId)) {
      socket.emit("space:error", KICKED_JOIN_ERROR);
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
