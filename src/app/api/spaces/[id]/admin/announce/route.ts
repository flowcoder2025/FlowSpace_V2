import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { internalErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { enforceSpaceMutable } from "@/lib/space-status-policy";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
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
    // 비-ACTIVE 스페이스(soft-delete 등)는 공지 발송 불가(superAdmin 포함, WI-046).
    const archivedGate = await enforceSpaceMutable(spaceId);
    if (archivedGate) return archivedGate;

    const body = await request.json();
    const { content } = body as { content: string };

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    });

    const message = await prisma.chatMessage.create({
      data: {
        spaceId,
        senderId: session.user.id,
        senderType: "USER",
        senderName: user?.name || user?.email || "Admin",
        content: content.trim(),
        type: "ANNOUNCEMENT",
      },
    });

    // 이벤트 로그 기록
    await prisma.spaceEventLog.create({
      data: {
        spaceId,
        userId: session.user.id,
        eventType: "ADMIN_ACTION",
        payload: { action: "announce", messageId: message.id },
      },
    });

    return NextResponse.json({ message });
  } catch (error) {
    return internalErrorResponse("POST /api/spaces/[id]/admin/announce", error, "Failed to send announcement");
  }
}
