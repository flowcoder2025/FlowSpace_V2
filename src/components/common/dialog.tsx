"use client";

/**
 * Dialog — 공용 접근성 모달 (WI-043).
 *
 * 레포에 focus-trap/focus-restore 패턴이 전무해 각 모달이 role/aria/ESC를 제각각(또는 전무)
 * 구현하던 것을 단일 컴포넌트로 통합한다. 표준 dialog 동작을 제공한다:
 * - `role="dialog"` + `aria-modal="true"` + `aria-labelledby`(외부 주입 id, useId 권장).
 * - **focus-trap**: 열릴 때 패널 내 첫 focusable(없으면 패널 자체)로 포커스, Tab/Shift+Tab을
 *   패널 안에서 순환. 닫힐 때 열기 직전 포커스(opener)로 복원.
 * - ESC(`closeOnEscape`)·백드롭 클릭(`closeOnBackdrop`)으로 onClose 호출. 패널 내부 클릭은 전파 차단.
 *
 * 제어형(controlled): `open`이 false면 null을 렌더한다 — consumer는 조건부 렌더 없이
 * `<Dialog open={x}>`로 쓰면 닫힘 시 focus 복원이 정확히 동작한다.
 *
 * onClose는 "닫기 의도"일 뿐 강제 닫힘이 아니다 — consumer가 `open`을 제어하므로, 진행 중
 * 작업 등으로 닫지 않으려면 onClose 핸들러에서 무시하면 된다(예: 삭제 중 closeModal no-op).
 *
 * ⚠️ 알려진 한계: CSS(display:none/visibility)로만 숨긴 focusable은 trap 후보에서 제외하지
 * 않는다(`disabled`/`[hidden]`만 제외). 두 소비 모달엔 그런 요소가 없다.
 */

import { useCallback, useEffect, useRef, type ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** aria-labelledby 대상 id(제목 요소에 동일 id 부여). useId로 생성해 주입 권장. */
  labelledById?: string;
  /** ESC로 onClose 호출(기본 true). */
  closeOnEscape?: boolean;
  /** 백드롭 클릭으로 onClose 호출(기본 true). */
  closeOnBackdrop?: boolean;
  /** 백드롭(오버레이) className — 위치/배경/z-index. */
  backdropClassName?: string;
  /** 다이얼로그 패널 className. */
  className?: string;
  children: ReactNode;
}

const DEFAULT_BACKDROP =
  "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** 패널 내 focusable 요소(순서대로). disabled/[hidden]은 제외. */
function getFocusable(panel: HTMLElement): HTMLElement[] {
  return Array.from(
    panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter((el) => !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true");
}

export function Dialog({
  open,
  onClose,
  labelledById,
  closeOnEscape = true,
  closeOnBackdrop = true,
  backdropClassName = DEFAULT_BACKDROP,
  className,
  children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  // 열릴 때 opener 저장 + 초기 포커스, 닫힐 때 opener 복원.
  useEffect(() => {
    if (!open) return;
    openerRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const panel = panelRef.current;
    if (panel) {
      const focusables = getFocusable(panel);
      (focusables[0] ?? panel).focus();
    }
    return () => {
      openerRef.current?.focus?.();
    };
  }, [open]);

  // ESC + Tab focus-trap (capture 단계 — 내부 핸들러보다 먼저 가로채기).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (closeOnEscape) {
          e.stopPropagation();
          onClose();
        }
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = getFocusable(panel);
      if (focusables.length === 0) {
        // focusable이 0개(예: 전부 disabled)면 포커스를 패널에 묶어 밖으로 못 나가게 한다.
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !panel.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, closeOnEscape, onClose]);

  const handleBackdropClick = useCallback(() => {
    if (closeOnBackdrop) onClose();
  }, [closeOnBackdrop, onClose]);

  if (!open) return null;

  return (
    <div className={backdropClassName} onClick={handleBackdropClick}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledById}
        tabIndex={-1}
        className={className}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
