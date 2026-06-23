import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { internalErrorResponse } from "@/lib/api-error";
import { dispatchEnforcement } from "@/features/space/enforce";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/spaces/[id] - 공간 상세 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    // select allowlist — accessSecret/inviteCode/ownerId 등 비공개 필드 미반환.
    // ownerId는 접근 게이트 판단용으로만 조회 후 응답에서 제외한다.
    const space = await prisma.space.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        accessType: true,
        maxUsers: true,
        status: true,
        logoUrl: true,
        primaryColor: true,
        loadingMessage: true,
        createdAt: true,
        ownerId: true,
        template: { select: { key: true, name: true, assetsPath: true } },
        owner: { select: { name: true, image: true } },
        _count: { select: { members: true, chatMessages: true } },
        members: {
          where: { userId: session.user.id },
          select: { role: true },
          take: 1,
        },
      },
    });

    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    // 비공개(PRIVATE/PASSWORD) 공간은 멤버/오너/superAdmin에게만 노출
    const isMember = space.members.length > 0;
    const isOwner = space.ownerId === session.user.id;
    const isSuperAdmin = session.user.isSuperAdmin === true;
    if (space.accessType !== "PUBLIC" && !isMember && !isOwner && !isSuperAdmin) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: space.id,
      name: space.name,
      description: space.description,
      accessType: space.accessType,
      maxUsers: space.maxUsers,
      status: space.status,
      logoUrl: space.logoUrl,
      primaryColor: space.primaryColor,
      loadingMessage: space.loadingMessage,
      createdAt: space.createdAt,
      template: space.template,
      owner: space.owner,
      _count: space._count,
      myRole: space.members[0]?.role || null,
    });
  } catch (error) {
    return internalErrorResponse("GET /api/spaces/[id]", error, "Failed to fetch space");
  }
}

/** PATCH /api/spaces/[id] - 공간 수정 (OWNER only) */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const space = await prisma.space.findUnique({ where: { id } });

    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }
    if (space.ownerId !== session.user.id && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as {
      name?: string;
      description?: string;
      accessType?: string;
      accessSecret?: string;
      maxUsers?: number;
      logoUrl?: string;
      primaryColor?: string;
      loadingMessage?: string;
    };

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.accessType !== undefined) data.accessType = body.accessType;
    if (body.accessSecret !== undefined) data.accessSecret = body.accessSecret;
    if (body.maxUsers !== undefined) data.maxUsers = body.maxUsers;
    if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl;
    if (body.primaryColor !== undefined) data.primaryColor = body.primaryColor;
    if (body.loadingMessage !== undefined) data.loadingMessage = body.loadingMessage;

    // 응답 allowlist — accessSecret/inviteCode/ownerId/mapData 등 비공개 필드 미반환
    // (GET /api/spaces/[id] 상세 응답과 동일한 select 정책).
    const updated = await prisma.space.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        description: true,
        accessType: true,
        maxUsers: true,
        status: true,
        logoUrl: true,
        primaryColor: true,
        loadingMessage: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return internalErrorResponse("PATCH /api/spaces/[id]", error, "Failed to update space");
  }
}

/** DELETE /api/spaces/[id] - 공간 삭제 (soft delete, OWNER only) */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const space = await prisma.space.findUnique({
      where: { id },
      select: { id: true, ownerId: true },
    });

    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }
    if (space.ownerId !== session.user.id && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 최초 archive 행위자 보존(WI-036): status!=ARCHIVED 조건부 원자적 갱신.
    // 동시 DELETE/재삭제에도 최초 deletedBy/deletedAt 가 덮어쓰이지 않는다(감사 무결성).
    // count===0 이면 이미 archived → 기존 행위자 보존(멱등).
    await prisma.space.updateMany({
      where: { id, status: { not: "ARCHIVED" } },
      data: { status: "ARCHIVED", deletedAt: new Date(), deletedBy: session.user.id },
    });

    // 접속 중인 모든 사용자 실시간 추방(best-effort). 이미 archived 든 방금이든,
    // 살아있는 소켓이 있으면 끊는다(소켓 서버가 postcondition=status===ARCHIVED 재확인).
    const enforced = await dispatchEnforcement({
      spaceId: id,
      action: "archive",
      actorName: session.user.name ?? undefined,
    });

    return NextResponse.json({ message: "Space archived", realtimeEnforced: enforced.enforced });
  } catch (error) {
    return internalErrorResponse("DELETE /api/spaces/[id]", error, "Failed to delete space");
  }
}
