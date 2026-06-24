import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { MessageType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildCursorPage, parsePageLimit } from "@/lib/pagination";
import { normalizeEnumFilter, parseDateRangeFilter } from "@/lib/query-filter";
import { internalErrorResponse } from "@/lib/api-error";
import { enforceAdminReadable } from "@/lib/space-status-policy";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** 메시지 타입 필터 allowlist (Prisma 런타임 enum) */
const MESSAGE_TYPE_VALUES = new Set<string>(Object.values(MessageType));

export async function GET(request: Request, { params }: RouteParams) {
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
    // 비-ACTIVE 스페이스의 관리 조회는 superAdmin(감사)만 허용, 일반 OWNER/STAFF 차단(WI-046).
    const readGate = await enforceAdminReadable(spaceId, session.user.isSuperAdmin === true);
    if (readGate) return readGate;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = parsePageLimit(searchParams.get("limit"));

    // 고급 필터(WI-030): 타입 enum + 날짜 범위. 잘못된 값은 400(무시 시 의도보다
    // 넓은 결과 노출). where가 cursor보다 항상 적용돼 권한 밖 row 노출 불가(WI-010).
    const type = normalizeEnumFilter(
      searchParams.getAll("type"),
      MESSAGE_TYPE_VALUES
    );
    const dateRange = parseDateRangeFilter(
      searchParams.get("startDate"),
      searchParams.get("endDate")
    );
    if (type === null || dateRange === "invalid") {
      return NextResponse.json(
        { error: "Invalid filter", code: "INVALID_FILTER" },
        { status: 400 }
      );
    }

    const where: Prisma.ChatMessageWhereInput = { spaceId };
    if (type) where.type = type as MessageType;
    if (dateRange) where.createdAt = dateRange;

    const messages = await prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    // 응답 계약 보존: admin 라우트는 { messages, nextCursor }만 반환(hasMore 미노출, WI-012-2 S5/D5).
    const { items, nextCursor } = buildCursorPage(messages, limit);

    return NextResponse.json({ messages: items, nextCursor });
  } catch (error) {
    return internalErrorResponse("GET /api/spaces/[id]/admin/messages", error, "Failed to fetch messages");
  }
}
