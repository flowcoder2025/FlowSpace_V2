import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { SpaceSettingsForm } from "./space-settings-form";
import { DASHBOARD_COPY } from "@/constants/dashboard-copy";

// ============================================================
// WI-041: 설정 폼 편집 권한 정합 — canEdit(=PATCH 게이트 미러)이 false(STAFF)면
// 모든 입력 읽기전용 + 저장 버튼 숨김 + 안내 노출 + submit 시 PATCH 미발송.
// ============================================================

const INITIAL = {
  name: "마케팅 본부",
  description: "팀 협업 공간",
  maxUsers: 50,
  accessType: "PUBLIC",
  primaryColor: "#3b82f6",
  loadingMessage: "",
};

// 폼 내 모든 입력 계열 id(input/textarea/select/color) — 하나라도 빠지면 STAFF가 일부 값 편집 가능.
const INPUT_IDS = ["space-name", "space-desc", "max-users", "access-type", "primary-color", "loading-msg"];

function renderForm(canEdit: boolean) {
  return render(
    <SpaceSettingsForm spaceId="space-1" canEdit={canEdit} initialValues={INITIAL} />
  ).container;
}

beforeEach(() => {
  global.fetch = vi.fn() as unknown as typeof fetch;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SpaceSettingsForm — canEdit=false (STAFF 읽기전용)", () => {
  it("읽기전용 안내를 노출한다", () => {
    renderForm(false);
    expect(screen.getByText(DASHBOARD_COPY.SETTINGS.readOnlyNotice)).toBeTruthy();
  });

  it("저장 버튼을 렌더하지 않는다", () => {
    renderForm(false);
    expect(screen.queryByText(DASHBOARD_COPY.SETTINGS.form.save)).toBeNull();
  });

  it("모든 입력 계열(input/textarea/select/color)을 disabled 처리한다", () => {
    const container = renderForm(false);
    for (const id of INPUT_IDS) {
      const el = container.querySelector(`#${id}`) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
        | null;
      expect(el).not.toBeNull();
      expect(el!.disabled).toBe(true);
    }
  });

  it("폼 submit을 시도해도 PATCH fetch를 보내지 않는다(이중 방어)", () => {
    const container = renderForm(false);
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("SpaceSettingsForm — canEdit=true (소유자/슈퍼관리자 편집)", () => {
  it("안내를 숨기고 저장 버튼을 렌더한다", () => {
    renderForm(true);
    expect(screen.queryByText(DASHBOARD_COPY.SETTINGS.readOnlyNotice)).toBeNull();
    expect(screen.getByText(DASHBOARD_COPY.SETTINGS.form.save)).toBeTruthy();
  });

  it("모든 입력 계열을 편집 가능(enabled)으로 둔다", () => {
    const container = renderForm(true);
    for (const id of INPUT_IDS) {
      const el = container.querySelector(`#${id}`) as HTMLInputElement;
      expect(el.disabled).toBe(false);
    }
  });

  it("저장 시 PATCH /api/spaces/[id]를 호출하고 성공 메시지를 보여준다", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    renderForm(true);
    fireEvent.click(screen.getByText(DASHBOARD_COPY.SETTINGS.form.save));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { method: string }
    ];
    expect(url).toBe("/api/spaces/space-1");
    expect(opts.method).toBe("PATCH");
    expect(await screen.findByText(DASHBOARD_COPY.SETTINGS.success)).toBeTruthy();
  });
});
