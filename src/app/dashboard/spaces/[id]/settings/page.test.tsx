import { describe, it, expect, beforeEach, vi } from "vitest";

// ============================================================
// WI-037: 설정 페이지 삭제 게이팅 — canDelete = isSuperAdmin || ownerId===userId
// (DELETE /api/spaces/[id] 게이트의 정확한 미러. STAFF·비소유자는 미노출)
// 서버 컴포넌트라 함수를 직접 호출해 반환 element 트리를 검사한다(space/[id]/page.test 패턴).
// ============================================================

const { mockRequireSpaceAdmin, mockPrisma } = vi.hoisted(() => ({
  mockRequireSpaceAdmin: vi.fn(),
  mockPrisma: { space: { findUnique: vi.fn() } },
}));

vi.mock("@/lib/admin-guard", () => ({ requireSpaceAdmin: mockRequireSpaceAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/components/dashboard/space-settings-form", () => ({
  SpaceSettingsForm: () => null,
}));
vi.mock("@/components/dashboard/delete-space-section", () => ({
  DeleteSpaceSection: () => null,
}));

import SettingsPage from "./page";
import { DeleteSpaceSection } from "@/components/dashboard/delete-space-section";

const SPACE_ID = "space-1";
const OWNER_ID = "u-owner";

const call = () => SettingsPage({ params: Promise.resolve({ id: SPACE_ID }) });

/** 반환 트리에서 DeleteSpaceSection element 가 렌더되었는지(=canDelete) 검사. */
function hasDeleteSection(el: unknown): boolean {
  const root = el as { props?: { children?: unknown } } | null;
  const children = root?.props?.children;
  const arr = (Array.isArray(children) ? children : [children]).flat(Infinity);
  return arr.some(
    (c) => !!c && typeof c === "object" && (c as { type?: unknown }).type === DeleteSpaceSection
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.space.findUnique.mockResolvedValue({
    name: "마케팅 본부",
    description: null,
    maxUsers: 50,
    accessType: "PUBLIC",
    primaryColor: "#3b82f6",
    loadingMessage: null,
    ownerId: OWNER_ID,
  });
});

describe("SettingsPage 삭제 게이팅", () => {
  it("실소유자(ownerId===userId) → 삭제 섹션 노출", async () => {
    mockRequireSpaceAdmin.mockResolvedValue({
      userId: OWNER_ID,
      spaceId: SPACE_ID,
      role: "OWNER",
      isSuperAdmin: false,
    });
    expect(hasDeleteSection(await call())).toBe(true);
  });

  it("superAdmin(소유자 아님) → 삭제 섹션 노출", async () => {
    mockRequireSpaceAdmin.mockResolvedValue({
      userId: "u-super",
      spaceId: SPACE_ID,
      role: "OWNER", // admin-guard가 superAdmin엔 role:"OWNER" 반환
      isSuperAdmin: true,
    });
    expect(hasDeleteSection(await call())).toBe(true);
  });

  it("STAFF → 삭제 섹션 미노출", async () => {
    mockRequireSpaceAdmin.mockResolvedValue({
      userId: "u-staff",
      spaceId: SPACE_ID,
      role: "STAFF",
      isSuperAdmin: false,
    });
    expect(hasDeleteSection(await call())).toBe(false);
  });

  it("role==='OWNER'이나 ownerId 불일치·비-superAdmin → 미노출(ownerId 미러, role 아님)", async () => {
    // 데이터 드리프트: SpaceMember.role=OWNER 이지만 Space.ownerId는 다른 사용자.
    // DELETE API는 ownerId로 403 → 삭제 UI도 ownerId 기준으로 숨겨야 일관.
    mockRequireSpaceAdmin.mockResolvedValue({
      userId: "u-other",
      spaceId: SPACE_ID,
      role: "OWNER",
      isSuperAdmin: false,
    });
    expect(hasDeleteSection(await call())).toBe(false);
  });

  it("스페이스 없음 → notFound 메시지(크래시 없음)", async () => {
    mockRequireSpaceAdmin.mockResolvedValue({
      userId: OWNER_ID,
      spaceId: SPACE_ID,
      role: "OWNER",
      isSuperAdmin: false,
    });
    mockPrisma.space.findUnique.mockResolvedValue(null);
    const el = await call();
    // 삭제 섹션 없음 + 에러 div 반환
    expect(hasDeleteSection(el)).toBe(false);
  });

  it("findUnique select에 ownerId 포함(게이트 판단용)", async () => {
    mockRequireSpaceAdmin.mockResolvedValue({
      userId: OWNER_ID,
      spaceId: SPACE_ID,
      role: "OWNER",
      isSuperAdmin: false,
    });
    await call();
    const arg = mockPrisma.space.findUnique.mock.calls[0][0] as {
      select: Record<string, boolean>;
    };
    expect(arg.select.ownerId).toBe(true);
  });
});
