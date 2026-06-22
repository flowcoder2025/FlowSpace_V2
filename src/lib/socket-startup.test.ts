import { afterEach, describe, expect, it, vi } from "vitest";
import { validateSocketStartupConfig } from "./socket-startup";

/**
 * WI-018 — 소켓 서버 부팅 전 env 검증 (fail-fast).
 *
 * 핵심 계약:
 * - production + AUTH_SECRET 미설정/단문 → throw (listen 전 crash).
 * - 비-production(dev/test) → throw 아님, 경고만 (기존 동작 보존).
 * - SOCKET_INTERNAL_SECRET 미설정 → throw 아님(graceful degrade), production에서만 경고.
 * - 시크릿 값은 throw 메시지/경고에 절대 미포함.
 */

const VALID_SECRET = "x".repeat(40); // MIN_AUTH_SECRET_LENGTH(32) 이상
const SHORT_SECRET_CANARY = "leak-canary-29-chars-secret!!"; // 29자 < 32 → 무효, 값 누출 감시용

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("validateSocketStartupConfig — AUTH_SECRET (필수)", () => {
  it("production + AUTH_SECRET 미설정 → throw", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", undefined);
    vi.stubEnv("SOCKET_INTERNAL_SECRET", VALID_SECRET);

    expect(() => validateSocketStartupConfig()).toThrow(/AUTH_SECRET/);
  });

  it("production + AUTH_SECRET 단문(<32) → throw", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "short");
    vi.stubEnv("SOCKET_INTERNAL_SECRET", VALID_SECRET);

    expect(() => validateSocketStartupConfig()).toThrow(/AUTH_SECRET/);
  });

  it("production + AUTH_SECRET 유효 → throw 없음", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", VALID_SECRET);
    vi.stubEnv("SOCKET_INTERNAL_SECRET", VALID_SECRET);

    expect(() => validateSocketStartupConfig()).not.toThrow();
  });

  it("development + AUTH_SECRET 미설정 → throw 아님, 경고만(AUTH_SECRET 언급)", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_SECRET", undefined);
    vi.stubEnv("SOCKET_INTERNAL_SECRET", VALID_SECRET);

    const report = validateSocketStartupConfig();
    expect(report.warnings.some((w) => w.includes("AUTH_SECRET"))).toBe(true);
  });

  it("test 환경 + AUTH_SECRET 미설정 → throw 아님(비-production)", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_SECRET", undefined);
    vi.stubEnv("SOCKET_INTERNAL_SECRET", VALID_SECRET);

    expect(() => validateSocketStartupConfig()).not.toThrow();
  });

  it("development + AUTH_SECRET 유효 → 경고 없음", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_SECRET", VALID_SECRET);
    vi.stubEnv("SOCKET_INTERNAL_SECRET", VALID_SECRET);

    const report = validateSocketStartupConfig();
    expect(report.warnings).toHaveLength(0);
  });
});

describe("validateSocketStartupConfig — SOCKET_INTERNAL_SECRET (선택)", () => {
  it("production + SOCKET_INTERNAL_SECRET 미설정 → throw 아님, 경고만", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", VALID_SECRET);
    vi.stubEnv("SOCKET_INTERNAL_SECRET", undefined);

    const report = validateSocketStartupConfig();
    expect(report.warnings.some((w) => w.includes("SOCKET_INTERNAL_SECRET"))).toBe(
      true
    );
  });

  it("production + SOCKET_INTERNAL_SECRET 설정 → 경고 없음", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", VALID_SECRET);
    vi.stubEnv("SOCKET_INTERNAL_SECRET", VALID_SECRET);

    const report = validateSocketStartupConfig();
    expect(report.warnings).toHaveLength(0);
  });

  it("development + SOCKET_INTERNAL_SECRET 미설정 → 경고 없음(dev는 enforce 미사용이 정상)", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_SECRET", VALID_SECRET);
    vi.stubEnv("SOCKET_INTERNAL_SECRET", undefined);

    const report = validateSocketStartupConfig();
    expect(
      report.warnings.some((w) => w.includes("SOCKET_INTERNAL_SECRET"))
    ).toBe(false);
  });
});

describe("validateSocketStartupConfig — 시크릿 값 미노출(CWE-209 방지)", () => {
  it("production throw 시 메시지에 시크릿 값 미포함", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", SHORT_SECRET_CANARY); // 무효(단문)지만 distinctive 값
    vi.stubEnv("SOCKET_INTERNAL_SECRET", VALID_SECRET);

    try {
      validateSocketStartupConfig();
      throw new Error("did not throw");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain(SHORT_SECRET_CANARY);
      expect(message).toMatch(/AUTH_SECRET/);
    }
  });

  it("development 경고에 시크릿 값 미포함", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_SECRET", SHORT_SECRET_CANARY); // 무효(단문)
    vi.stubEnv("SOCKET_INTERNAL_SECRET", VALID_SECRET);

    const report = validateSocketStartupConfig();
    expect(report.warnings.join("\n")).not.toContain(SHORT_SECRET_CANARY);
  });
});
