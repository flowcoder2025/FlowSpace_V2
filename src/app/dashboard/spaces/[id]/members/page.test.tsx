import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "space-1" }),
}));

import MembersPage from "./page";

// ============================================================
// WI-029: Members 페이지 — 로딩/빈상태/검색·필터/에러 처리
// ============================================================

interface Deferred {
  promise: Promise<unknown>;
  resolve: (v: unknown) => void;
}
function defer(): Deferred {
  let resolve!: (v: unknown) => void;
  const promise = new Promise<unknown>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const jsonOk = (body: unknown) => ({ ok: true, json: async () => body });

const MEMBERS = [
  {
    id: "alice",
    role: "OWNER",
    restriction: "NONE",
    displayName: null,
    user: { id: "u1", name: "Alice Kim", email: "alice@example.com", image: null },
    createdAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "bob",
    role: "STAFF",
    restriction: "NONE",
    displayName: null,
    user: { id: "u2", name: "Bob Lee", email: "bob@flow.com", image: null },
    createdAt: "2026-06-01T00:00:00Z",
  },
];

let d: Deferred;
beforeEach(() => {
  d = defer();
  global.fetch = vi.fn(() => d.promise) as unknown as typeof fetch;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MembersPage", () => {
  it("초기 로딩 상태 표시 후 멤버 렌더", async () => {
    render(<MembersPage />);
    expect(screen.getByText("Loading...")).toBeTruthy();

    d.resolve(jsonOk({ members: MEMBERS }));
    await screen.findByText("Alice Kim");

    expect(screen.queryByText("Loading...")).toBeNull();
    expect(screen.getByText("Bob Lee")).toBeTruthy();
  });

  it("멤버 0명 → 빈 상태 표시", async () => {
    render(<MembersPage />);
    d.resolve(jsonOk({ members: [] }));
    await screen.findByText("멤버가 없습니다.");
  });

  it("fetch 실패 시 에러 메시지 표시(WI-029 — 기존 미처리 보강)", async () => {
    render(<MembersPage />);
    d.resolve({ ok: false, json: async () => ({}) });
    await screen.findByText("Failed to load members");
  });

  it("검색어 입력 시 행 필터링", async () => {
    render(<MembersPage />);
    d.resolve(jsonOk({ members: MEMBERS }));
    await screen.findByText("Alice Kim");

    fireEvent.change(screen.getByLabelText("멤버 검색"), {
      target: { value: "bob" },
    });

    expect(screen.queryByText("Alice Kim")).toBeNull();
    expect(screen.getByText("Bob Lee")).toBeTruthy();
  });

  it("역할 필터 STAFF → STAFF만 표시", async () => {
    render(<MembersPage />);
    d.resolve(jsonOk({ members: MEMBERS }));
    await screen.findByText("Alice Kim");

    fireEvent.change(screen.getByLabelText("역할 필터"), {
      target: { value: "STAFF" },
    });

    expect(screen.queryByText("Alice Kim")).toBeNull();
    expect(screen.getByText("Bob Lee")).toBeTruthy();
  });

  it("검색 결과 없음 → 전용 빈 상태", async () => {
    render(<MembersPage />);
    d.resolve(jsonOk({ members: MEMBERS }));
    await screen.findByText("Alice Kim");

    fireEvent.change(screen.getByLabelText("멤버 검색"), {
      target: { value: "zzz-nomatch" },
    });

    await screen.findByText("검색 결과가 없습니다.");
    expect(screen.queryByText("Alice Kim")).toBeNull();
  });
});
