import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { internalErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { enforceSpaceMutable } from "@/lib/space-status-policy";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** PUT /api/spaces/[id]/map/tiles - 타일 레이어 전체 저장 (OWNER/STAFF only) */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // 권한 확인
    const member = await prisma.spaceMember.findFirst({
      where: {
        spaceId: id,
        userId: session.user.id,
        role: { in: ["OWNER", "STAFF"] },
      },
      select: { role: true },
    });

    if (!member && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // 비-ACTIVE 스페이스(soft-delete 등)는 맵 편집 불가(superAdmin 포함, WI-046).
    const archivedGate = await enforceSpaceMutable(id);
    if (archivedGate) return archivedGate;

    const body = (await request.json()) as { mapData: unknown };

    if (!body.mapData || typeof body.mapData !== "object") {
      return NextResponse.json(
        { error: "Invalid mapData format" },
        { status: 400 }
      );
    }

    const updated = await prisma.space.update({
      where: { id },
      data: { mapData: body.mapData as object },
      select: { id: true },
    });

    return NextResponse.json({ id: updated.id, saved: true });
  } catch (error) {
    return internalErrorResponse("PUT /api/spaces/[id]/map/tiles", error, "Failed to save tile data");
  }
}
