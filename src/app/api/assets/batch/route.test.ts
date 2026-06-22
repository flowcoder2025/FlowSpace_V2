import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MockInstance } from "vitest";
import { buildJsonRequest, makeSession } from "@/__tests__/helpers/api-route";
import { GENERATION_FAILURE_MESSAGE } from "@/features/assets";

// generate 라우트 테스트와 동일 패턴: processAssetGeneration만 stub, 배럴 상수 보존.
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

const RAW_ERROR =
  "ComfyUI internal: ECONNREFUSED http://127.0.0.1:8188 at " +
  "/srv/app/src/features/assets/internal/processor.ts:146";

function makeRequest() {
  return buildJsonRequest("http://localhost/api/assets/batch", "POST", {
    items: [{ type: "character", name: "전사", prompt: "a brave warrior" }],
  });
}

describe("POST /api/assets/batch — 비동기 실패 경로 정보위생 (WI-024)", () => {
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

  it("실패 시 raw error.message 대신 generic으로 정규화하고 batchId는 보존한다", async () => {
    mockProcess.mockRejectedValue(new Error(RAW_ERROR));

    const res = await POST(makeRequest());
    expect(res.status).toBe(202);

    await vi.waitFor(() =>
      expect(mockPrisma.generatedAsset.update).toHaveBeenCalled()
    );

    const arg = mockPrisma.generatedAsset.update.mock.calls[0][0];
    expect(arg.data.status).toBe("FAILED");
    expect(arg.data.metadata.error).toBe(GENERATION_FAILURE_MESSAGE);
    // batch는 그룹핑용 batchId를 유지한다(폴링 GET /api/assets/batch가 사용).
    expect(typeof arg.data.metadata.batchId).toBe("string");
    expect(arg.data.metadata.batchId).toMatch(/^batch-/);

    // metadata는 batchId + error 두 키만 — raw 사유 단편 없음.
    expect(Object.keys(arg.data.metadata).sort()).toEqual(["batchId", "error"]);
    const stored = JSON.stringify(arg.data.metadata);
    expect(stored).not.toContain("ECONNREFUSED");
    expect(stored).not.toContain("processor.ts");
    expect(stored).not.toContain("127.0.0.1");
  });

  it("raw error는 console.error 서버 로그로만 보존한다", async () => {
    mockProcess.mockRejectedValue(new Error(RAW_ERROR));

    await POST(makeRequest());
    await vi.waitFor(() =>
      expect(mockPrisma.generatedAsset.update).toHaveBeenCalled()
    );

    const loggedRaw = errSpy.mock.calls.some((call) =>
      call.some((a) => a instanceof Error && a.message.includes("ECONNREFUSED"))
    );
    expect(loggedRaw).toBe(true);
  });
});
