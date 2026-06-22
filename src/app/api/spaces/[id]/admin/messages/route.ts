import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildCursorPage, parsePageLimit } from "@/lib/pagination";
import { internalErrorResponse } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: spaceId } = await params;

    const self = await prisma.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId, userId: session.user.id } },
      select: { role: true },
    });
    if (!self && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (self && self.role !== "OWNER" && self.role !== "STAFF" && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = parsePageLimit(searchParams.get("limit"));

    const messages = await prisma.chatMessage.findMany({
      where: { spaceId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    // 응답 계약 보존: admin 라우트는 { messages, nextCursor }만 반환(hasMore 미노출, WI-012-2 S5/D5).
    const { items, nextCursor } = buildCursorPage(messages, limit);

    return NextResponse.json({ messages: items, nextCursor });
  } catch (error) {
    return internalErrorResponse("GET /api/spaces/[id]/admin/messages", error, "Failed to fetch messages");
  }
}
