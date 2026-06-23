import { describe, it, expect } from "vitest";
import { DASHBOARD_COPY } from "./dashboard-copy";

// ============================================================
// WI-033: 대시보드 한글 카피 — 동적 함수 엔트리 + enum 라벨 매핑(값/라벨 분리)
// ============================================================

describe("DASHBOARD_COPY 동적 카피", () => {
  it("MEMBERS.count: 필터 미적용(표시=전체)은 'N명'", () => {
    expect(DASHBOARD_COPY.MEMBERS.count(5, 5)).toBe("5명");
  });

  it("MEMBERS.count: 필터 적용(표시≠전체)은 '표시 / 전체명'", () => {
    expect(DASHBOARD_COPY.MEMBERS.count(2, 5)).toBe("2 / 5명");
  });

  it("MEDIA.grantsTitle: 개수를 괄호로 노출", () => {
    expect(DASHBOARD_COPY.MEDIA.grantsTitle(3)).toBe("스포트라이트 권한 (3)");
    expect(DASHBOARD_COPY.MEDIA.grantsTitle(0)).toBe("스포트라이트 권한 (0)");
  });

  it("LOGS.csvLabel: 로드된 건수를 노출", () => {
    expect(DASHBOARD_COPY.LOGS.csvLabel(12)).toBe("CSV 내보내기 (로드된 12건)");
  });
});

describe("DASHBOARD_COPY enum 라벨 매핑(값/라벨 분리)", () => {
  it("roleLabel: 알려진 코드 → 한글, 미정의 코드 → 코드 폴백", () => {
    expect(DASHBOARD_COPY.roleLabel("OWNER")).toBe("소유자");
    expect(DASHBOARD_COPY.roleLabel("STAFF")).toBe("스태프");
    expect(DASHBOARD_COPY.roleLabel("PARTICIPANT")).toBe("참여자");
    // 신규/미정의 enum은 빈 칸/undefined 대신 코드로 폴백(회귀 안전).
    expect(DASHBOARD_COPY.roleLabel("FUTURE_ROLE")).toBe("FUTURE_ROLE");
  });

  it("restrictionLabel: NONE 포함 매핑, 미정의 폴백", () => {
    expect(DASHBOARD_COPY.restrictionLabel("NONE")).toBe("없음");
    expect(DASHBOARD_COPY.restrictionLabel("MUTED")).toBe("음소거");
    expect(DASHBOARD_COPY.restrictionLabel("BANNED")).toBe("차단됨");
    expect(DASHBOARD_COPY.restrictionLabel("XXX")).toBe("XXX");
  });

  it("messageTypeLabel: 매핑 + 폴백", () => {
    expect(DASHBOARD_COPY.messageTypeLabel("WHISPER")).toBe("귓속말");
    expect(DASHBOARD_COPY.messageTypeLabel("ANNOUNCEMENT")).toBe("공지");
    expect(DASHBOARD_COPY.messageTypeLabel("UNKNOWN_TYPE")).toBe("UNKNOWN_TYPE");
  });

  it("eventTypeLabel: 매핑 + 폴백", () => {
    expect(DASHBOARD_COPY.eventTypeLabel("ENTER")).toBe("입장");
    expect(DASHBOARD_COPY.eventTypeLabel("ADMIN_ACTION")).toBe("관리자 작업");
    expect(DASHBOARD_COPY.eventTypeLabel("SCREEN_SHARE_START")).toBe("화면 공유 시작");
    expect(DASHBOARD_COPY.eventTypeLabel("NEW_EVENT")).toBe("NEW_EVENT");
  });

  it("accessTypeLabel: 매핑 + 폴백", () => {
    expect(DASHBOARD_COPY.accessTypeLabel("PUBLIC")).toBe("공개");
    expect(DASHBOARD_COPY.accessTypeLabel("PRIVATE")).toBe("비공개");
    expect(DASHBOARD_COPY.accessTypeLabel("PASSWORD")).toBe("비밀번호");
    expect(DASHBOARD_COPY.accessTypeLabel("OTHER")).toBe("OTHER");
  });
});
