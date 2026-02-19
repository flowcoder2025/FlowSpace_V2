import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: spaceId } = await params;

    // 권한 확인
    const member = await prisma.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId, userId: session.user.id } },
      select: { role: true },
    });

    if (!member && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (member && member.role !== "OWNER" && member.role !== "STAFF" && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [memberCount, messageCount, todayMessageCount, recentActivity] = await Promise.all([
      prisma.spaceMember.count({ where: { spaceId } }),
      prisma.chatMessage.count({ where: { spaceId } }),
      prisma.chatMessage.count({
        where: { spaceId, createdAt: { gte: today } },
      }),
      prisma.spaceEventLog.findMany({
        where: { spaceId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          user: { select: { name: true, email: true } },
        },
      }),
    ]);

    return NextResponse.json({
      memberCount,
      messageCount,
      todayMessageCount,
      recentActivity,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch stats", details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
