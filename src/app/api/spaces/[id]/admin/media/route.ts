import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { internalErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { enforceAdminReadable, enforceSpaceMutable } from "@/lib/space-status-policy";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET: 스포트라이트 권한 목록 조회 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: spaceId } = await params;

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
    // 비-ACTIVE 스페이스의 관리 조회는 superAdmin(감사)만 허용, 일반 OWNER/STAFF 차단(WI-046).
    const readGate = await enforceAdminReadable(spaceId, session.user.isSuperAdmin === true);
    if (readGate) return readGate;

    const grants = await prisma.spotlightGrant.findMany({
      where: { spaceId },
      orderBy: { createdAt: "desc" },
    });

    // userId 목록으로 유저 정보 조회
    const userIds = grants.map((g) => g.userId).filter(Boolean) as string[];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const enrichedGrants = grants.map((g) => ({
      ...g,
      user: g.userId ? userMap.get(g.userId) ?? null : null,
    }));

    return NextResponse.json({ grants: enrichedGrants });
  } catch (error) {
    return internalErrorResponse("GET /api/spaces/[id]/admin/media", error, "Failed to fetch media data");
  }
}

/** POST: 스포트라이트 권한 부여 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: spaceId } = await params;

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
    // 비-ACTIVE 스페이스(soft-delete 등)는 스포트라이트 권한 부여 불가(superAdmin 포함, WI-046).
    const archivedGate = await enforceSpaceMutable(spaceId);
    if (archivedGate) return archivedGate;

    const body = await request.json();
    const { targetUserId, expiresInMinutes } = body as {
      targetUserId: string;
      expiresInMinutes?: number;
    };

    if (!targetUserId) {
      return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
    }

    // 대상이 해당 공간 멤버인지 확인
    const targetMember = await prisma.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId, userId: targetUserId } },
    });
    if (!targetMember) {
      return NextResponse.json({ error: "Target user is not a member" }, { status: 400 });
    }

    const expiresAt = expiresInMinutes
      ? new Date(Date.now() + expiresInMinutes * 60 * 1000)
      : null;

    const grant = await prisma.spotlightGrant.create({
      data: {
        spaceId,
        userId: targetUserId,
        grantedBy: session.user.id,
        expiresAt,
        isActive: false,
      },
    });

    return NextResponse.json({ grant }, { status: 201 });
  } catch (error) {
    return internalErrorResponse("POST /api/spaces/[id]/admin/media", error, "Failed to create grant");
  }
}
