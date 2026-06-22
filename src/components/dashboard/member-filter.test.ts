import { describe, it, expect } from "vitest";
import { filterMembers } from "./member-filter";
import type { Member } from "./member-table";

// ============================================================
// WI-029: 멤버 검색/역할 필터 순수 로직 테스트
// ============================================================

function member(overrides: Partial<Member>): Member {
  return {
    id: "m-default",
    role: "PARTICIPANT",
    restriction: "NONE",
    displayName: null,
    createdAt: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

const alice = member({
  id: "alice",
  role: "OWNER",
  user: { id: "u1", name: "Alice Kim", email: "alice@example.com", image: null },
});
const bob = member({
  id: "bob",
  role: "STAFF",
  user: { id: "u2", name: "Bob Lee", email: "bob@flow.com", image: null },
});
const guest = member({
  id: "guest",
  role: "PARTICIPANT",
  guestSession: { id: "g1", nickname: "Guppy" },
});
const named = member({
  id: "named",
  role: "PARTICIPANT",
  displayName: "DisplayOnly",
});

const ALL = [alice, bob, guest, named];
const ids = (ms: Member[]) => ms.map((m) => m.id);

describe("filterMembers — 검색어", () => {
  it("빈 검색어 + ALL → 전체 반환", () => {
    expect(ids(filterMembers(ALL, "", "ALL"))).toEqual(["alice", "bob", "guest", "named"]);
  });

  it("공백-only 검색어 → 전체(trim 후 빈값)", () => {
    expect(ids(filterMembers(ALL, "   ", "ALL"))).toEqual(["alice", "bob", "guest", "named"]);
  });

  it("user.name 부분일치", () => {
    expect(ids(filterMembers(ALL, "alice", "ALL"))).toEqual(["alice"]);
  });

  it("대소문자 무시", () => {
    expect(ids(filterMembers(ALL, "BOB", "ALL"))).toEqual(["bob"]);
  });

  it("user.email 부분일치", () => {
    expect(ids(filterMembers(ALL, "flow.com", "ALL"))).toEqual(["bob"]);
  });

  it("guestSession.nickname 일치(user 없음)", () => {
    expect(ids(filterMembers(ALL, "guppy", "ALL"))).toEqual(["guest"]);
  });

  it("displayName 일치(user/guest 없음)", () => {
    expect(ids(filterMembers(ALL, "displayonly", "ALL"))).toEqual(["named"]);
  });

  it("검색어 trim 적용", () => {
    expect(ids(filterMembers(ALL, "  alice  ", "ALL"))).toEqual(["alice"]);
  });

  it("일치 없음 → 빈 배열", () => {
    expect(filterMembers(ALL, "zzz-nomatch", "ALL")).toEqual([]);
  });

  it("표시명 우선순위(user.name) — 하위 후보(nickname/displayName)는 검색 비매칭", () => {
    // user.name 존재 → 표시명='AlphaUser', 하위 후보는 검색 대상 아님 (|| 체인 순서 변이 검출)
    const m = member({
      id: "prio",
      displayName: "OmegaDisplay",
      guestSession: { id: "g2", nickname: "BetaGuest" },
      user: { id: "u3", name: "AlphaUser", email: "alpha@x.com", image: null },
    });
    expect(ids(filterMembers([m], "alphauser", "ALL"))).toEqual(["prio"]);
    expect(filterMembers([m], "omegadisplay", "ALL")).toEqual([]);
    expect(filterMembers([m], "betaguest", "ALL")).toEqual([]);
  });

  it("표시명 우선순위(guestSession) — user 없으면 nickname, displayName 비매칭", () => {
    const m = member({
      id: "prio2",
      displayName: "DispLose",
      guestSession: { id: "g3", nickname: "NickWin" },
    });
    expect(ids(filterMembers([m], "nickwin", "ALL"))).toEqual(["prio2"]);
    expect(filterMembers([m], "displose", "ALL")).toEqual([]);
  });
});

describe("filterMembers — 역할 필터", () => {
  it("OWNER만", () => {
    expect(ids(filterMembers(ALL, "", "OWNER"))).toEqual(["alice"]);
  });

  it("STAFF만", () => {
    expect(ids(filterMembers(ALL, "", "STAFF"))).toEqual(["bob"]);
  });

  it("PARTICIPANT만", () => {
    expect(ids(filterMembers(ALL, "", "PARTICIPANT"))).toEqual(["guest", "named"]);
  });

  it("역할 + 검색어 동시 적용(AND)", () => {
    // PARTICIPANT 중 'guppy'만
    expect(ids(filterMembers(ALL, "guppy", "PARTICIPANT"))).toEqual(["guest"]);
    // OWNER 중 'guppy' → 역할 불일치로 빈 배열
    expect(filterMembers(ALL, "guppy", "OWNER")).toEqual([]);
  });
});
