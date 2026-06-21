/**
 * API 라우트 테스트 하니스 — 순수 빌더 (WI-011)
 *
 * Next.js Route Handler(GET/POST 등)를 vitest에서 직접 호출하기 위한 공용 유틸.
 * 이 파일은 mock wiring을 하지 않고 요청 생성 · 세션/행 fixture · 응답 파싱만 제공한다.
 * (auth()/prisma 교체는 vitest의 vi.hoisted + vi.mock 호이스팅이 파일 로컬이라
 *  각 라우트 테스트 파일 상단에서 직접 선언해야 한다 — 중앙화 불가.)
 *
 * 테스트 파일 프리앰블 패턴 (라우트 import 전에 선언):
 *   const { mockAuth, mockPrisma } = vi.hoisted(() => ({
 *     mockAuth: vi.fn(),
 *     mockPrisma: { space: { findMany: vi.fn() } },
 *   }));
 *   vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
 *   vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
 */
import { NextRequest } from "next/server";

const TEST_ORIGIN = "http://localhost";

export interface MockSessionUser {
  id: string;
  isSuperAdmin?: boolean;
  name?: string | null;
  email?: string | null;
}

export type MockSession = { user: MockSessionUser } | null;

/** auth()가 반환할 세션 객체(또는 미인증 null)를 만든다. */
export function makeSession(user: MockSessionUser | null): MockSession {
  return user ? { user } : null;
}

/** 쿼리 파라미터를 붙인 GET용 NextRequest를 만든다. */
export function buildGetRequest(
  path: string,
  params?: Record<string, string>
): NextRequest {
  const url = new URL(path, TEST_ORIGIN);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return new NextRequest(url);
}

/** JSON body가 있는 요청(POST/PATCH 등)용 NextRequest를 만든다. */
export function buildJsonRequest(
  path: string,
  method: string,
  body: unknown
): NextRequest {
  return new NextRequest(new URL(path, TEST_ORIGIN), {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** makeSpaceRow 오버라이드 (자주 바꾸는 필드만 노출) */
export interface SpaceRowOverrides {
  id?: string;
  name?: string;
  /** 호출자 본인 멤버십 역할. null이면 비멤버(members: []) */
  role?: string | null;
  memberCount?: number;
  status?: string;
}

/**
 * prisma.space.findMany가 반환하는 행 형태의 fixture.
 * route의 include({ template, _count, members })를 반영하며,
 * 응답 allowlist 회귀를 위해 "응답에 노출되면 안 되는" 민감/내부 필드
 * (inviteCode/accessSecret/ownerId)도 의도적으로 포함한다.
 */
export function makeSpaceRow(overrides: SpaceRowOverrides = {}) {
  const {
    id = "space-1",
    name = "테스트 공간",
    role = "MEMBER",
    memberCount = 3,
    status = "ACTIVE",
  } = overrides;

  return {
    id,
    name,
    description: "설명",
    accessType: "PUBLIC",
    maxUsers: 50,
    logoUrl: null,
    primaryColor: "#000000",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    status,
    templateId: "tpl-1",
    // 응답 allowlist에서 제외되어야 하는 민감/내부 필드 (회귀 가드)
    ownerId: "owner-1",
    inviteCode: "SECRET-INVITE",
    accessSecret: "hashed-secret",
    template: { key: "OFFICE", name: "오피스" },
    _count: { members: memberCount },
    members: role === null ? [] : [{ role }],
  };
}

/** Response의 JSON body를 타입과 함께 읽는다. */
export async function readJson<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
