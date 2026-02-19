"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface OnboardingFormProps {
  userId: string;
  currentName: string;
  currentImage: string;
}

const AVATAR_COLORS = [
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#6B7280",
];

export function OnboardingForm({
  currentName,
  currentImage,
}: OnboardingFormProps) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[4]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          avatarConfig: { color: selectedColor },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update profile");
        return;
      }

      router.push("/my-spaces");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Avatar Preview */}
        <div className="flex flex-col items-center gap-3">
          {currentImage ? (
            <img
              src={currentImage}
              alt="Profile"
              className="h-20 w-20 rounded-full"
            />
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white"
              style={{ backgroundColor: selectedColor }}
            >
              {name ? name[0].toUpperCase() : "?"}
            </div>
          )}

          {/* Color Picker */}
          {!currentImage && (
            <div className="flex gap-2">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`h-8 w-8 rounded-full transition-transform ${
                    selectedColor === color
                      ? "scale-110 ring-2 ring-offset-2 ring-blue-500"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Name */}
        <div>
          <label
            htmlFor="display-name"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Display Name
          </label>
          <input
            id="display-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What should we call you?"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Saving..." : "Get Started"}
        </button>
      </form>
    </div>
  );
}
