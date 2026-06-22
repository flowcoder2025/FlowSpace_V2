import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MockInstance } from "vitest";
import { buildJsonRequest, makeSession } from "@/__tests__/helpers/api-route";
import { GENERATION_FAILURE_MESSAGE } from "@/features/assets";

// ============================================
// auth()/prisma/processAssetGeneration mock.
// processAssetGeneration만 stub하고 나머지 배럴(상수 GENERATION_FAILURE_MESSAGE 포함)은
// importOriginal로 실제값 보존 — 상수 드리프트 시 테스트가 함께 깨지도록(자기참조 회피).
// ============================================
const { mockAuth, mockPrisma, mockProcess } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    generatedAsset: { create: vi.fn(), update: vi.fn() },
  },
  mockProcess: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/features/assets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/assets")>();
  return { ...actual, processAssetGeneration: mockProcess };
});

import { POST } from "./route";

/** processAssetGeneration이 실패할 때 던지는 내부 정보(경로/스택/호스트)가 섞인 raw 에러. */
const RAW_ERROR =
  "ComfyUI internal: ENOENT /home/user/comfy/output at http://127.0.0.1:8188\n" +
  "  at processAssetGeneration (/srv/app/src/features/assets/internal/processor.ts:146)";

function makeRequest() {
  return buildJsonRequest("http://localhost/api/assets/generate", "POST", {
    type: "character",
    name: "전사",
    prompt: "a brave warrior",
  });
}

describe("POST /api/assets/generate — 비동기 실패 경로 정보위생 (WI-024)", () => {
  let errSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(makeSession({ id: "user-1" }));
    mockPrisma.generatedAsset.create.mockResolvedValue({ id: "asset-1" });
    mockPrisma.generatedAsset.update.mockResolvedValue({});
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errSpy.mockRestore();
  });

  it("즉시 202를 반환하고(fire-and-forget) 실패 시 raw error.message를 저장하지 않는다", async () => {
    mockProcess.mockRejectedValue(new Error(RAW_ERROR));

    const res = await POST(makeRequest());
    expect(res.status).toBe(202);

    await vi.waitFor(() =>
      expect(mockPrisma.generatedAsset.update).toHaveBeenCalled()
    );

    const arg = mockPrisma.generatedAsset.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "asset-1" });
    expect(arg.data.status).toBe("FAILED");
    // 저장 metadata는 정확히 generic 1키 — raw 사유 미저장.
    expect(arg.data.metadata).toEqual({ error: GENERATION_FAILURE_MESSAGE });

    // 심층 방어: 직렬화한 저장값에 내부 정보 단편이 전혀 없어야 한다(변이 가드).
    const stored = JSON.stringify(arg.data.metadata);
    expect(stored).not.toContain("ENOENT");
    expect(stored).not.toContain("processor.ts");
    expect(stored).not.toContain("127.0.0.1");
  });

  it("raw error는 console.error 서버 로그로만 보존한다 (디버깅 가능성)", async () => {
    mockProcess.mockRejectedValue(new Error(RAW_ERROR));

    await POST(makeRequest());
    await vi.waitFor(() =>
      expect(mockPrisma.generatedAsset.update).toHaveBeenCalled()
    );

    const loggedRaw = errSpy.mock.calls.some((call) =>
      call.some((a) => a instanceof Error && a.message.includes("ENOENT"))
    );
    expect(loggedRaw).toBe(true);
  });

  it("비-Error 거부값(문자열 throw)도 generic으로 정규화한다", async () => {
    mockProcess.mockRejectedValue("raw string failure with /secret/path");

    await POST(makeRequest());
    await vi.waitFor(() =>
      expect(mockPrisma.generatedAsset.update).toHaveBeenCalled()
    );

    const arg = mockPrisma.generatedAsset.update.mock.calls[0][0];
    expect(arg.data.metadata).toEqual({ error: GENERATION_FAILURE_MESSAGE });
    expect(JSON.stringify(arg.data.metadata)).not.toContain("/secret/path");
  });
});
