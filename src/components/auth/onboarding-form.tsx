"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { PartsAvatarConfig } from "@/features/space/avatar";
import { DEFAULT_PARTS_AVATAR, buildPartsAvatarString } from "@/features/space/avatar";
import { CharacterEditor } from "@/components/avatar";

interface OnboardingFormProps {
  userId: string;
  currentName: string;
  currentImage: string;
}

export function OnboardingForm({
  currentName,
  currentImage,
}: OnboardingFormProps) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [avatarConfig, setAvatarConfig] = useState<PartsAvatarConfig>(DEFAULT_PARTS_AVATAR);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAvatarChange = useCallback((config: PartsAvatarConfig) => {
    setAvatarConfig(config);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const avatarString = buildPartsAvatarString(avatarConfig);

      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          avatarConfig: { avatarString },
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
        {/* Profile Image (OAuth) */}
        {currentImage && (
          <div className="flex justify-center">
            <img
              src={currentImage}
              alt="Profile"
              className="h-16 w-16 rounded-full"
            />
          </div>
        )}

        {/* Character Editor */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Customize Your Character
          </label>
          <CharacterEditor
            initialConfig={avatarConfig}
            onChange={handleAvatarChange}
          />
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
