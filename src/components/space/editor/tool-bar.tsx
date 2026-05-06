"use client";

import type { EditorTool } from "@/features/space/editor";

interface ToolBarProps {
  activeTool: EditorTool;
  onToolChange: (tool: EditorTool) => void;
}

const TOOLS: { tool: EditorTool; label: string; icon: string }[] = [
  { tool: "paint", label: "Paint", icon: "P" },
  { tool: "erase", label: "Erase", icon: "E" },
  { tool: "select", label: "Select", icon: "S" },
  { tool: "object-place", label: "Object", icon: "O" },
];

export default function ToolBar({ activeTool, onToolChange }: ToolBarProps) {
  return (
    <div className="flex gap-1">
      {TOOLS.map(({ tool, label, icon }) => (
        <button
          key={tool}
          onClick={() => onToolChange(tool)}
          title={label}
          className={`flex h-8 w-8 items-center justify-center rounded text-xs font-bold transition-colors ${
            activeTool === tool
              ? "bg-emerald-600 text-white"
              : "bg-cream/10 text-ink-light hover:bg-cream/15"
          }`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
