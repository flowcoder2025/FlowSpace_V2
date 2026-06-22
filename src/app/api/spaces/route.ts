import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildCursorPage, parsePageLimit } from "@/lib/pagination";
import { internalErrorResponse } from "@/lib/api-error";

/**
 * GET /api/spaces - 내 공간 목록 (슈퍼어드민의 "전체"는 모든 ACTIVE 스페이스).
 * cursor 페이지네이션: `?limit=`(기본 50·최대 100) + `?cursor=`(직전 페이지 마지막 id).
 * 응답: `{ spaces, nextCursor, hasMore }` (기존 `spaces` 필드 유지 = 하위호환).
 */
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

    const limit = parsePageLimit(request.nextUrl.searchParams.get("limit"));
    const cursor = request.nextUrl.searchParams.get("cursor");

    const rows = await prisma.space.findMany({
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
      // updatedAt은 가변·비유니크 → id 타이브레이커로 동일 시각 내 결정적 순서 보장
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const { items, nextCursor, hasMore } = buildCursorPage(rows, limit);

    const result = items.map((s) => ({
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

    return NextResponse.json({ spaces: result, nextCursor, hasMore });
  } catch (error) {
    return internalErrorResponse("GET /api/spaces", error, "Failed to fetch spaces");
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
        { error: "Only superAdmin can create spaces", code: "SUPER_ADMIN_REQUIRED" },
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
      // 응답 select — accessSecret/inviteCode 등 민감 Space 스칼라를 애초에 fetch하지 않음
      // (app.md 서버 불변식 #2 "필요한 필드만").
      select: {
        id: true,
        name: true,
        template: { select: { key: true, name: true } },
      },
    });

    // 응답 allowlist — inviteCode 등 민감/내부 필드 미반환(GET 목록·상세 정책과 정합).
    // 클라이언트(create-space-form)는 본문을 쓰지 않고 /my-spaces로 이동만 한다.
    return NextResponse.json(
      {
        id: space.id,
        name: space.name,
        template: space.template,
      },
      { status: 201 }
    );
  } catch (error) {
    return internalErrorResponse("POST /api/spaces", error, "Failed to create space");
  }
}
