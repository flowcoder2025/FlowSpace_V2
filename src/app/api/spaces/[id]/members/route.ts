import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canActOn,
  isChatRestriction,
  isSpaceRole,
} from "@/lib/space-role";
import type { SpaceRole } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/spaces/[id]/members - 멤버 목록 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // 멤버 목록은 해당 공간 멤버(또는 superAdmin)에게만 노출
    const isSuperAdmin = session.user.isSuperAdmin === true;
    if (!isSuperAdmin) {
      const myMember = await prisma.spaceMember.findUnique({
        where: { spaceId_userId: { spaceId: id, userId: session.user.id } },
        select: { id: true },
      });
      if (!myMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const members = await prisma.spaceMember.findMany({
      where: { spaceId: id },
      include: {
        // email/avatarConfig 등 PII·관리 식별자 미노출 (공개 표시용 필드만)
        user: { select: { id: true, name: true, image: true } },
        guestSession: { select: { nickname: true, avatar: true } },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });

    const result = members.map((m) => ({
      id: m.id,
      role: m.role,
      restriction: m.restriction,
      displayName: m.displayName || m.user?.name || m.guestSession?.nickname || "Unknown",
      user: m.user,
      guest: m.guestSession,
      joinedAt: m.createdAt,
    }));

    return NextResponse.json({ members: result });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch members",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/** POST /api/spaces/[id]/members - 공간 참여 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json()) as { accessSecret?: string };

    const space = await prisma.space.findUnique({ where: { id } });
    if (!space || space.status !== "ACTIVE") {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    // 접근 제어
    if (space.accessType === "PRIVATE") {
      return NextResponse.json(
        { error: "This space is private" },
        { status: 403 }
      );
    }

    if (space.accessType === "PASSWORD") {
      if (!body.accessSecret || body.accessSecret !== space.accessSecret) {
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 403 }
        );
      }
    }

    // 이미 멤버인지 확인
    const existing = await prisma.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId: id, userId: session.user.id } },
    });

    if (existing) {
      return NextResponse.json({ message: "Already a member", role: existing.role });
    }

    // 인원 제한
    const count = await prisma.spaceMember.count({ where: { spaceId: id } });
    if (count >= space.maxUsers) {
      return NextResponse.json(
        { error: "Space is full" },
        { status: 409 }
      );
    }

    const member = await prisma.spaceMember.create({
      data: {
        spaceId: id,
        userId: session.user.id,
        displayName: session.user.name,
        role: "PARTICIPANT",
      },
    });

    return NextResponse.json(
      { id: member.id, role: member.role },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to join space",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/** PATCH /api/spaces/[id]/members - 멤버 역할/제한 변경 (OWNER/STAFF only) */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const isSuperAdmin = session.user.isSuperAdmin === true;
    const body = (await request.json()) as {
      memberId: string;
      role?: string;
      restriction?: string;
      restrictedReason?: string;
    };

    if (!body.memberId) {
      return NextResponse.json(
        { error: "memberId is required" },
        { status: 400 }
      );
    }

    // 호출자 권한 확인 (OWNER/STAFF 또는 superAdmin)
    const myMember = await prisma.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId: id, userId: session.user.id } },
    });

    if (!isSuperAdmin && (!myMember || (myMember.role !== "OWNER" && myMember.role !== "STAFF"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actorRole = (myMember?.role ?? "OWNER") as SpaceRole;

    // enum allowlist 검증 (임의 값 주입 차단)
    if (body.role !== undefined && !isSpaceRole(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (body.restriction !== undefined && !isChatRestriction(body.restriction)) {
      return NextResponse.json({ error: "Invalid restriction" }, { status: 400 });
    }

    // 대상 멤버가 이 공간 소속인지 검증 (cross-space IDOR 차단)
    const target = await prisma.spaceMember.findUnique({
      where: { id: body.memberId },
      select: { id: true, spaceId: true, role: true },
    });
    if (!target || target.spaceId !== id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // 역할 계층: 호출자 역할이 대상보다 상위일 때만 제재/변경 가능
    if (!canActOn(actorRole, target.role, isSuperAdmin)) {
      return NextResponse.json(
        { error: "Cannot modify a member of equal or higher role" },
        { status: 403 }
      );
    }

    const data: Record<string, unknown> = {};
    if (body.role !== undefined) {
      const desiredRole = body.role as SpaceRole;
      // 부여하려는 역할도 호출자보다 하위여야 함 (OWNER 부여는 superAdmin만)
      if (!canActOn(actorRole, desiredRole, isSuperAdmin)) {
        return NextResponse.json(
          { error: "Cannot assign a role equal to or higher than your own" },
          { status: 403 }
        );
      }
      data.role = desiredRole;
    }
    if (body.restriction !== undefined) {
      data.restriction = body.restriction;
      data.restrictedBy = session.user.id;
      data.restrictedReason = body.restrictedReason || null;
    }

    // 응답 allowlist — restrictedBy/restrictedReason/restrictedUntil 등 관리 메타와
    // userId/guestSessionId 식별자 미반환 (GET 멤버 매핑 정책과 정합).
    const updated = await prisma.spaceMember.update({
      where: { id: target.id },
      data,
      select: { id: true, role: true, restriction: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update member",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
