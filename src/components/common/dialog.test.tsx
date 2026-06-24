import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { Dialog } from "./dialog";

// ============================================================
// WI-043: 공용 접근성 Dialog — role/aria + ESC/백드롭 닫기 + focus-trap + focus-restore.
// ============================================================

afterEach(cleanup);

describe("Dialog — WI-043 접근성 공용 모달", () => {
  it("open=false면 렌더하지 않음", () => {
    render(
      <Dialog open={false} onClose={vi.fn()}>
        <p>내용</p>
      </Dialog>
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("open=true면 role=dialog + aria-modal + aria-labelledby", () => {
    render(
      <Dialog open onClose={vi.fn()} labelledById="t1">
        <h2 id="t1">제목</h2>
      </Dialog>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("t1");
  });

  it("ESC → onClose (기본 closeOnEscape)", () => {
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose}><button>x</button></Dialog>);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closeOnEscape=false → ESC 무시", () => {
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} closeOnEscape={false}><button>x</button></Dialog>);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("백드롭 클릭 → onClose, 패널 내부 클릭 → onClose 아님", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Dialog open onClose={onClose}><button>x</button></Dialog>
    );
    // 패널 내부 클릭(전파 차단)
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
    // 백드롭(루트) 클릭
    fireEvent.click(container.firstChild as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closeOnBackdrop=false → 백드롭 클릭 무시", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Dialog open onClose={onClose} closeOnBackdrop={false}><button>x</button></Dialog>
    );
    fireEvent.click(container.firstChild as Element);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("focus-trap: 열릴 때 첫 focusable에 포커스", () => {
    render(
      <Dialog open onClose={vi.fn()}>
        <button>first</button>
        <button>last</button>
      </Dialog>
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "first" }));
  });

  it("focus-trap: 마지막에서 Tab → 첫으로 순환", () => {
    render(
      <Dialog open onClose={vi.fn()}>
        <button>first</button>
        <button>last</button>
      </Dialog>
    );
    const last = screen.getByRole("button", { name: "last" });
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "first" }));
  });

  it("focus-trap: 첫에서 Shift+Tab → 마지막으로 순환", () => {
    render(
      <Dialog open onClose={vi.fn()}>
        <button>first</button>
        <button>last</button>
      </Dialog>
    );
    const first = screen.getByRole("button", { name: "first" });
    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "last" }));
  });

  it("focusable 0개(전부 disabled) → 패널에 포커스, Tab은 패널 고정", () => {
    render(
      <Dialog open onClose={vi.fn()}>
        <button disabled>x</button>
      </Dialog>
    );
    const dialog = screen.getByRole("dialog");
    expect(document.activeElement).toBe(dialog);
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(dialog); // 밖으로 못 나감
  });

  it("focus-restore: 닫힐 때 열기 직전 포커스(opener) 복원", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>opener</button>
          <Dialog open={open} onClose={() => setOpen(false)}>
            <button>닫기없음</button>
          </Dialog>
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "opener" });
    opener.focus();
    expect(document.activeElement).toBe(opener);
    fireEvent.click(opener); // open=true → 다이얼로그 첫 focusable로 포커스 이동
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "닫기없음" }));
    fireEvent.keyDown(document, { key: "Escape" }); // onClose → open=false
    expect(document.activeElement).toBe(opener); // opener 복원
  });
});
