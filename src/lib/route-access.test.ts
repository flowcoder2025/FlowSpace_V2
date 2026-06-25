import { describe, it, expect } from "vitest";
import { isPublicRequest, PUBLIC_FILES, PUBLIC_API_PATHS } from "./route-access";

describe("isPublicRequest", () => {
  describe("public 정적 자산 (WI-020 회귀 — 로고 깨짐 방지)", () => {
    it("public allowlist 파일 /Logo.png 은 미인증 통과", () => {
      expect(isPublicRequest("/Logo.png")).toBe(true);
    });
    it("allowlist 는 exact 매칭 — 대소문자/하위경로 불일치는 비공개", () => {
      expect(isPublicRequest("/logo.png")).toBe(false); // 대소문자 (실제 자산 아님)
      expect(isPublicRequest("/Logo.png/secret")).toBe(false); // 하위경로 위장
    });
    it("Next 내부 자산은 통과", () => {
      expect(isPublicRequest("/_next/static/chunks/x.js")).toBe(true);
      expect(isPublicRequest("/_next/image?url=%2FLogo.png")).toBe(true);
      expect(isPublicRequest("/favicon.ico")).toBe(true);
    });
  });

  describe("확장자 우회 미재개방 (codex 적대 협의 — deny-by-default 유지)", () => {
    it("확장자 달린 보호 페이지 경로는 여전히 비공개", () => {
      expect(isPublicRequest("/space/foo.png")).toBe(false);
      expect(isPublicRequest("/spaces/foo.png")).toBe(false);
      expect(isPublicRequest("/dashboard/spaces/foo.png")).toBe(false);
    });
    it("확장자 달린 API 경로도 여전히 인증 차단 (확장자 우회 핵심 케이스)", () => {
      expect(isPublicRequest("/api/spaces/foo.png")).toBe(false);
      expect(isPublicRequest("/api/assets/foo.png")).toBe(false);
    });
  });

  describe("보호 라우트 (인증 필요)", () => {
    it("일반 보호 라우트는 비공개", () => {
      expect(isPublicRequest("/api/spaces")).toBe(false);
      expect(isPublicRequest("/spaces/abc123")).toBe(false);
      expect(isPublicRequest("/dashboard")).toBe(false);
    });
  });

  describe("공개 라우트 (WI-001 exact prefix 경계 보존)", () => {
    it("루트는 exact 매칭만", () => {
      expect(isPublicRequest("/")).toBe(true);
    });
    it("public prefix 는 정확/하위 경로만, 유사 경로는 비공개", () => {
      expect(isPublicRequest("/login")).toBe(true);
      expect(isPublicRequest("/login/reset")).toBe(true);
      expect(isPublicRequest("/login-anything")).toBe(false); // prefix 위장
      expect(isPublicRequest("/api/auth")).toBe(true);
      expect(isPublicRequest("/api/auth/callback/google")).toBe(true);
      expect(isPublicRequest("/api/guest")).toBe(true);
      expect(isPublicRequest("/api/guest/join")).toBe(true);
    });
  });

  it("PUBLIC_FILES 는 실제 public/ 자산만 포함", () => {
    expect(PUBLIC_FILES.has("/Logo.png")).toBe(true);
  });

  describe("자체 인증 외부 콜백 API (WI-050 — LiveKit webhook)", () => {
    it("/api/livekit/webhook 은 미인증 통과(라우트가 서명 자체검증)", () => {
      expect(isPublicRequest("/api/livekit/webhook")).toBe(true);
    });
    it("exact 매칭 — 하위 경로는 비공개(prefix 아님)", () => {
      expect(isPublicRequest("/api/livekit/webhook/foo")).toBe(false);
      expect(isPublicRequest("/api/livekit/webhookX")).toBe(false);
    });
    it("형제 라우트 /api/livekit/token 은 여전히 인증 필요(회귀 — 토큰 라우트 비노출)", () => {
      expect(isPublicRequest("/api/livekit/token")).toBe(false);
      expect(isPublicRequest("/api/livekit")).toBe(false);
    });
    it("PUBLIC_API_PATHS 는 webhook 정확 경로만 포함", () => {
      expect(PUBLIC_API_PATHS.has("/api/livekit/webhook")).toBe(true);
      expect(PUBLIC_API_PATHS.has("/api/livekit/token")).toBe(false);
    });
  });
});
