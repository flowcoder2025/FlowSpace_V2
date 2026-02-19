import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    const members = await prisma.spaceMember.findMany({
      where: { spaceId: id },
      include: {
        user: { select: { id: true, name: true, email: true, image: true, avatarConfig: true } },
        guestSession: { select: { id: true, nickname: true, avatar: true } },
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

    // 권한 확인
    const myMember = await prisma.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId: id, userId: session.user.id } },
    });

    if (!myMember || !["OWNER", "STAFF"].includes(myMember.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data: Record<string, unknown> = {};
    if (body.role !== undefined) {
      if (myMember.role !== "OWNER") {
        return NextResponse.json(
          { error: "Only OWNER can change roles" },
          { status: 403 }
        );
      }
      data.role = body.role;
    }
    if (body.restriction !== undefined) {
      data.restriction = body.restriction;
      data.restrictedBy = session.user.id;
      data.restrictedReason = body.restrictedReason || null;
    }

    const updated = await prisma.spaceMember.update({
      where: { id: body.memberId },
      data,
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
