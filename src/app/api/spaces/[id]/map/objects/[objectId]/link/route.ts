import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string; objectId: string }>;
}

/** POST /api/spaces/[id]/map/objects/[objectId]/link - 포탈 쌍 연결 (OWNER/STAFF only) */
export async function POST(request: Request, { params }: RouteParams) {
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

    const body = (await request.json()) as { targetObjectId: string };

    if (!body.targetObjectId) {
      return NextResponse.json(
        { error: "targetObjectId is required" },
        { status: 400 }
      );
    }

    if (objectId === body.targetObjectId) {
      return NextResponse.json(
        { error: "Cannot link object to itself" },
        { status: 400 }
      );
    }

    // 양쪽 오브젝트 존재 + 같은 space 확인
    const [source, target] = await Promise.all([
      prisma.mapObject.findFirst({
        where: { id: objectId, spaceId: id, isActive: true },
        select: { id: true, objectType: true, linkedObjectId: true },
      }),
      prisma.mapObject.findFirst({
        where: { id: body.targetObjectId, spaceId: id, isActive: true },
        select: { id: true, objectType: true, linkedObjectId: true },
      }),
    ]);

    if (!source || !target) {
      return NextResponse.json(
        { error: "One or both objects not found" },
        { status: 404 }
      );
    }

    // 기존 링크 해제 후 새 링크 설정
    // source의 기존 링크 해제
    if (source.linkedObjectId) {
      await prisma.mapObject.update({
        where: { id: source.linkedObjectId },
        data: { linkedObjectId: null },
      });
    }

    // target의 기존 링크 해제
    if (target.linkedObjectId) {
      await prisma.mapObject.update({
        where: { id: target.linkedObjectId },
        data: { linkedObjectId: null },
      });
    }

    // 양방향 링크: source ↔ target
    await Promise.all([
      prisma.mapObject.update({
        where: { id: objectId },
        data: { linkedObjectId: body.targetObjectId },
      }),
      prisma.mapObject.update({
        where: { id: body.targetObjectId },
        data: { linkedObjectId: objectId },
      }),
    ]);

    return NextResponse.json({
      linked: true,
      sourceId: objectId,
      targetId: body.targetObjectId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to link objects",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
