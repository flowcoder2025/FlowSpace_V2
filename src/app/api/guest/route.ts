import { NextResponse } from "next/server";
import { createGuestSession, validateGuestSession } from "@/lib/guest";
import { prisma } from "@/lib/prisma";

/** POST /api/guest - 게스트 세션 생성 */
export async function POST(request: Request) {
  try {
    const { spaceId, nickname, accessSecret } = (await request.json()) as {
      spaceId?: string;
      nickname?: string;
      accessSecret?: string;
    };

    if (!spaceId || !nickname) {
      return NextResponse.json(
        { error: "spaceId, nickname are required" },
        { status: 400 }
      );
    }

    if (nickname.length < 2 || nickname.length > 20) {
      return NextResponse.json(
        { error: "Nickname must be 2-20 characters" },
        { status: 400 }
      );
    }

    // 공간 존재 + 활성 확인
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
      select: { id: true, status: true, accessType: true, accessSecret: true },
    });

    if (!space || space.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Space not found or inactive" },
        { status: 404 }
      );
    }

    if (space.accessType === "PRIVATE") {
      return NextResponse.json(
        { error: "Guest access not allowed for private spaces" },
        { status: 403 }
      );
    }

    // PASSWORD 공간은 게스트도 accessSecret 검증 (members POST와 동일 정책)
    if (space.accessType === "PASSWORD") {
      if (!accessSecret || accessSecret !== space.accessSecret) {
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 403 }
        );
      }
    }

    const guest = await createGuestSession(spaceId, nickname);

    return NextResponse.json(guest, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create guest session",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/** GET /api/guest?token=xxx - 게스트 세션 검증 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "token is required" },
      { status: 400 }
    );
  }

  const guest = await validateGuestSession(token);

  if (!guest) {
    return NextResponse.json(
      { error: "Invalid or expired session" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    id: guest.id,
    nickname: guest.nickname,
    spaceId: guest.space.id,
    spaceName: guest.space.name,
    expiresAt: guest.expiresAt,
  });
}
