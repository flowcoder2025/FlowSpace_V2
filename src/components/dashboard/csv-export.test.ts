import { describe, it, expect, vi, afterEach } from "vitest";
import { CSV_BOM } from "@/lib/csv";
import {
  membersToCsv,
  logsToCsv,
  analyticsToCsv,
  csvFilename,
  downloadCsv,
  type LogExportEntry,
  type AnalyticsExportData,
} from "./csv-export";
import type { Member } from "./member-table";

// ============================================================
// WI-031: 대시보드 CSV 매퍼(순수) + 다운로드(DOM)
// ============================================================

function member(overrides: Partial<Member>): Member {
  return {
    id: "m1",
    role: "PARTICIPANT",
    restriction: "NONE",
    displayName: null,
    user: null,
    guestSession: null,
    createdAt: "2026-06-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("membersToCsv", () => {
  it("헤더 + 사용자 멤버 행", () => {
    const csv = membersToCsv([
      member({
        role: "OWNER",
        user: { id: "u1", name: "홍길동", email: "h@x.com", image: null },
      }),
    ]);
    expect(csv).toBe(
      "Name,Email,Role,Restriction,Guest,Joined\r\n" +
        "홍길동,h@x.com,OWNER,NONE,No,2026-06-23T00:00:00.000Z"
    );
  });

  it("게스트 멤버는 nickname을 이름으로, Guest=Yes, email 빈값", () => {
    const csv = membersToCsv([
      member({ guestSession: { id: "g1", nickname: "게스트1" } }),
    ]);
    const row = csv.split("\r\n")[1];
    expect(row).toBe("게스트1,,PARTICIPANT,NONE,Yes,2026-06-23T00:00:00.000Z");
  });

  it("이름 폴백: user.name 없으면 displayName", () => {
    const csv = membersToCsv([member({ displayName: "표시이름" })]);
    expect(csv.split("\r\n")[1]).toBe(
      "표시이름,,PARTICIPANT,NONE,No,2026-06-23T00:00:00.000Z"
    );
  });

  it("이름·이메일이 전혀 없으면 화면과 동일하게 Unknown", () => {
    const csv = membersToCsv([member({})]);
    expect(csv.split("\r\n")[1]).toBe(
      "Unknown,,PARTICIPANT,NONE,No,2026-06-23T00:00:00.000Z"
    );
  });

  it("빈 문자열 이름은 화면처럼 다음 폴백으로 넘어간다(?? 아닌 || 체인)", () => {
    // user.name="" → guest nickname → displayName → "Unknown" 순(MemberTable 일치).
    const csv = membersToCsv([
      member({
        user: { id: "u1", name: "", email: "e@x.com", image: null },
        displayName: "표시이름",
      }),
    ]);
    expect(csv.split("\r\n")[1]).toBe(
      "표시이름,e@x.com,PARTICIPANT,NONE,No,2026-06-23T00:00:00.000Z"
    );
  });

  it("멤버가 없으면 헤더만", () => {
    expect(membersToCsv([])).toBe("Name,Email,Role,Restriction,Guest,Joined");
  });
});

describe("logsToCsv", () => {
  const base: LogExportEntry = {
    eventType: "ENTER",
    payload: null,
    createdAt: "2026-06-23T01:02:03.000Z",
    user: null,
  };

  it("헤더 + null payload는 빈 Details, user 없으면 빈값", () => {
    const csv = logsToCsv([base]);
    expect(csv).toBe(
      "Time,Event Type,User,Details\r\n" +
        "2026-06-23T01:02:03.000Z,ENTER,,"
    );
  });

  it("payload는 JSON 직렬화, user.name 우선", () => {
    const csv = logsToCsv([
      {
        ...base,
        eventType: "ADMIN_ACTION",
        payload: { action: "kick" },
        user: { name: "관리자", email: "a@x.com" },
      },
    ]);
    expect(csv.split("\r\n")[1]).toBe(
      '2026-06-23T01:02:03.000Z,ADMIN_ACTION,관리자,"{""action"":""kick""}"'
    );
  });

  it("user.name 없으면 email 폴백", () => {
    const csv = logsToCsv([{ ...base, user: { name: null, email: "a@x.com" } }]);
    expect(csv.split("\r\n")[1]).toBe("2026-06-23T01:02:03.000Z,ENTER,a@x.com,");
  });

  it("직렬화 불가(순환참조) payload는 [unserializable]", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const csv = logsToCsv([{ ...base, payload: circular }]);
    expect(csv.split("\r\n")[1]).toBe(
      "2026-06-23T01:02:03.000Z,ENTER,,[unserializable]"
    );
  });
});

describe("analyticsToCsv", () => {
  it("두 시계열을 날짜 union으로 머지, 결측은 0, 오름차순", () => {
    const data: AnalyticsExportData = {
      dailyMessages: [
        { date: "2026-06-01", count: 5 },
        { date: "2026-06-03", count: 2 },
      ],
      dailyVisitors: [
        { date: "2026-06-02", count: 1 },
        { date: "2026-06-03", count: 4 },
      ],
    };
    expect(analyticsToCsv(data)).toBe(
      "Date,Messages,Visitors\r\n" +
        "2026-06-01,5,0\r\n" +
        "2026-06-02,0,1\r\n" +
        "2026-06-03,2,4"
    );
  });

  it("빈 시계열은 헤더만", () => {
    expect(analyticsToCsv({ dailyMessages: [], dailyVisitors: [] })).toBe(
      "Date,Messages,Visitors"
    );
  });
});

describe("csvFilename", () => {
  it("flowspace-<kind>-<spaceId>-<YYYY-MM-DD>.csv", () => {
    expect(
      csvFilename("members", "space123", new Date("2026-06-23T10:00:00.000Z"))
    ).toBe("flowspace-members-space123-2026-06-23.csv");
  });
});

describe("downloadCsv", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("BOM 포함 CSV Blob로 앵커 다운로드를 트리거한다", () => {
    let capturedBlob: Blob | undefined;
    let revokedUrl: string | undefined;
    const createSpy = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return "blob:mock";
    });
    const revokeSpy = vi.fn((url: string) => {
      revokedUrl = url;
    });
    // jsdom은 URL.createObjectURL/revokeObjectURL 미구현 → 스텁
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createSpy as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeSpy as unknown as typeof URL.revokeObjectURL;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    try {
      const csv = "a,b\r\n1,2";
      downloadCsv("test.csv", csv);

      expect(createSpy).toHaveBeenCalledOnce();
      expect(capturedBlob?.type).toBe("text/csv;charset=utf-8");
      // BOM이 앞에 붙으므로 byte 길이가 BOM(3byte) 만큼 더 크다.
      expect(capturedBlob?.size).toBe(new Blob([CSV_BOM + csv]).size);

      expect(clickSpy).toHaveBeenCalledOnce();
      expect(revokedUrl).toBe("blob:mock");
      // 다운로드 후 앵커는 DOM에서 제거된다.
      expect(document.querySelectorAll("a[download]").length).toBe(0);
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
      clickSpy.mockRestore();
    }
  });
});
