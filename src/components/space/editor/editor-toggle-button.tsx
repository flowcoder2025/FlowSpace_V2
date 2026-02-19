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
      className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
        isEditorMode
          ? "bg-emerald-600 text-white hover:bg-emerald-700"
          : "bg-gray-700 text-gray-200 hover:bg-gray-600"
      }`}
    >
      {isEditorMode ? "Exit Editor" : "Edit Map"}
    </button>
  );
}
