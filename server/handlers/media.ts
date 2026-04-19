/**
 * Media Handlers
 * recording:start/stop, spotlight:activate/deactivate, proximity:set
 */

import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../src/features/space/socket/internal/types";
import { getPrisma } from "../lib/prisma";
import {
  recordingStates,
  spotlightStates,
  getOrCreateSpotlightState,
  setProximityState,
} from "../state";
import type { RecordingStatusData, ActiveSpotlight } from "../state";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const IS_DEV = process.env.NODE_ENV === "development";

function isAdmin(socket: TypedSocket): boolean {
  return socket.data.role === "OWNER" || socket.data.role === "STAFF";
}

export function handleMedia(io: IO, socket: TypedSocket) {
  // ============================================
  // Recording Events
  // ============================================

  socket.on("recording:start", () => {
    const spaceId = socket.data.spaceId;
    const userId = socket.data.userId;

    if (!spaceId || !userId) {
      socket.emit("media:error", {
        code: "NOT_IN_SPACE",
        message: "공간에 먼저 입장해야 합니다.",
      });
      return;
    }

    // STAFF 이상만 녹화 가능
    if (!isAdmin(socket)) {
      socket.emit("media:error", {
        code: "FORBIDDEN",
        message: "녹화 권한이 없습니다. STAFF 이상만 녹화할 수 있습니다.",
      });
      return;
    }

    // 이미 녹화 중인지 확인
    const existing = recordingStates.get(spaceId);
    if (existing?.isRecording) {
      socket.emit("media:error", {
        code: "ALREADY_RECORDING",
        message: `이미 ${existing.recorderNickname}님이 녹화 중입니다.`,
      });
      return;
    }

    const status: RecordingStatusData = {
      isRecording: true,
      recorderId: userId,
      recorderNickname: socket.data.name || "Unknown",
      startedAt: Date.now(),
    };
    recordingStates.set(spaceId, status);

    io.to(spaceId).emit("recording:started", status);

    console.log(
      `[Media] Recording STARTED by ${socket.data.name} in space ${spaceId}`
    );
  });

  socket.on("recording:stop", () => {
    const spaceId = socket.data.spaceId;
    const userId = socket.data.userId;

    if (!spaceId || !userId) {
      socket.emit("media:error", {
        code: "NOT_IN_SPACE",
        message: "공간에 먼저 입장해야 합니다.",
      });
      return;
    }

    const existing = recordingStates.get(spaceId);
    if (!existing?.isRecording) {
      socket.emit("media:error", {
        code: "NOT_RECORDING",
        message: "현재 녹화 중이 아닙니다.",
      });
      return;
    }

    // 녹화자 본인 또는 STAFF 이상만 중지 가능
    const isRecorder = existing.recorderId === userId;
    if (!isRecorder && !isAdmin(socket)) {
      socket.emit("media:error", {
        code: "FORBIDDEN",
        message: "녹화 중지 권한이 없습니다.",
      });
      return;
    }

    const stoppedStatus: RecordingStatusData = {
      isRecording: false,
      recorderId: existing.recorderId,
      recorderNickname: existing.recorderNickname,
      startedAt: existing.startedAt,
    };
    recordingStates.delete(spaceId);

    io.to(spaceId).emit("recording:stopped", stoppedStatus);

    console.log(
      `[Media] Recording STOPPED by ${socket.data.name} in space ${spaceId}`
    );
  });

  // ============================================
  // Spotlight Events
  // ============================================

  socket.on("spotlight:activate", async () => {
    const spaceId = socket.data.spaceId;
    const userId = socket.data.userId;

    if (!spaceId || !userId) {
      socket.emit("media:error", {
        code: "NOT_IN_SPACE",
        message: "공간에 먼저 입장해야 합니다.",
      });
      return;
    }

    try {
      // DB에서 스포트라이트 권한 확인
      const prisma = await getPrisma();

      const grant = await prisma.spotlightGrant.findFirst({
        where: {
          spaceId,
          userId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });

      if (!grant) {
        socket.emit("media:error", {
          code: "NO_GRANT",
          message: "스포트라이트 권한이 없습니다.",
        });
        return;
      }

      await prisma.spotlightGrant.update({
        where: { id: grant.id },
        data: { isActive: true },
      });

      // 메모리 상태 업데이트
      const spotlightState = getOrCreateSpotlightState(spaceId);
      const spotlight: ActiveSpotlight = {
        participantId: userId,
        nickname: socket.data.name || "Unknown",
      };
      spotlightState.set(userId, spotlight);

      io.to(spaceId).emit("spotlight:activated", {
        participantId: userId,
        nickname: socket.data.name || "Unknown",
        isActive: true,
      });

      console.log(
        `[Media] Spotlight ACTIVATED by ${socket.data.name} in space ${spaceId}`
      );
    } catch (error) {
      console.error("[Media] Spotlight activate error:", error);
      socket.emit("media:error", {
        code: "INTERNAL",
        message: "스포트라이트 활성화에 실패했습니다.",
      });
    }
  });

  socket.on("spotlight:deactivate", async () => {
    const spaceId = socket.data.spaceId;
    const userId = socket.data.userId;

    if (!spaceId || !userId) {
      socket.emit("media:error", {
        code: "NOT_IN_SPACE",
        message: "공간에 먼저 입장해야 합니다.",
      });
      return;
    }

    try {
      const prisma = await getPrisma();

      // DB에서 활성 grant 비활성화
      await prisma.spotlightGrant.updateMany({
        where: { spaceId, userId, isActive: true },
        data: { isActive: false },
      });

      // 메모리 상태 업데이트
      const spotlightState = spotlightStates.get(spaceId);
      if (spotlightState) {
        spotlightState.delete(userId);
      }

      io.to(spaceId).emit("spotlight:deactivated", {
        participantId: userId,
        nickname: socket.data.name || "Unknown",
        isActive: false,
      });

      console.log(
        `[Media] Spotlight DEACTIVATED by ${socket.data.name} in space ${spaceId}`
      );
    } catch (error) {
      console.error("[Media] Spotlight deactivate error:", error);
      socket.emit("media:error", {
        code: "INTERNAL",
        message: "스포트라이트 비활성화에 실패했습니다.",
      });
    }
  });

  // ============================================
  // Proximity Communication
  // ============================================

  socket.on("proximity:set", (data) => {
    const spaceId = socket.data.spaceId;
    const userId = socket.data.userId;

    if (!spaceId || !userId) {
      socket.emit("media:error", {
        code: "NOT_IN_SPACE",
        message: "공간에 먼저 입장해야 합니다.",
      });
      return;
    }

    // STAFF 이상만 가능
    if (!isAdmin(socket)) {
      socket.emit("media:error", {
        code: "FORBIDDEN",
        message: "근접 통신 설정 권한이 없습니다. STAFF 이상만 가능합니다.",
      });
      return;
    }

    setProximityState(spaceId, data.enabled);

    io.to(spaceId).emit("proximity:changed", {
      enabled: data.enabled,
      changedBy: socket.data.name || "Unknown",
    });

    // 시스템 메시지
    const modeText = data.enabled ? "근접 모드" : "전역 모드";
    io.to(spaceId).emit("chat:message", {
      id: `sys-proximity-${Date.now()}`,
      userId: "system",
      nickname: "시스템",
      content: `📡 음성/영상 통신이 ${modeText}로 변경되었습니다. (by ${socket.data.name})`,
      type: "system",
      timestamp: new Date().toISOString(),
    });

    if (IS_DEV) {
      console.log(
        `[Media] Proximity ${data.enabled ? "ENABLED" : "DISABLED"} by ${socket.data.name} in space ${spaceId}`
      );
    }
  });
}
