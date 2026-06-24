import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { auth } from "@/lib/auth";
import { internalErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { canActOn } from "@/lib/space-role";
import { enforceSpaceMutable } from "@/lib/space-status-policy";
import {
  parseParticipantIdentity,
  findMicrophoneTrack,
  buildModeratedPermission,
  resolveLiveKitConfig,
} from "@/features/space/livekit-moderation";
import type { SpaceRole } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/spaces/[id]/livekit/moderate
 *
 * 운영자(OWNER/STAFF/superAdmin)가 다른 참가자의 마이크를 서버 측에서 강제 음소거/해제한다(WI-038).
 * 채팅 음소거(restriction=MUTED, socket enforce)와 별개의 음성/미디어 레이어.
 *
 * body: { identity: "user-{userId}" | "guest-{guestSessionId}", muted: boolean }
 *
 * stickiness=세션 내(권한 회수): canPublishSources에서 MICROPHONE을 제거(재퍼블리시 차단) +
 * 기존 mic 트랙을 서버 mute. 재접속 시 토큰 grant(canPublish:true)로 초기화됨(의도된 한계).
 * unmute는 MICROPHONE publish 권한 복원만(force-unmute 안 함 — 사용자 self-mute 보존).
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: spaceId } = await params;

    // 1. 인증
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const actorUserId = session.user.id;
    const isSuperAdmin = session.user.isSuperAdmin === true;

    // 2. body 파싱/검증
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { identity, muted } = body as { identity?: unknown; muted?: unknown };
    if (typeof muted !== "boolean") {
      return NextResponse.json({ error: "muted must be a boolean" }, { status: 400 });
    }
    const target = parseParticipantIdentity(identity);
    if (!target) {
      return NextResponse.json(
        { error: "Invalid participant identity", code: "INVALID_IDENTITY" },
        { status: 400 }
      );
    }
    const identityStr = identity as string; // parseParticipantIdentity가 string 보장

    // 3. self 거부 (이 API는 타인 moderation 전용)
    if (target.kind === "user" && target.userId === actorUserId) {
      return NextResponse.json(
        { error: "Cannot moderate yourself", code: "SELF_TARGET" },
        { status: 400 }
      );
    }

    // 4. actor 권한 게이트 (OWNER/STAFF/superAdmin)
    const self = await prisma.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId, userId: actorUserId } },
      select: { role: true },
    });
    if (!self && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (self && self.role !== "OWNER" && self.role !== "STAFF" && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actorRole = (self?.role ?? "OWNER") as SpaceRole;

    // 비-ACTIVE 스페이스(soft-delete 등)는 마이크 강제 음소거 등 모더레이션 불가(superAdmin 포함, WI-046).
    const archivedGate = await enforceSpaceMutable(spaceId);
    if (archivedGate) return archivedGate;

    // 5. target 권한 게이트
    //  - user-*: SpaceMember.role 조회 → OWNER 보호 + canActOn(역할 계층)
    //  - guest-*: role 없음 → 최하위 → admin이 항상 제재 가능(room 소속은 getParticipant로 확인)
    let targetName: string | null = null;
    if (target.kind === "user") {
      const targetMember = await prisma.spaceMember.findUnique({
        where: { spaceId_userId: { spaceId, userId: target.userId } },
        select: { role: true, displayName: true, user: { select: { name: true } } },
      });
      if (!targetMember) {
        return NextResponse.json(
          { error: "Target is not a member of this space", code: "TARGET_NOT_MEMBER" },
          { status: 404 }
        );
      }
      if (targetMember.role === "OWNER" && !isSuperAdmin) {
        return NextResponse.json({ error: "Cannot modify the space owner" }, { status: 403 });
      }
      if (!canActOn(actorRole, targetMember.role, isSuperAdmin)) {
        return NextResponse.json(
          { error: "Cannot modify a member of equal or higher role" },
          { status: 403 }
        );
      }
      targetName = targetMember.user?.name ?? targetMember.displayName ?? null;
    }

    // 6. LiveKit 설정
    const config = resolveLiveKitConfig();
    if (!config) {
      return NextResponse.json(
        { error: "LiveKit is not configured", code: "LIVEKIT_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    const roomName = `space-${spaceId}`;
    const roomService = new RoomServiceClient(config.url, config.apiKey, config.apiSecret);

    // 7. 대상 participant 조회 (room에 없으면 404 — stale UI 숨기지 않음)
    let participant;
    try {
      participant = await roomService.getParticipant(roomName, identityStr);
    } catch (error) {
      console.error(
        "[LiveKit Moderate] getParticipant failed",
        { roomName, identity: identityStr },
        error
      );
      return NextResponse.json(
        { error: "Participant is not connected to this space", code: "PARTICIPANT_NOT_FOUND" },
        { status: 404 }
      );
    }
    if (target.kind === "guest") {
      targetName = participant.name || null;
    }

    // 8. 제재 적용 — 권한 회수 먼저 → 그 다음 기존 mic 트랙 mute(재퍼블리시 race 창 축소)
    let mutedTrackSid: string | null = null;
    try {
      const nextPermission = buildModeratedPermission(participant.permission, muted);
      await roomService.updateParticipant(roomName, identityStr, { permission: nextPermission });

      if (muted) {
        const mic = findMicrophoneTrack(participant.tracks);
        if (mic) {
          if (!mic.muted) {
            await roomService.mutePublishedTrack(roomName, identityStr, mic.sid, true);
          }
          mutedTrackSid = mic.sid; // 이미 muted여도 idempotent하게 sid 반환
        }
      }
    } catch (error) {
      console.error(
        "[LiveKit Moderate] operation failed",
        { roomName, identity: identityStr, muted },
        error
      );
      return NextResponse.json(
        { error: "LiveKit operation failed", code: "LIVEKIT_OPERATION_FAILED" },
        { status: 502 }
      );
    }

    // 9. 감사 로그 — 두 작업 완료 후. LiveKit 부수효과는 이미 적용됐으므로 로그 실패가
    //    요청을 500으로 뒤집지 않게 best-effort(서버 로그에만 기록).
    await prisma.spaceEventLog
      .create({
        data: {
          spaceId,
          userId: actorUserId,
          eventType: "ADMIN_ACTION",
          payload: {
            action: muted ? "voiceMute" : "voiceUnmute",
            targetName: targetName ?? undefined,
            targetIdentity: identityStr,
          },
        },
      })
      .catch((error) => {
        console.error("[LiveKit Moderate] audit log failed", error);
      });

    return NextResponse.json({ identity: identityStr, muted, trackSid: mutedTrackSid });
  } catch (error) {
    return internalErrorResponse("POST /api/spaces/[id]/livekit/moderate", error, "Failed to moderate participant");
  }
}
