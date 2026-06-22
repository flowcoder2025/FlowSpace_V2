import { NextRequest, NextResponse } from "next/server";
import { AssetType, AssetStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePageLimit, parsePageNumber } from "@/lib/pagination";
import { internalErrorResponse } from "@/lib/api-error";
import { toPublicAssetListItem } from "@/features/assets";

/** limit 미지정 시 기본 페이지 크기 (WI-022 이전 동작 보존). */
const ASSETS_DEFAULT_LIMIT = 20;
/**
 * 필터 enum allowlist — Prisma 런타임 enum에서 도출(하드코딩 배열 회피, enum
 * 추가 시 자동 동기화). 값은 모두 대문자라 입력을 정규화(trim+대문자)한 뒤 검증한다.
 */
const ASSET_TYPE_VALUES = new Set<string>(Object.values(AssetType));
const ASSET_STATUS_VALUES = new Set<string>(Object.values(AssetStatus));

/**
 * 쿼리 enum 필터를 정규화(trim+대문자)·검증한다.
 * 중복 파라미터(`?type=a&type=b`)의 검증 우회를 막기 위해 `getAll()`로 받은
 * **모든 값**을 검사한다 (`get()`은 첫 값만 봐 invalid 2번째 값이 숨는다).
 * - 빈 배열/공백-only만 → undefined (필터 미적용; trim 후 비면 "미지정"과 동일)
 * - 하나라도 allowlist 불일치 → null (호출부가 400 INVALID_FILTER로 처리)
 * - 전부 유효 → 첫 값(Prisma scalar equality)으로 필터
 */
function normalizeEnumFilter(
  values: string[],
  allowed: Set<string>
): string | undefined | null {
  const normalized = values
    .map((v) => v.trim().toUpperCase())
    .filter((v) => v.length > 0);
  if (normalized.length === 0) return undefined;
  if (normalized.some((v) => !allowed.has(v))) return null;
  return normalized[0];
}

/** GET /api/assets - 에셋 목록 (필터링) */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const shared = searchParams.get("shared");

    // 입력 검증(WI-022): type/status를 AssetType/AssetStatus allowlist로 검증.
    // 잘못된 enum은 조용히 무시(전체 목록 응답)하지 않고 400으로 거절(WI-009 정합).
    // getAll로 중복 파라미터까지 전수 검증(중복값 검증 우회 차단, codex r2).
    const type = normalizeEnumFilter(
      searchParams.getAll("type"),
      ASSET_TYPE_VALUES
    );
    const status = normalizeEnumFilter(
      searchParams.getAll("status"),
      ASSET_STATUS_VALUES
    );
    if (type === null || status === null) {
      return NextResponse.json(
        { error: "Invalid asset filter", code: "INVALID_FILTER" },
        { status: 400 }
      );
    }

    // page/limit 정규화(WI-022): NaN/0/음수 → 음수 skip(500) 방지, limit 상한 100.
    const page = parsePageNumber(searchParams.get("page"));
    const limit = parsePageLimit(searchParams.get("limit"), ASSETS_DEFAULT_LIMIT);

    const where: Record<string, unknown> = {};

    if (shared === "true") {
      // 공용 에셋 조회 (아바타 선택 등)
      where.isShared = true;
    } else {
      // 본인 에셋만 조회 (IDOR 방지)
      where.userId = session.user.id;
    }

    if (type) {
      where.type = type;
    }
    if (status) {
      where.status = status;
    }

    // 응답 allowlist (WI-021): 목록은 lean DTO만 반환한다.
    // shared=true 분기는 owner 게이트 없이 타인 공유 자산을 반환하므로(의도된 공유)
    // prompt/workflow/comfyuiJobId(민감)·metadata·user는 select하지 않고,
    // toPublicAssetListItem로 응답 키 집합을 고정한다(심층 방어).
    const [assets, total] = await Promise.all([
      prisma.generatedAsset.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          type: true,
          name: true,
          status: true,
          filePath: true,
          thumbnailPath: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.generatedAsset.count({ where }),
    ]);

    return NextResponse.json({
      assets: assets.map(toPublicAssetListItem),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return internalErrorResponse("GET /api/assets", error, "Failed to fetch assets");
  }
}
