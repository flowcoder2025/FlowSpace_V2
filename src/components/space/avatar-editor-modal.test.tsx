import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

// CharacterEditor(편집 UI·무거움)는 스텁 — 모달 셸의 a11y/Dialog 배선만 검증.
vi.mock("@/components/avatar", () => ({
  CharacterEditor: () => <div data-testid="char-editor" />,
}));

import { AvatarEditorModal } from "./avatar-editor-modal";

// ============================================================
// WI-043: avatar-editor-modal이 공용 Dialog로 a11y(role/aria-labelledby + 닫기 버튼 이름) 획득.
// (focus-trap이 첫 focusable=닫기 버튼으로 포커스 → 그 버튼의 accessible name 필수)
// ============================================================

afterEach(cleanup);

function renderModal(onClose = vi.fn(), onSave = vi.fn()) {
  // 비-chibi 문자열 → parts 탭(CharacterEditor 스텁) 렌더.
  render(<AvatarEditorModal currentAvatar="" onSave={onSave} onClose={onClose} />);
  return { onClose, onSave };
}

describe("AvatarEditorModal — WI-043 Dialog a11y", () => {
  it("role=dialog + aria-labelledby가 제목(캐릭터 편집)을 가리킴", () => {
    renderModal();
    const dialog = screen.getByRole("dialog");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId!)?.textContent).toContain("캐릭터 편집");
  });

  it("닫기 버튼에 accessible name(aria-label '닫기')이 있음(SVG-only 버튼 이름 보강)", () => {
    renderModal();
    expect(screen.getByRole("button", { name: "닫기" })).toBeTruthy();
  });

  it("ESC → onClose (Dialog로 추가된 닫기 경로)", () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
