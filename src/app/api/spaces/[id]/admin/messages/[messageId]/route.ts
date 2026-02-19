import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string; messageId: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: spaceId, messageId } = await params;

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

    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });
    if (!message || message.spaceId !== spaceId) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // soft delete
    await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedBy: session.user.id,
        deletedAt: new Date(),
      },
    });

    // 이벤트 로그
    await prisma.spaceEventLog.create({
      data: {
        spaceId,
        userId: session.user.id,
        eventType: "ADMIN_ACTION",
        payload: { action: "deleteMessage", messageId, senderName: message.senderName },
      },
    });

    return NextResponse.json({ message: "Message deleted" });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete message", details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
