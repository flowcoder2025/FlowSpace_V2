import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ inviteCode: string }>;
}

/** GET /api/spaces/join/[inviteCode] - 초대 코드로 공간 정보 조회 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { inviteCode } = await params;

    const space = await prisma.space.findUnique({
      where: { inviteCode },
      select: {
        id: true,
        name: true,
        description: true,
        accessType: true,
        maxUsers: true,
        template: { select: { key: true, name: true } },
        _count: { select: { members: true } },
      },
    });

    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...space,
      memberCount: space._count.members,
      _count: undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch space",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/** POST /api/spaces/join/[inviteCode] - 초대 코드로 참여 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { inviteCode } = await params;
    const body = (await request.json()) as { accessSecret?: string };

    const space = await prisma.space.findUnique({
      where: { inviteCode },
    });

    if (!space || space.status !== "ACTIVE") {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    if (space.accessType === "PASSWORD") {
      if (!body.accessSecret || body.accessSecret !== space.accessSecret) {
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 403 }
        );
      }
    }

    const existing = await prisma.spaceMember.findUnique({
      where: {
        spaceId_userId: { spaceId: space.id, userId: session.user.id },
      },
    });

    if (existing) {
      return NextResponse.json({ spaceId: space.id, message: "Already a member" });
    }

    const count = await prisma.spaceMember.count({
      where: { spaceId: space.id },
    });
    if (count >= space.maxUsers) {
      return NextResponse.json({ error: "Space is full" }, { status: 409 });
    }

    await prisma.spaceMember.create({
      data: {
        spaceId: space.id,
        userId: session.user.id,
        displayName: session.user.name,
        role: "PARTICIPANT",
      },
    });

    return NextResponse.json(
      { spaceId: space.id, message: "Joined successfully" },
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
