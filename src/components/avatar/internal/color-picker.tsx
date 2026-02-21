"use client";

const PRESET_COLORS = [
  "#c04040", "#e06030", "#e0b040", "#40a040",
  "#4060c0", "#8040a0", "#e080b0", "#404040",
  "#ffffff", "#303030", "#2196F3", "#FF5722",
  "#009688", "#795548", "#607D8B", "#e0e0e0",
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  return (
    <div className="space-y-2">
      {label && (
        <span className="text-xs font-medium text-gray-600">{label}</span>
      )}
      <div className="flex flex-wrap gap-1.5">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={`h-6 w-6 rounded-full border-2 transition-transform ${
              value.toLowerCase() === color.toLowerCase()
                ? "scale-110 border-blue-500"
                : "border-gray-200 hover:scale-105"
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
        {/* 커스텀 색상 */}
        <label
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-[10px] text-gray-400 hover:border-gray-400"
          title="Custom color"
        >
          +
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
          />
        </label>
      </div>
    </div>
  );
}
