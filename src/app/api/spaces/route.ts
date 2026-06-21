import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET /api/spaces - 내 공간 목록 (슈퍼어드민의 "전체"는 모든 ACTIVE 스페이스) */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const isSuperAdmin = session.user.isSuperAdmin === true;
    const filter = request.nextUrl.searchParams.get("filter"); // "owned" | "joined" | "all" | null

    const memberScope: Prisma.SpaceWhereInput = {
      members: { some: { userId } },
    };

    let scope: Prisma.SpaceWhereInput;
    if (filter === "owned") {
      scope = { ownerId: userId };
    } else if (filter === "joined") {
      scope = memberScope;
    } else if (filter === null || filter === "all") {
      // 슈퍼어드민의 "전체"만 전역(모든 ACTIVE), 일반 사용자는 본인 멤버십 스페이스
      scope = isSuperAdmin ? {} : memberScope;
    } else {
      return NextResponse.json(
        { error: "Invalid filter", code: "INVALID_FILTER" },
        { status: 400 }
      );
    }

    const spaces = await prisma.space.findMany({
      where: { ...scope, status: "ACTIVE" },
      include: {
        template: { select: { key: true, name: true } },
        _count: { select: { members: true } },
        members: {
          where: { userId },
          select: { role: true },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const result = spaces.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      accessType: s.accessType,
      template: s.template,
      maxUsers: s.maxUsers,
      memberCount: s._count.members,
      myRole: s.members[0]?.role || null,
      logoUrl: s.logoUrl,
      primaryColor: s.primaryColor,
      createdAt: s.createdAt,
    }));

    return NextResponse.json({ spaces: result });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch spaces",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/** POST /api/spaces - 공간 생성 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 공간 생성은 슈퍼어드민만 허용 (생성된 공간의 OWNER 권한은 이후 멤버 PATCH로 위임)
    if (session.user.isSuperAdmin !== true) {
      return NextResponse.json(
        { error: "Only superAdmin can create spaces" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      name?: string;
      description?: string;
      templateKey?: string;
      accessType?: string;
      accessSecret?: string;
      maxUsers?: number;
    };

    if (!body.name || !body.templateKey) {
      return NextResponse.json(
        { error: "name, templateKey are required" },
        { status: 400 }
      );
    }

    const template = await prisma.template.findUnique({
      where: { key: body.templateKey as "OFFICE" | "CLASSROOM" | "LOUNGE" },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    const space = await prisma.space.create({
      data: {
        name: body.name,
        description: body.description || null,
        ownerId: session.user.id,
        templateId: template.id,
        accessType: (body.accessType as "PUBLIC" | "PRIVATE" | "PASSWORD") || "PUBLIC",
        accessSecret: body.accessSecret || null,
        maxUsers: body.maxUsers || 50,
        members: {
          create: {
            userId: session.user.id,
            displayName: session.user.name,
            role: "OWNER",
          },
        },
      },
      include: {
        template: { select: { key: true, name: true } },
      },
    });

    return NextResponse.json(
      {
        id: space.id,
        name: space.name,
        inviteCode: space.inviteCode,
        template: space.template,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create space",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
