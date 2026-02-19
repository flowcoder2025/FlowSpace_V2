import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../src/features/space/socket/internal/types";
import { spacePlayersMap } from "./room";
import {
  MAX_CONTENT_LENGTH,
  RATE_LIMIT_MS,
  DEFAULT_NICKNAME,
} from "../../src/features/space/chat/internal/chat-constants";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// Rate limiting: userId → last message timestamp
const rateLimitMap = new Map<string, number>();

// In-memory reaction store: messageId → reactions[]
const messageReactionsMap = new Map<
  string,
  Array<{ type: "thumbsup" | "heart" | "check"; userId: string; userNickname: string }>
>();

let tempIdCounter = 0;

function sanitizeContent(raw: string): string {
  const trimmed = raw.trim().slice(0, MAX_CONTENT_LENGTH);
  return trimmed.replace(/[<>]/g, "");
}

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const last = rateLimitMap.get(userId) || 0;
  if (now - last < RATE_LIMIT_MS) return false;
  rateLimitMap.set(userId, now);
  return true;
}

function isMuted(socket: TypedSocket): boolean {
  return socket.data.restriction === "MUTED";
}

function isAdmin(socket: TypedSocket): boolean {
  return socket.data.role === "OWNER" || socket.data.role === "STAFF";
}

/** 닉네임으로 타겟 소켓 찾기 */
function findSocketsByNickname(io: IO, spaceId: string, nickname: string): TypedSocket[] {
  const sockets = io.sockets.adapter.rooms.get(spaceId);
  if (!sockets) return [];

  const result: TypedSocket[] = [];
  const spacePlayers = spacePlayersMap.get(spaceId);

  for (const socketId of sockets) {
    const s = io.sockets.sockets.get(socketId) as TypedSocket | undefined;
    if (!s) continue;
    const player = spacePlayers?.get(s.data.userId);
    if (player?.nickname === nickname) {
      result.push(s);
    }
  }
  return result;
}

export function handleChat(io: IO, socket: TypedSocket) {
  // ── 일반/그룹 메시지 ──
  socket.on("chat:send", ({ content, type, replyTo }) => {
    const spaceId = socket.data.spaceId;
    const userId = socket.data.userId;
    if (!spaceId || !userId) return;
    if (isMuted(socket)) {
      socket.emit("chat:error", { code: "MUTED", message: "You are muted" });
      return;
    }
    if (!checkRateLimit(userId)) return;

    const sanitized = sanitizeContent(content);
    if (sanitized.length === 0) return;

    const spacePlayers = spacePlayersMap.get(spaceId);
    const player = spacePlayers?.get(userId);
    const nickname = player?.nickname ?? DEFAULT_NICKNAME;

    const tempId = `srv-${Date.now()}-${++tempIdCounter}`;
    const timestamp = new Date().toISOString();

    // party 타입은 chat:send가 아닌 party:message 전용 핸들러 사용
    if (type === "party") {
      socket.emit("chat:error", { code: "INVALID_TYPE", message: "Use party:message for party chat" });
      return;
    }

    const message = {
      tempId,
      userId,
      nickname,
      content: sanitized,
      type: type === "whisper" ? "whisper" : "message",
      timestamp,
      replyTo,
    };

    // Optimistic broadcast
    io.to(spaceId).emit("chat:message", message);

    // DB 비동기 저장 (fire-and-forget, import 없이 로그만)
    saveChatMessageAsync(spaceId, userId, nickname, sanitized, message.type, tempId, replyTo).catch(
      (err) => {
        console.error("[Chat] DB save failed:", err);
        socket.emit("chat:messageFailed", { tempId, error: "Failed to save message" });
      }
    );

    console.log(`[Chat] ${nickname} (${type}): ${sanitized.slice(0, 50)}`);
  });

  // ── 귓속말 ──
  socket.on("whisper:send", ({ targetNickname, content }) => {
    const spaceId = socket.data.spaceId;
    const userId = socket.data.userId;
    if (!spaceId || !userId) return;
    if (isMuted(socket)) {
      socket.emit("whisper:error", { code: "MUTED", message: "You are muted" });
      return;
    }
    if (!checkRateLimit(userId)) return;

    const sanitized = sanitizeContent(content);
    if (sanitized.length === 0) return;

    const spacePlayers = spacePlayersMap.get(spaceId);
    const player = spacePlayers?.get(userId);
    const senderNickname = player?.nickname ?? DEFAULT_NICKNAME;

    const timestamp = new Date().toISOString();

    // 타겟 소켓 찾기
    const targetSockets = findSocketsByNickname(io, spaceId, targetNickname);
    if (targetSockets.length === 0) {
      socket.emit("whisper:error", { code: "TARGET_NOT_FOUND", message: `User "${targetNickname}" not found` });
      return;
    }

    // 수신자에게 전송
    for (const ts of targetSockets) {
      ts.emit("whisper:receive", {
        senderId: userId,
        senderNickname,
        content: sanitized,
        timestamp,
      });
    }

    // 발신자에게 확인
    socket.emit("whisper:sent", {
      targetNickname,
      content: sanitized,
      timestamp,
    });

    console.log(`[Chat] Whisper: ${senderNickname} → ${targetNickname}`);
  });

  // ── 리액션 토글 ──
  socket.on("reaction:toggle", ({ messageId, reactionType }) => {
    const spaceId = socket.data.spaceId;
    const userId = socket.data.userId;
    if (!spaceId || !userId) return;

    const spacePlayers = spacePlayersMap.get(spaceId);
    const player = spacePlayers?.get(userId);
    const userNickname = player?.nickname ?? DEFAULT_NICKNAME;

    let reactions = messageReactionsMap.get(messageId) || [];
    const existing = reactions.findIndex((r) => r.userId === userId && r.type === reactionType);

    if (existing >= 0) {
      reactions.splice(existing, 1);
    } else {
      reactions.push({ type: reactionType, userId, userNickname });
    }

    messageReactionsMap.set(messageId, reactions);

    io.to(spaceId).emit("reaction:updated", {
      messageId,
      reactions: [...reactions],
    });
  });

  // ── 메시지 삭제 ──
  socket.on("chat:delete", ({ messageId }) => {
    const spaceId = socket.data.spaceId;
    const userId = socket.data.userId;
    if (!spaceId || !userId) return;
    if (!isAdmin(socket)) {
      socket.emit("admin:error", { code: "FORBIDDEN", message: "Insufficient permissions" });
      return;
    }

    const spacePlayers = spacePlayersMap.get(spaceId);
    const player = spacePlayers?.get(userId);
    const deletedBy = player?.nickname ?? "Admin";

    io.to(spaceId).emit("chat:messageDeleted", { messageId, deletedBy });

    // DB soft delete (비동기)
    softDeleteMessageAsync(messageId, userId).catch((err) =>
      console.error("[Chat] DB soft delete failed:", err)
    );

    console.log(`[Chat] Message ${messageId} deleted by ${deletedBy}`);
  });

  // ── 관리 명령: mute ──
  socket.on("admin:mute", ({ targetNickname, duration }) => {
    const spaceId = socket.data.spaceId;
    if (!spaceId || !isAdmin(socket)) {
      socket.emit("admin:error", { code: "FORBIDDEN", message: "Insufficient permissions" });
      return;
    }

    const targetSockets = findSocketsByNickname(io, spaceId, targetNickname);
    for (const ts of targetSockets) {
      ts.data.restriction = "MUTED";
    }

    const spacePlayers = spacePlayersMap.get(spaceId);
    const mutedBy = spacePlayers?.get(socket.data.userId)?.nickname ?? "Admin";

    io.to(spaceId).emit("member:muted", {
      memberId: targetSockets[0]?.data.userId ?? "",
      nickname: targetNickname,
      mutedBy,
      duration,
    });
    console.log(`[Chat] ${targetNickname} muted by ${mutedBy}`);
  });

  // ── 관리 명령: unmute ──
  socket.on("admin:unmute", ({ targetNickname }) => {
    const spaceId = socket.data.spaceId;
    if (!spaceId || !isAdmin(socket)) {
      socket.emit("admin:error", { code: "FORBIDDEN", message: "Insufficient permissions" });
      return;
    }

    const targetSockets = findSocketsByNickname(io, spaceId, targetNickname);
    for (const ts of targetSockets) {
      ts.data.restriction = "NONE";
    }

    const spacePlayers = spacePlayersMap.get(spaceId);
    const unmutedBy = spacePlayers?.get(socket.data.userId)?.nickname ?? "Admin";

    io.to(spaceId).emit("member:unmuted", {
      memberId: targetSockets[0]?.data.userId ?? "",
      nickname: targetNickname,
      unmutedBy,
    });
    console.log(`[Chat] ${targetNickname} unmuted by ${unmutedBy}`);
  });

  // ── 관리 명령: kick ──
  socket.on("admin:kick", ({ targetNickname }) => {
    const spaceId = socket.data.spaceId;
    if (!spaceId || !isAdmin(socket)) {
      socket.emit("admin:error", { code: "FORBIDDEN", message: "Insufficient permissions" });
      return;
    }

    const targetSockets = findSocketsByNickname(io, spaceId, targetNickname);
    const spacePlayers = spacePlayersMap.get(spaceId);
    const kickedBy = spacePlayers?.get(socket.data.userId)?.nickname ?? "Admin";

    io.to(spaceId).emit("member:kicked", {
      memberId: targetSockets[0]?.data.userId ?? "",
      nickname: targetNickname,
      kickedBy,
    });

    // 소켓 강제 해제
    for (const ts of targetSockets) {
      ts.leave(spaceId);
      ts.disconnect(true);
    }

    console.log(`[Chat] ${targetNickname} kicked by ${kickedBy}`);
  });

  // ── 관리 명령: announce ──
  socket.on("admin:announce", ({ content }) => {
    const spaceId = socket.data.spaceId;
    if (!spaceId || !isAdmin(socket)) {
      socket.emit("admin:error", { code: "FORBIDDEN", message: "Insufficient permissions" });
      return;
    }

    const sanitized = sanitizeContent(content);
    if (sanitized.length === 0) return;

    const spacePlayers = spacePlayersMap.get(spaceId);
    const announcer = spacePlayers?.get(socket.data.userId)?.nickname ?? "Admin";

    io.to(spaceId).emit("space:announcement", {
      content: sanitized,
      announcer,
      timestamp: new Date().toISOString(),
    });

    console.log(`[Chat] Announcement by ${announcer}: ${sanitized.slice(0, 50)}`);
  });
}

/** DB 비동기 저장 (Prisma 사용 가능 시) */
async function saveChatMessageAsync(
  spaceId: string,
  senderId: string,
  senderName: string,
  content: string,
  type: string,
  _tempId: string,
  _replyTo?: { id: string; senderNickname: string; content: string }
): Promise<void> {
  try {
    // Dynamic import to avoid bundling issues in socket server
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const messageTypeMap: Record<string, string> = {
      message: "MESSAGE",
      whisper: "WHISPER",
      party: "PARTY",
      system: "SYSTEM",
      announcement: "ANNOUNCEMENT",
    };

    await prisma.chatMessage.create({
      data: {
        spaceId,
        senderId,
        senderType: "USER",
        senderName,
        content,
        type: (messageTypeMap[type] ?? "MESSAGE") as "MESSAGE" | "WHISPER" | "PARTY" | "SYSTEM" | "ANNOUNCEMENT",
      },
    });

    await prisma.$disconnect();
  } catch (err) {
    console.error("[Chat] DB save error:", err);
  }
}

/** DB soft delete (소켓 경로용) */
async function softDeleteMessageAsync(messageId: string, deletedBy: string): Promise<void> {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedBy,
        deletedAt: new Date(),
      },
    });

    await prisma.$disconnect();
  } catch (err) {
    console.error("[Chat] DB soft delete error:", err);
  }
}
