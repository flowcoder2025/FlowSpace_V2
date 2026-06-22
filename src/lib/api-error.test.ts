import { describe, it, expect, vi, afterEach } from "vitest";
import { internalErrorResponse } from "./api-error";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("internalErrorResponse (WI-023)", () => {
  it("500 상태로 generic 메시지만 반환한다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = internalErrorResponse(
      "GET /api/test",
      new Error("db down"),
      "Failed to do thing"
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Failed to do thing" });
  });

  it("원본 에러 메시지를 응답에 절대 노출하지 않는다 (CWE-209)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const secret =
      "Invalid `prisma.user.findUnique()`: column accessSecret at /srv/app/db";
    const res = internalErrorResponse(
      "POST /api/test",
      new Error(secret),
      "Failed to do thing"
    );
    const body = (await res.json()) as Record<string, unknown>;

    expect(JSON.stringify(body)).not.toContain(secret);
    expect(body.details).toBeUndefined();
    expect(Object.keys(body)).toEqual(["error"]);
  });

  it("응답 키 집합은 정확히 { error } 뿐이다 (details/code/stack 미포함)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = internalErrorResponse("DELETE /api/test", { weird: 1 }, "msg");
    const body = (await res.json()) as Record<string, unknown>;

    expect(Object.keys(body)).toEqual(["error"]);
  });

  it("원본 에러를 context 태그와 함께 서버 로그에 남긴다 (디버깅 보존)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("boom");

    internalErrorResponse("GET /api/widgets", err, "Failed");

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("[GET /api/widgets]", err);
  });

  it("non-Error 값(문자열 throw 등)도 안전하게 처리한다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = internalErrorResponse("GET /api/test", "string error", "Failed");
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Failed" });
  });
});
