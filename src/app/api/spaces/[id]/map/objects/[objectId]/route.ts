import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string; objectId: string }>;
}

/** PATCH /api/spaces/[id]/map/objects/[objectId] - 오브젝트 수정 (OWNER/STAFF only) */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, objectId } = await params;

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

    // 오브젝트 존재 확인
    const existing = await prisma.mapObject.findFirst({
      where: { id: objectId, spaceId: id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Map object not found" },
        { status: 404 }
      );
    }

    const body = (await request.json()) as {
      positionX?: number;
      positionY?: number;
      rotation?: number;
      label?: string;
      width?: number;
      height?: number;
      customData?: object;
      isActive?: boolean;
    };

    const data: Record<string, unknown> = {};
    if (body.positionX !== undefined) data.positionX = body.positionX;
    if (body.positionY !== undefined) data.positionY = body.positionY;
    if (body.rotation !== undefined) data.rotation = body.rotation;
    if (body.label !== undefined) data.label = body.label;
    if (body.width !== undefined) data.width = body.width;
    if (body.height !== undefined) data.height = body.height;
    if (body.customData !== undefined) data.customData = body.customData;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const updated = await prisma.mapObject.update({
      where: { id: objectId },
      data,
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
        isActive: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update map object",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/** DELETE /api/spaces/[id]/map/objects/[objectId] - 오브젝트 삭제 (OWNER/STAFF only) */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, objectId } = await params;

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

    const existing = await prisma.mapObject.findFirst({
      where: { id: objectId, spaceId: id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Map object not found" },
        { status: 404 }
      );
    }

    await prisma.mapObject.delete({ where: { id: objectId } });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete map object",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
