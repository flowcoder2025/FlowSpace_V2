/**
 * 스페이스 상태(SpaceStatus) 기반 관리 접근 정책 (WI-046, 순수 서버 유틸).
 *
 * 배경: 스페이스 삭제는 soft-delete다 — `DELETE /api/spaces/[id]`가 `Space.status`를
 * `ARCHIVED`로 바꿀 뿐 `SpaceMember`(OWNER/STAFF 멤버십) 행은 남는다. 따라서 멤버십/owner
 * 기준으로만 인가하는 관리 라우트들은 archived(soft-delete) 후에도 일반 OWNER/STAFF가
 * 직접 호출 가능했다(WI-042 듀얼검증 양측 독립 발견). WI-042는 대시보드 UI 진입만 닫았고
 * API 표면은 잔존했다.
 *
 * 정책(단일 SoT):
 * - 관리 **변경(mutation)**은 `status === ACTIVE`에서만 허용한다 — superAdmin 포함.
 *   (복원/재활성화는 앱에 경로가 없으며, 향후 만든다면 별도 lifecycle API가 된다.)
 * - 관리 **조회(admin GET)**는 일반 OWNER/STAFF에겐 비-ACTIVE에서 차단하고, 감사·복원
 *   판단을 위해 superAdmin에게만 비-ACTIVE 조회를 허용한다(WI-042 layout 정책과 대칭).
 * - 차단 기준은 non-ACTIVE(ARCHIVED + INACTIVE)다. 실 사용상 ARCHIVED만 발생하나
 *   `POST /api/spaces/[id]/members`(입장)의 기존 `status !== "ACTIVE"` 선례와 정합시킨다.
 * - 응답 순서는 `auth → role → status`다 — 비관리자에겐 role 게이트의 403이 먼저 나가
 *   status(archived 여부)가 누설되지 않는다.
 */

import { NextResponse } from "next/server";
import type { SpaceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** 관리 변경(mutation)이 허용되는 스페이스 상태. */
export const SPACE_MUTABLE_STATUSES: readonly SpaceStatus[] = ["ACTIVE"];

/** 차단 응답의 안정적 식별 코드(app.md 불변식 #4: `{ error, code }`). */
export const SPACE_NOT_ACTIVE_CODE = "SPACE_NOT_ACTIVE";

/** 해당 상태의 스페이스가 관리 변경(mutation)을 받을 수 있는지. ACTIVE만 true. */
export function isSpaceMutable(status: SpaceStatus): boolean {
  return SPACE_MUTABLE_STATUSES.includes(status);
}

/**
 * 관리 조회(admin GET)에 접근 가능한지 판정한다.
 * ACTIVE면 누구든(기존 role 게이트 통과 전제) 허용, 비-ACTIVE면 superAdmin만 허용.
 */
export function canAccessInactiveSpaceAdmin(
  status: SpaceStatus,
  isSuperAdmin: boolean
): boolean {
  return isSpaceMutable(status) || isSuperAdmin;
}

/**
 * 비-ACTIVE 스페이스에 대한 관리 접근 차단 응답(403).
 *
 * 403을 쓰는 이유: 이 라우트들은 이미 OWNER/STAFF/superAdmin 인가를 통과한 관리 표면이라
 * 존재 은닉용 404(가입/입장 경로의 선례)는 오히려 관리자에게 혼란스럽다.
 */
export function spaceNotActiveResponse(): NextResponse {
  return NextResponse.json(
    { error: "This space is not active.", code: SPACE_NOT_ACTIVE_CODE },
    { status: 403 }
  );
}

/**
 * 관리 **변경(mutation)** 라우트용 status 게이트.
 *
 * 호출 규약: 반드시 인증(auth)과 role 인가를 **통과한 뒤** 호출한다 — 비관리자에겐
 * role 게이트의 403이 먼저 나가 status(archived 여부)가 누설되지 않게 한다.
 *
 * @returns 차단 시 NextResponse(404 미존재 / 403 비-ACTIVE), 통과 시 `null`.
 */
export async function enforceSpaceMutable(spaceId: string): Promise<NextResponse | null> {
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: { status: true },
  });
  if (!space) {
    return NextResponse.json({ error: "Space not found" }, { status: 404 });
  }
  if (!isSpaceMutable(space.status)) {
    return spaceNotActiveResponse();
  }
  return null;
}

/**
 * 관리 **조회(admin GET)** 라우트용 status 게이트.
 * 비-ACTIVE는 superAdmin에게만 허용(감사·복원 판단), 일반 OWNER/STAFF는 차단.
 *
 * 호출 규약: `enforceSpaceMutable`와 동일하게 role 인가 통과 후 호출한다.
 *
 * @returns 차단 시 NextResponse(404 미존재 / 403 비-ACTIVE·비superAdmin), 통과 시 `null`.
 */
export async function enforceAdminReadable(
  spaceId: string,
  isSuperAdmin: boolean
): Promise<NextResponse | null> {
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: { status: true },
  });
  if (!space) {
    return NextResponse.json({ error: "Space not found" }, { status: 404 });
  }
  if (!canAccessInactiveSpaceAdmin(space.status, isSuperAdmin)) {
    return spaceNotActiveResponse();
  }
  return null;
}
