"use client";

import type { EditorMapObject } from "@/features/space/editor";

interface PropertyPanelProps {
  object: EditorMapObject | null;
  onDelete: (id: string) => void;
  onLinkPortal?: (sourceId: string) => void;
}

export default function PropertyPanel({
  object,
  onDelete,
  onLinkPortal,
}: PropertyPanelProps) {
  if (!object) return null;

  return (
    <div className="space-y-2 rounded bg-gray-800 p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        Properties
      </div>

      <div className="space-y-1 text-xs text-gray-300">
        <div className="flex justify-between">
          <span className="text-gray-500">Type</span>
          <span>{object.objectType}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Position</span>
          <span>
            {Math.floor(object.positionX)}, {Math.floor(object.positionY)}
          </span>
        </div>
        {object.label && (
          <div className="flex justify-between">
            <span className="text-gray-500">Label</span>
            <span>{object.label}</span>
          </div>
        )}
        {object.linkedObjectId && (
          <div className="flex justify-between">
            <span className="text-gray-500">Linked</span>
            <span className="truncate text-emerald-400">
              {object.linkedObjectId.slice(0, 8)}...
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-1">
        {object.objectType === "portal" && onLinkPortal && (
          <button
            onClick={() => onLinkPortal(object.id)}
            className="flex-1 rounded bg-blue-700 px-2 py-1 text-xs text-white hover:bg-blue-600"
          >
            Link Portal
          </button>
        )}
        <button
          onClick={() => onDelete(object.id)}
          className="flex-1 rounded bg-red-700 px-2 py-1 text-xs text-white hover:bg-red-600"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
