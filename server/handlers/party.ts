import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../src/features/space/socket/internal/types";
import { spacePlayersMap } from "./room";
import {
  MAX_CONTENT_LENGTH,
  DEFAULT_NICKNAME,
} from "../../src/features/space/chat/internal/chat-constants";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

function sanitizeContent(raw: string): string {
  const trimmed = raw.trim().slice(0, MAX_CONTENT_LENGTH);
  return trimmed.replace(/[<>]/g, "");
}

/** 파티 room 키 생성 */
function partyRoomKey(spaceId: string, partyId: string): string {
  return `party-${spaceId}-${partyId}`;
}

export function handleParty(io: IO, socket: TypedSocket) {
  // ── 파티존 참가 ──
  socket.on("party:join", ({ zoneId }) => {
    const spaceId = socket.data.spaceId;
    const userId = socket.data.userId;
    if (!spaceId || !userId) return;

    // 이전 파티에서 퇴장
    const prevPartyId = socket.data.partyId;
    if (prevPartyId) {
      const prevRoom = partyRoomKey(spaceId, prevPartyId);
      socket.leave(prevRoom);
    }

    // 새 파티 참가
    const roomKey = partyRoomKey(spaceId, zoneId);
    socket.join(roomKey);
    socket.data.partyId = zoneId;

    // 멤버 목록 브로드캐스트
    const members = getPartyMembers(io, spaceId, zoneId);
    io.to(roomKey).emit("party:updated", { zoneId, members });

    const spacePlayers = spacePlayersMap.get(spaceId);
    const nickname = spacePlayers?.get(userId)?.nickname ?? DEFAULT_NICKNAME;
    console.log(`[Party] ${nickname} joined party ${zoneId}`);
  });

  // ── 파티존 퇴장 ──
  socket.on("party:leave", ({ zoneId }) => {
    const spaceId = socket.data.spaceId;
    const userId = socket.data.userId;
    if (!spaceId || !userId) return;

    const roomKey = partyRoomKey(spaceId, zoneId);
    socket.leave(roomKey);
    socket.data.partyId = undefined;

    // 멤버 목록 브로드캐스트
    const members = getPartyMembers(io, spaceId, zoneId);
    io.to(roomKey).emit("party:updated", { zoneId, members });

    const spacePlayers = spacePlayersMap.get(spaceId);
    const nickname = spacePlayers?.get(userId)?.nickname ?? DEFAULT_NICKNAME;
    console.log(`[Party] ${nickname} left party ${zoneId}`);
  });

  // ── 파티 메시지 ──
  socket.on("party:message", ({ content }) => {
    const spaceId = socket.data.spaceId;
    const userId = socket.data.userId;
    const partyId = socket.data.partyId;
    if (!spaceId || !userId || !partyId) return;

    if (socket.data.restriction === "MUTED") {
      socket.emit("party:error", { code: "MUTED", message: "You are muted" });
      return;
    }

    const sanitized = sanitizeContent(content);
    if (sanitized.length === 0) return;

    const spacePlayers = spacePlayersMap.get(spaceId);
    const player = spacePlayers?.get(userId);
    const nickname = player?.nickname ?? DEFAULT_NICKNAME;
    const partyName = socket.data.partyName ?? `Party ${partyId}`;

    const roomKey = partyRoomKey(spaceId, partyId);
    io.to(roomKey).emit("party:message", {
      userId,
      nickname,
      content: sanitized,
      partyId,
      partyName,
      timestamp: new Date().toISOString(),
    });

    console.log(`[Party] ${nickname} in ${partyId}: ${sanitized.slice(0, 50)}`);
  });
}

/** 파티 멤버 userId 목록 */
function getPartyMembers(io: IO, spaceId: string, zoneId: string): string[] {
  const roomKey = partyRoomKey(spaceId, zoneId);
  const sockets = io.sockets.adapter.rooms.get(roomKey);
  if (!sockets) return [];

  const members: string[] = [];
  for (const socketId of sockets) {
    const s = io.sockets.sockets.get(socketId);
    if (s?.data.userId && s.data.spaceId === spaceId) {
      members.push(s.data.userId);
    }
  }
  return members;
}
