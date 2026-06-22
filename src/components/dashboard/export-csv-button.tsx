"use client";

/**
 * 대시보드 CSV 내보내기 버튼 (WI-031). 멤버/로그/analytics 페이지에서 공용 — 동일
 * 스타일·동작을 한 곳에 둔다. 라벨은 페이지별로 다르다(로그는 로드된 건수 노출).
 */
interface ExportCsvButtonProps {
  onExport: () => void;
  disabled?: boolean;
  label?: string;
}

export function ExportCsvButton({
  onExport,
  disabled,
  label = "CSV 내보내기",
}: ExportCsvButtonProps) {
  return (
    <button
      type="button"
      onClick={onExport}
      disabled={disabled}
      aria-label="CSV 내보내기"
      className="text-sm border border-line rounded px-3 py-1.5 text-ink hover:text-brand-deep disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  );
}
