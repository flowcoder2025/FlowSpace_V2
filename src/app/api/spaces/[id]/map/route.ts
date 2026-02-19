import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/spaces/[id]/map - 맵 데이터 + 오브젝트 일괄 조회 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // 멤버십 검증 (PUBLIC 공간은 허용, 그 외는 멤버만 접근)
    const spaceAccess = await prisma.space.findUnique({
      where: { id },
      select: { id: true, accessType: true },
    });
    if (!spaceAccess) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }
    if (spaceAccess.accessType !== "PUBLIC") {
      const member = await prisma.spaceMember.findUnique({
        where: { spaceId_userId: { spaceId: id, userId: session.user.id } },
        select: { id: true },
      });
      if (!member && !session.user.isSuperAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const space = await prisma.space.findUnique({
      where: { id },
      select: {
        id: true,
        mapData: true,
        mapObjects: {
          where: { isActive: true },
          select: {
            id: true,
            assetId: true,
            objectType: true,
            label: true,
            positionX: true,
            positionY: true,
            rotation: true,
            width: true,
            height: true,
            linkedObjectId: true,
            customData: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    return NextResponse.json({
      mapData: space.mapData,
      objects: space.mapObjects,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch map data",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
