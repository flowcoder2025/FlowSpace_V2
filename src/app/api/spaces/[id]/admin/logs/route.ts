import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { SpaceEventType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildCursorPage, parsePageLimit } from "@/lib/pagination";
import { normalizeEnumFilter, parseDateRangeFilter } from "@/lib/query-filter";
import { internalErrorResponse } from "@/lib/api-error";
import { enforceAdminReadable } from "@/lib/space-status-policy";
import { toPublicSpaceEventLog } from "@/lib/space-event-log-payload";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** 이벤트 타입 필터 allowlist (Prisma 런타임 enum) */
const EVENT_TYPE_VALUES = new Set<string>(Object.values(SpaceEventType));

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

    // 고급 필터(WI-030): eventType enum(기존 미검증→전수 검증 보강) + 날짜 범위.
    // 잘못된 값은 400(무시 시 의도보다 넓은 결과 노출). where가 cursor보다 우선 적용.
    const eventType = normalizeEnumFilter(
      searchParams.getAll("eventType"),
      EVENT_TYPE_VALUES
    );
    const dateRange = parseDateRangeFilter(
      searchParams.get("startDate"),
      searchParams.get("endDate")
    );
    if (eventType === null || dateRange === "invalid") {
      return NextResponse.json(
        { error: "Invalid filter", code: "INVALID_FILTER" },
        { status: 400 }
      );
    }

    const where: Prisma.SpaceEventLogWhereInput = { spaceId };
    if (eventType) where.eventType = eventType as SpaceEventType;
    if (dateRange) where.createdAt = dateRange;

    const logs = await prisma.spaceEventLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    // 응답 계약 보존: { logs, nextCursor }만 반환(buildCursorPage로 messages와 통일).
    // payload는 키 allowlist로 정규화하고 행은 lean DTO로 축소한다(WI-032). 차단은 응답
    // DTO 계층에서 한다(화면/CSV만 필터하면 raw 직접 호출로 우회) — SpaceEventLog 행을
    // 반환하는 모든 API(여기 + admin/stats recentActivity)에 동일 정규화를 적용한다.
    const { items, nextCursor } = buildCursorPage(logs, limit);

    return NextResponse.json({ logs: items.map(toPublicSpaceEventLog), nextCursor });
  } catch (error) {
    return internalErrorResponse("GET /api/spaces/[id]/admin/logs", error, "Failed to fetch logs");
  }
}
