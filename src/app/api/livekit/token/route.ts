import { NextRequest, NextResponse } from "next/server";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ============================================
// Configuration
// ============================================
const IS_DEV = process.env.NODE_ENV === "development";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL || "http://localhost:7880";

const DEV_API_KEY = "devkey";
const DEV_API_SECRET = "devsecret";

// ============================================
// Validation
// ============================================
const ROOM_NAME_PATTERN = /^space-[a-zA-Z0-9-]+$/;
const PARTICIPANT_ID_PATTERN = /^[a-zA-Z0-9-]+$/;

function validateRoomName(roomName: string): boolean {
  if (!roomName || typeof roomName !== "string") return false;
  if (roomName.length > 100) return false;
  return ROOM_NAME_PATTERN.test(roomName);
}

function validateParticipantId(participantId: string): boolean {
  if (!participantId || typeof participantId !== "string") return false;
  if (participantId.length > 100) return false;
  return PARTICIPANT_ID_PATTERN.test(participantId);
}

function validateParticipantName(name: string): boolean {
  if (!name || typeof name !== "string") return false;
  if (name.length > 50) return false;
  return true;
}

// ============================================
// 중복 참가자 정리 (세션 전환 시)
// ============================================
async function removeDuplicateParticipants(
  roomName: string,
  newIdentity: string,
  participantName: string,
  apiKey: string,
  apiSecret: string
): Promise<void> {
  try {
    const roomService = new RoomServiceClient(LIVEKIT_URL, apiKey, apiSecret);
    const participants = await roomService.listParticipants(roomName);

    const duplicates = participants.filter(
      (p) => p.name === participantName && p.identity !== newIdentity
    );

    if (duplicates.length > 0) {
      console.log(
        `[LiveKit Token] Removing ${duplicates.length} duplicate participant(s) with name "${participantName}"`
      );

      for (const dup of duplicates) {
        try {
          await roomService.removeParticipant(roomName, dup.identity);
        } catch (removeError) {
          console.warn(
            `[LiveKit Token] Failed to remove participant ${dup.identity}:`,
            removeError
          );
        }
      }
    }
  } catch {
    // Room이 아직 없거나 조회 실패 - 무시
  }
}

// ============================================
// POST /api/livekit/token
// ============================================
export async function POST(request: NextRequest) {
  try {
    // 1. 환경변수 검증
    let apiKey = LIVEKIT_API_KEY;
    let apiSecret = LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      if (IS_DEV) {
        console.warn(
          "[LiveKit Token] Using dev credentials - not for production!"
        );
        apiKey = DEV_API_KEY;
        apiSecret = DEV_API_SECRET;
      } else {
        return NextResponse.json(
          { error: "LiveKit is not configured" },
          { status: 503 }
        );
      }
    }

    // 2. Request body 파싱
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { roomName, participantName, participantId, sessionToken } = body;

    // 3. 필수 필드 검증
    if (!roomName || !participantName || !participantId) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: roomName, participantName, participantId",
        },
        { status: 400 }
      );
    }

    if (!validateRoomName(roomName)) {
      return NextResponse.json(
        { error: "Invalid room name format" },
        { status: 400 }
      );
    }

    if (!validateParticipantId(participantId)) {
      return NextResponse.json(
        { error: "Invalid participant ID format" },
        { status: 400 }
      );
    }

    if (!validateParticipantName(participantName)) {
      return NextResponse.json(
        { error: "Invalid participant name" },
        { status: 400 }
      );
    }

    // 4. 세션 검증 (🔒 participantId는 서버에서 파생)
    const session = await auth();
    let serverParticipantId: string | undefined = undefined;
    let serverParticipantName: string = participantName;

    // 인증된 사용자
    if (session?.user?.id) {
      const spaceIdFromRoom = roomName.replace("space-", "");

      const [spaceMember, space] = await Promise.all([
        prisma.spaceMember.findFirst({
          where: { spaceId: spaceIdFromRoom, userId: session.user.id },
          select: { id: true },
        }),
        prisma.space.findFirst({
          where: { id: spaceIdFromRoom, ownerId: session.user.id },
          select: { id: true },
        }),
      ]);

      if (!spaceMember && !space) {
        if (!sessionToken) {
          return NextResponse.json(
            {
              error:
                "You are not a member of this space. Please join as a guest first.",
            },
            { status: 403 }
          );
        }
      } else {
        serverParticipantId = `user-${session.user.id}`;
        serverParticipantName =
          participantName || session.user.name || "Unknown";
      }
    }

    // 게스트 세션 처리
    if (!serverParticipantId && sessionToken) {
      const isDevSessionToken = IS_DEV && sessionToken.startsWith("dev-");

      if (isDevSessionToken) {
        serverParticipantId = participantId;
      } else {
        const guestSession = await prisma.guestSession
          .findUnique({
            where: { sessionToken },
            select: {
              id: true,
              nickname: true,
              spaceId: true,
              expiresAt: true,
            },
          })
          .catch(() => null);

        if (!guestSession) {
          return NextResponse.json(
            { error: "Invalid session token" },
            { status: 401 }
          );
        }

        if (new Date() > guestSession.expiresAt) {
          return NextResponse.json(
            { error: "Session has expired" },
            { status: 401 }
          );
        }

        const expectedRoomName = `space-${guestSession.spaceId}`;
        if (roomName !== expectedRoomName) {
          return NextResponse.json(
            { error: "Room name does not match session" },
            { status: 403 }
          );
        }

        serverParticipantId = `guest-${guestSession.id}`;
        serverParticipantName = guestSession.nickname;
      }
    }

    // 개발 모드 폴백
    if (!serverParticipantId) {
      if (IS_DEV) {
        serverParticipantId = `dev-anon-${Date.now()}`;
      } else {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }
    }

    // 5. 중복 참가자 정리
    await removeDuplicateParticipants(
      roomName,
      serverParticipantId,
      serverParticipantName,
      apiKey,
      apiSecret
    );

    // 6. 토큰 생성
    const token = new AccessToken(apiKey, apiSecret, {
      identity: serverParticipantId,
      name: serverParticipantName,
      ttl: 60 * 60 * 4, // 4 hours
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();

    if (IS_DEV) {
      console.log("[LiveKit Token] Token generated for:", {
        roomName,
        participantId: serverParticipantId,
        participantName: serverParticipantName,
      });
    }

    return NextResponse.json({
      token: jwt,
      participantId: serverParticipantId,
      participantName: serverParticipantName,
    });
  } catch (error) {
    console.error("[LiveKit Token] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}
