"use client";

interface EditorToggleButtonProps {
  isEditorMode: boolean;
  canEdit: boolean;
  onToggle: () => void;
}

export default function EditorToggleButton({
  isEditorMode,
  canEdit,
  onToggle,
}: EditorToggleButtonProps) {
  if (!canEdit) return null;

  return (
    <button
      onClick={onToggle}
      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
        isEditorMode
          ? "bg-emerald-500 text-cream hover:bg-emerald-400"
          : "bg-cream/10 text-cream hover:bg-cream/20"
      }`}
    >
      {isEditorMode ? "에디터 닫기" : "맵 편집"}
    </button>
  );
}
