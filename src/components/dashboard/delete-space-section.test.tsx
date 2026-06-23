import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

import { DeleteSpaceSection } from "./delete-space-section";
import { DASHBOARD_COPY } from "@/constants/dashboard-copy";

// ============================================================
// WI-037: 설정 화면 스페이스 삭제 UI — 이름 타이핑 확인 + DELETE + redirect
// ============================================================

const COPY = DASHBOARD_COPY.SETTINGS.dangerZone;
const SPACE = { id: "space-1", name: "마케팅 본부" };

function setup(name = SPACE.name) {
  render(<DeleteSpaceSection spaceId={SPACE.id} spaceName={name} />);
}

/** 모달 열고 이름을 입력한다. */
function openAndType(text: string) {
  fireEvent.click(screen.getByRole("button", { name: COPY.deleteButton }));
  fireEvent.change(screen.getByLabelText(COPY.confirmPlaceholder), {
    target: { value: text },
  });
}

function confirmButton() {
  return screen.getByRole("button", { name: COPY.confirm });
}

function okResponse() {
  return { ok: true, json: async () => ({ message: "Space archived", realtimeEnforced: true }) };
}

beforeEach(() => {
  mockReplace.mockReset();
  global.fetch = vi.fn() as unknown as typeof fetch;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DeleteSpaceSection — 진입/모달", () => {
  it("위험 구역 제목·설명·삭제 버튼을 렌더한다", () => {
    setup();
    expect(screen.getByText(COPY.title)).toBeTruthy();
    expect(screen.getByText(COPY.description)).toBeTruthy();
    expect(screen.getByRole("button", { name: COPY.deleteButton })).toBeTruthy();
  });

  it("초기엔 모달이 닫혀 있다", () => {
    setup();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("삭제 버튼 클릭 → 모달 열림 + 정확한 스페이스 이름 노출", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: COPY.deleteButton }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    // 모달 안에 확인용 스페이스 이름이 정확히 표시된다(codex 협의: 정확한 이름 노출).
    expect(screen.getByText(SPACE.name)).toBeTruthy();
    expect(screen.getByText(COPY.modalWarning)).toBeTruthy();
  });

  it("취소 버튼 → 모달 닫힘, fetch 미호출", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: COPY.deleteButton }));
    fireEvent.click(screen.getByRole("button", { name: COPY.cancel }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("ESC 키 → 모달 닫힘", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: COPY.deleteButton }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("DeleteSpaceSection — 이름 타이핑 확인 게이트", () => {
  it("입력 전엔 삭제 버튼 비활성", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: COPY.deleteButton }));
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("이름 불일치 → 비활성 유지", () => {
    setup();
    openAndType("마케팅");
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("이름 정확 일치 → 활성", () => {
    setup();
    openAndType(SPACE.name);
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it("이름이 비활성 게이트라 불일치 시 클릭해도 DELETE 미발생", () => {
    setup();
    openAndType("틀린 이름");
    fireEvent.click(confirmButton());
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("빈 이름 스페이스 → 빈 입력이 일치해도 삭제 비활성(무타이핑 활성 차단)", () => {
    setup("");
    fireEvent.click(screen.getByRole("button", { name: COPY.deleteButton }));
    // confirmInput("") === spaceName("") 이지만 length>0 가드로 비활성 유지.
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirmButton());
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("특수문자·공백 포함 이름도 정확히 일치해야 활성", () => {
    setup("Team A / B (2026)");
    openAndType("Team A / B");
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(COPY.confirmPlaceholder), {
      target: { value: "Team A / B (2026)" },
    });
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("DeleteSpaceSection — 삭제 플로우", () => {
  it("성공(200) → DELETE 호출 + /my-spaces로 replace", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(okResponse());
    setup();
    openAndType(SPACE.name);
    fireEvent.click(confirmButton());

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/my-spaces"));
    expect(global.fetch).toHaveBeenCalledWith(
      `/api/spaces/${SPACE.id}`,
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("이미 archived(멱등 200)도 성공 취급 → redirect", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Space archived", realtimeEnforced: false }),
    });
    setup();
    openAndType(SPACE.name);
    fireEvent.click(confirmButton());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/my-spaces"));
  });

  it("403 → 서버 에러메시지 표시, 모달 유지, redirect 안 함", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Forbidden" }),
    });
    setup();
    openAndType(SPACE.name);
    fireEvent.click(confirmButton());

    await waitFor(() => expect(screen.getByText("Forbidden")).toBeTruthy());
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("에러 응답에 error 필드 없으면 기본 메시지", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });
    setup();
    openAndType(SPACE.name);
    fireEvent.click(confirmButton());
    await waitFor(() => expect(screen.getByText(COPY.deleteError)).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("네트워크 오류(fetch throw) → 기본 에러메시지, 모달 유지", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network"));
    setup();
    openAndType(SPACE.name);
    fireEvent.click(confirmButton());
    await waitFor(() => expect(screen.getByText(COPY.deleteError)).toBeTruthy());
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("삭제 진행 중 중복 클릭해도 DELETE는 1회만(중복 제출 방지)", async () => {
    let resolveFetch!: (v: unknown) => void;
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((r) => {
        resolveFetch = r;
      })
    );
    setup();
    openAndType(SPACE.name);
    fireEvent.click(confirmButton());
    // 진행 중: 버튼 라벨이 '삭제 중...'으로 바뀌고 비활성 → 재클릭 무효
    await waitFor(() => expect(screen.getByText(COPY.deleting)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: COPY.deleting }));
    expect(global.fetch).toHaveBeenCalledTimes(1);

    resolveFetch(okResponse());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/my-spaces"));
  });
});
