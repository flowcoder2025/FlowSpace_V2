import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET /api/spaces/[id]/messages - 채팅 히스토리 (cursor 페이지네이션) */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: spaceId } = await params;
    const userId = session.user.id;

    // 멤버십 검증
    const member = await prisma.spaceMember.findFirst({
      where: {
        spaceId,
        OR: [{ userId }, { guestSession: { sessionToken: session.user.id } }],
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Not a member of this space" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const type = searchParams.get("type");

    // 필터 조건
    const where: Record<string, unknown> = {
      spaceId,
      isDeleted: false,
    };

    if (type) {
      where.type = type.toUpperCase();
    }

    // 귓속말 필터: 공개 메시지 + 자신이 보내거나 받은 귓속말만
    const messages = await prisma.chatMessage.findMany({
      where: {
        ...where,
        OR: [
          { type: { not: "WHISPER" } },
          { type: "WHISPER", senderId: userId },
          { type: "WHISPER", targetId: userId },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        senderId: true,
        senderType: true,
        senderName: true,
        content: true,
        type: true,
        targetId: true,
        createdAt: true,
      },
    });

    const hasMore = messages.length > limit;
    const results = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? results[results.length - 1]?.id : null;

    return NextResponse.json({
      messages: results.map((m) => ({
        id: m.id,
        userId: m.senderId || "unknown",
        nickname: m.senderName,
        content: m.content,
        type: m.type.toLowerCase(),
        timestamp: m.createdAt.toISOString(),
      })),
      nextCursor,
      hasMore,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch messages",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
