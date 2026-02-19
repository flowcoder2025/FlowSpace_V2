import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface DailyCount {
  date: Date;
  count: bigint;
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
    const days = Math.min(Number(searchParams.get("days")) || 14, 90);

    const since = new Date();
    since.setDate(since.getDate() - days);

    // 일별 메시지 수
    const dailyMessages = await prisma.$queryRaw<DailyCount[]>`
      SELECT DATE_TRUNC('day', "createdAt") as date, COUNT(*)::bigint as count
      FROM "ChatMessage"
      WHERE "spaceId" = ${spaceId} AND "createdAt" >= ${since}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `;

    // 일별 방문자 수
    const dailyVisitors = await prisma.$queryRaw<DailyCount[]>`
      SELECT DATE_TRUNC('day', "createdAt") as date, COUNT(*)::bigint as count
      FROM "SpaceEventLog"
      WHERE "spaceId" = ${spaceId} AND "eventType" = 'ENTER' AND "createdAt" >= ${since}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `;

    return NextResponse.json({
      dailyMessages: dailyMessages.map((r) => ({
        date: r.date.toISOString().split("T")[0],
        count: Number(r.count),
      })),
      dailyVisitors: dailyVisitors.map((r) => ({
        date: r.date.toISOString().split("T")[0],
        count: Number(r.count),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch analytics", details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
