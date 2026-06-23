"use client";

/**
 * DeleteSpaceSection — 설정 화면의 "위험 구역" 스페이스 삭제 UI (WI-037).
 *
 * 이름 타이핑 확인 모달 → `DELETE /api/spaces/[id]`(soft delete=ARCHIVED, WI-036) →
 * 성공 시 `/my-spaces`로 이동(목록은 status=ACTIVE만 반환하므로 archived는 자연 제외).
 *
 * ⚠️ 권한: 이 컴포넌트는 OWNER/superAdmin에게만 렌더된다(설정 페이지에서 canDelete 게이팅).
 * 서버 DELETE 게이트(`space.ownerId === userId || isSuperAdmin`)가 hard gate이고,
 * 클라 게이팅/이름 확인은 best-effort UX다(STAFF는 설정 페이지에 진입해도 미렌더).
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DASHBOARD_COPY } from "@/constants/dashboard-copy";

interface DeleteSpaceSectionProps {
  spaceId: string;
  spaceName: string;
}

const COPY = DASHBOARD_COPY.SETTINGS.dangerZone;

export function DeleteSpaceSection({ spaceId, spaceName }: DeleteSpaceSectionProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 입력값이 스페이스 이름과 정확히 일치할 때만 삭제 활성(되돌릴 수 없는 액션 가드).
  // spaceName.length > 0 가드: 빈 이름 스페이스(PATCH는 비-빈 이름 미강제 → 데이터 드리프트로
  // 발생 가능)에서 빈 입력("")이 즉시 일치해 삭제가 무타이핑 활성되는 것을 차단한다.
  const canConfirm = spaceName.length > 0 && confirmInput === spaceName && !isDeleting;

  const openModal = useCallback(() => {
    setConfirmInput("");
    setError(null);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    // 삭제 진행 중에는 닫기/취소 차단(중도 이탈로 인한 혼동·중복요청 방지).
    if (isDeleting) return;
    setIsOpen(false);
    setConfirmInput("");
    setError(null);
  }, [isDeleting]);

  // ESC로 모달 닫기(dialog 접근성).
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, closeModal]);

  async function handleDelete() {
    if (!canConfirm) return;
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/spaces/${spaceId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || COPY.deleteError);
        setIsDeleting(false);
        return;
      }
      // 성공(이미 archived인 멱등 200 포함) → 목록으로 이동.
      // replace로 삭제된 스페이스의 설정 페이지를 뒤로가기 이력에서 제거한다.
      // isDeleting을 리셋하지 않아 네비게이션 동안 버튼이 잠긴 상태를 유지(중복 제출 방지).
      router.replace("/my-spaces");
    } catch {
      setError(COPY.deleteError);
      setIsDeleting(false);
    }
  }

  return (
    <div className="max-w-2xl rounded-lg border border-red-200 bg-red-50/50 p-6">
      <h2 className="text-base font-semibold text-red-700">{COPY.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{COPY.description}</p>
      <button
        type="button"
        onClick={openModal}
        className="mt-4 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
      >
        {COPY.deleteButton}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-space-title"
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-space-title" className="text-lg font-bold text-ink">
              {COPY.modalTitle}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{COPY.modalWarning}</p>
            <p className="mt-4 text-sm text-ink-soft">{COPY.confirmPrompt}</p>
            <p className="mt-1 select-all break-all rounded bg-cream-deep px-3 py-2 font-mono text-sm text-ink">
              {spaceName}
            </p>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={COPY.confirmPlaceholder}
              autoFocus
              disabled={isDeleting}
              aria-label={COPY.confirmPlaceholder}
              className="mt-3 w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-50"
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={isDeleting}
                className="rounded-md border border-line px-4 py-2 text-sm text-ink-soft transition-colors hover:bg-cream-deep disabled:opacity-50"
              >
                {COPY.cancel}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!canConfirm}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? COPY.deleting : COPY.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
