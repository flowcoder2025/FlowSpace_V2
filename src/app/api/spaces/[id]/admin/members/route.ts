import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canActOn, isSpaceRole } from "@/lib/space-role";
import { dispatchEnforcement, type EnforceAction } from "@/features/space/enforce";
import type { SpaceRole, ChatRestriction } from "@prisma/client";

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

    const members = await prisma.spaceMember.findMany({
      where: { spaceId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        guestSession: { select: { id: true, nickname: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ members });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch members", details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: spaceId } = await params;
    const isSuperAdmin = session.user.isSuperAdmin === true;

    const self = await prisma.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId, userId: session.user.id } },
      select: { role: true },
    });
    if (!self && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (self && self.role !== "OWNER" && self.role !== "STAFF" && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actorRole = (self?.role ?? "OWNER") as SpaceRole;

    const body = await request.json();
    const { memberId, action, role } = body as {
      memberId: string;
      action: "changeRole" | "mute" | "unmute" | "kick" | "ban";
      role?: SpaceRole;
    };

    if (!memberId || !action) {
      return NextResponse.json({ error: "memberId and action are required" }, { status: 400 });
    }

    const target = await prisma.spaceMember.findUnique({
      where: { id: memberId },
      include: { user: { select: { name: true } } },
    });
    if (!target || target.spaceId !== spaceId) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // OWNER는 변경 불가
    if (target.role === "OWNER" && !isSuperAdmin) {
      return NextResponse.json({ error: "Cannot modify the space owner" }, { status: 403 });
    }

    // 역할 계층: 호출자 역할이 대상보다 상위일 때만 제재/변경 가능
    // (STAFF가 동급 STAFF를 ban/kick/mute 하는 것을 차단)
    if (!canActOn(actorRole, target.role, isSuperAdmin)) {
      return NextResponse.json(
        { error: "Cannot modify a member of equal or higher role" },
        { status: 403 }
      );
    }

    let updatedRestriction: ChatRestriction | undefined;
    let updatedRole: SpaceRole | undefined;
    const actionLabel = action;
    const actorName = session.user.name ?? undefined;

    switch (action) {
      case "changeRole": {
        if (!role) {
          return NextResponse.json({ error: "role is required for changeRole" }, { status: 400 });
        }
        // enum allowlist (임의 값 주입 차단)
        if (!isSpaceRole(role)) {
          return NextResponse.json({ error: "Invalid role" }, { status: 400 });
        }
        // OWNER 역할은 superAdmin만 부여 가능
        if (role === "OWNER" && !isSuperAdmin) {
          return NextResponse.json({ error: "Only superAdmin can assign OWNER role" }, { status: 403 });
        }
        // 부여하려는 역할도 호출자보다 하위여야 함 (STAFF→STAFF/OWNER 차단)
        if (!canActOn(actorRole, role, isSuperAdmin)) {
          return NextResponse.json(
            { error: "Cannot assign a role equal to or higher than your own" },
            { status: 403 }
          );
        }
        updatedRole = role;
        break;
      }
      case "mute":
        updatedRestriction = "MUTED";
        break;
      case "unmute":
        updatedRestriction = "NONE";
        break;
      case "ban":
        updatedRestriction = "BANNED";
        break;
      case "kick": {
        // kick은 멤버 삭제
        await prisma.spaceMember.delete({ where: { id: memberId } });
        await prisma.spaceEventLog.create({
          data: {
            spaceId,
            userId: session.user.id,
            eventType: "ADMIN_ACTION",
            payload: { action: "kick", targetName: target.user?.name || target.displayName },
          },
        });
        // 살아있는 소켓 실시간 추방 (DB 삭제 후 best-effort)
        let realtimeEnforced = false;
        if (target.userId) {
          const r = await dispatchEnforcement({
            spaceId,
            userId: target.userId,
            action: "kick",
            actorName,
          });
          realtimeEnforced = r.enforced;
        }
        return NextResponse.json({ message: "Member kicked", realtimeEnforced });
      }
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (updatedRole) updateData.role = updatedRole;
    if (updatedRestriction !== undefined) {
      updateData.restriction = updatedRestriction;
      updateData.restrictedBy = session.user.id;
    }

    const updated = await prisma.spaceMember.update({
      where: { id: memberId },
      data: updateData,
    });

    // 이벤트 로그 기록
    await prisma.spaceEventLog.create({
      data: {
        spaceId,
        userId: session.user.id,
        eventType: "ADMIN_ACTION",
        payload: {
          action: actionLabel,
          targetMemberId: memberId,
          targetName: target.user?.name || target.displayName,
        },
      },
    });

    // 살아있는 소켓에 실시간 반영 (ban/mute/unmute/changeRole). DB 갱신 후 best-effort.
    // changeRole 강등은 권한 회수이므로(인메모리 role 캐시 갱신) 보안상 실시간 반영 필요.
    let realtimeEnforced = false;
    if (target.userId) {
      const enforceAction: EnforceAction = actionLabel === "changeRole" ? "role" : actionLabel;
      const r = await dispatchEnforcement({
        spaceId,
        userId: target.userId,
        action: enforceAction,
        role: actionLabel === "changeRole" ? updatedRole : undefined,
        actorName,
      });
      realtimeEnforced = r.enforced;
    }

    return NextResponse.json({ member: updated, realtimeEnforced });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update member", details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
