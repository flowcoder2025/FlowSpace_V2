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
import { SpaceSettingsForm } from "@/components/dashboard/space-settings-form";

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

/** 반환 트리를 재귀 탐색해 주어진 type의 element를 찾는다(중첩된 SpaceSettingsForm 등). */
function findElement(
  node: unknown,
  type: unknown
): { props?: Record<string, unknown> } | null {
  if (!node || typeof node !== "object") return null;
  const n = node as { type?: unknown; props?: { children?: unknown } };
  if (n.type === type) return n as { props?: Record<string, unknown> };
  const children = n.props?.children;
  const arr = (Array.isArray(children) ? children : [children]).flat(Infinity);
  for (const c of arr) {
    const found = findElement(c, type);
    if (found) return found;
  }
  return null;
}

/** SpaceSettingsForm 에 전달된 canEdit prop(=PATCH 게이트 미러)을 추출. */
async function settingsCanEdit(): Promise<unknown> {
  const formEl = findElement(await call(), SpaceSettingsForm);
  return formEl?.props?.canEdit;
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

// WI-041: 편집 게이팅 — SpaceSettingsForm canEdit = PATCH /api/spaces/[id] 게이트 미러.
// 삭제 게이트와 표현식은 같지만(owner||superAdmin) 의미상 별도 게이트라 독립 검증한다.
describe("SettingsPage 편집 게이팅(canEdit)", () => {
  it("실소유자(ownerId===userId) → canEdit=true", async () => {
    mockRequireSpaceAdmin.mockResolvedValue({
      userId: OWNER_ID,
      spaceId: SPACE_ID,
      role: "OWNER",
      isSuperAdmin: false,
    });
    expect(await settingsCanEdit()).toBe(true);
  });

  it("superAdmin(소유자 아님) → canEdit=true", async () => {
    mockRequireSpaceAdmin.mockResolvedValue({
      userId: "u-super",
      spaceId: SPACE_ID,
      role: "OWNER",
      isSuperAdmin: true,
    });
    expect(await settingsCanEdit()).toBe(true);
  });

  it("STAFF → canEdit=false(읽기전용)", async () => {
    mockRequireSpaceAdmin.mockResolvedValue({
      userId: "u-staff",
      spaceId: SPACE_ID,
      role: "STAFF",
      isSuperAdmin: false,
    });
    expect(await settingsCanEdit()).toBe(false);
  });

  it("role==='OWNER'이나 ownerId 불일치·비-superAdmin → canEdit=false(ownerId 미러, role 아님)", async () => {
    // 데이터 드리프트: SpaceMember.role=OWNER 이지만 Space.ownerId는 다른 사용자.
    // PATCH는 ownerId로 403 → 편집 UI도 ownerId 기준으로 막아야 일관.
    mockRequireSpaceAdmin.mockResolvedValue({
      userId: "u-other",
      spaceId: SPACE_ID,
      role: "OWNER",
      isSuperAdmin: false,
    });
    expect(await settingsCanEdit()).toBe(false);
  });
});
