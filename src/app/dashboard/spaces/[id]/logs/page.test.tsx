import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "space-1" }),
}));

import LogsPage from "./page";

// ============================================================
// WI-029: Logs 페이지 — fetch 실패 시 에러 표시(기존 catch{} 무시 보강)
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

let d: Deferred;
beforeEach(() => {
  d = defer();
  global.fetch = vi.fn(() => d.promise) as unknown as typeof fetch;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LogsPage 에러 처리", () => {
  it("fetch !ok → 에러 메시지 표시(이전엔 catch{}로 무시됨)", async () => {
    render(<LogsPage />);
    d.resolve({ ok: false, json: async () => ({}) });
    await screen.findByText("Failed to load logs");
  });

  it("성공 시 에러 미표시", async () => {
    render(<LogsPage />);
    d.resolve({ ok: true, json: async () => ({ logs: [], nextCursor: null }) });
    await waitFor(() =>
      expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1)
    );
    expect(screen.queryByText("Failed to load logs")).toBeNull();
  });
});
