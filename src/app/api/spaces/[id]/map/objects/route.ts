import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { internalErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { enforceSpaceMutable } from "@/lib/space-status-policy";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** POST /api/spaces/[id]/map/objects - 오브젝트 배치 (OWNER/STAFF only) */
export async function POST(request: Request, { params }: RouteParams) {
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

    const body = (await request.json()) as {
      objectType: string;
      positionX: number;
      positionY: number;
      assetId?: string;
      label?: string;
      rotation?: number;
      width?: number;
      height?: number;
      customData?: object;
    };

    if (!body.objectType || body.positionX == null || body.positionY == null) {
      return NextResponse.json(
        { error: "objectType, positionX, positionY are required" },
        { status: 400 }
      );
    }

    const mapObject = await prisma.mapObject.create({
      data: {
        spaceId: id,
        objectType: body.objectType,
        positionX: body.positionX,
        positionY: body.positionY,
        assetId: body.assetId ?? null,
        label: body.label ?? null,
        rotation: body.rotation ?? 0,
        width: body.width ?? 1,
        height: body.height ?? 1,
        customData: body.customData ?? Prisma.JsonNull,
        placedBy: session.user.id,
        placedByType: "USER",
      },
      select: {
        id: true,
        objectType: true,
        positionX: true,
        positionY: true,
        assetId: true,
        label: true,
        rotation: true,
        width: true,
        height: true,
        linkedObjectId: true,
        customData: true,
      },
    });

    return NextResponse.json(mapObject, { status: 201 });
  } catch (error) {
    return internalErrorResponse("POST /api/spaces/[id]/map/objects", error, "Failed to create map object");
  }
}
