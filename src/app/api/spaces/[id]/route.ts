import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    const space = await prisma.space.findUnique({
      where: { id },
      include: {
        template: { select: { key: true, name: true, assetsPath: true } },
        owner: { select: { id: true, name: true, image: true } },
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

    return NextResponse.json({
      ...space,
      myRole: space.members[0]?.role || null,
      members: undefined,
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

    const updated = await prisma.space.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update space",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
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
    const space = await prisma.space.findUnique({ where: { id } });

    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }
    if (space.ownerId !== session.user.id && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.space.update({
      where: { id },
      data: { status: "ARCHIVED", deletedAt: new Date() },
    });

    return NextResponse.json({ message: "Space archived" });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete space",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
