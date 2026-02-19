import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
    if (target.role === "OWNER" && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Cannot modify the space owner" }, { status: 403 });
    }

    let updatedRestriction: ChatRestriction | undefined;
    let updatedRole: SpaceRole | undefined;
    const actionLabel = action;

    switch (action) {
      case "changeRole":
        if (!role) {
          return NextResponse.json({ error: "role is required for changeRole" }, { status: 400 });
        }
        updatedRole = role;
        break;
      case "mute":
        updatedRestriction = "MUTED";
        break;
      case "unmute":
        updatedRestriction = "NONE";
        break;
      case "ban":
        updatedRestriction = "BANNED";
        break;
      case "kick":
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
        return NextResponse.json({ message: "Member kicked" });
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

    return NextResponse.json({ member: updated });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update member", details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
