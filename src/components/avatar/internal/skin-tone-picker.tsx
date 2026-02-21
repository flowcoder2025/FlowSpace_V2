"use client";

const SKIN_TONES = [
  "#fce4c0", "#f5d0a9", "#e8b88a", "#d4a574",
  "#c08c5a", "#a0724a", "#805a3a", "#604430",
];

interface SkinTonePickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function SkinTonePicker({ value, onChange }: SkinTonePickerProps) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-gray-600">Skin Tone</span>
      <div className="flex gap-1.5">
        {SKIN_TONES.map((tone) => (
          <button
            key={tone}
            type="button"
            onClick={() => onChange(tone)}
            className={`h-7 w-7 rounded-full border-2 transition-transform ${
              value.toLowerCase() === tone.toLowerCase()
                ? "scale-110 border-blue-500"
                : "border-gray-200 hover:scale-105"
            }`}
            style={{ backgroundColor: tone }}
          />
        ))}
      </div>
    </div>
  );
}
