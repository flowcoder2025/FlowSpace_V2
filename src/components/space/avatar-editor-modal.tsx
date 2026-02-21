"use client";

import { useState, useCallback } from "react";
import type { PartsAvatarConfig } from "@/features/space/avatar";
import { DEFAULT_PARTS_AVATAR, buildPartsAvatarString, parseAvatarString } from "@/features/space/avatar";
import { CharacterEditor } from "@/components/avatar";

interface AvatarEditorModalProps {
  currentAvatar: string;
  onSave: (avatarString: string) => void;
  onClose: () => void;
}

export function AvatarEditorModal({ currentAvatar, onSave, onClose }: AvatarEditorModalProps) {
  // 현재 아바타가 parts 타입이면 파싱, 아니면 기본값
  const parsed = parseAvatarString(currentAvatar);
  const initialConfig: PartsAvatarConfig =
    parsed.type === "parts" ? parsed : DEFAULT_PARTS_AVATAR;

  const [config, setConfig] = useState<PartsAvatarConfig>(initialConfig);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const avatarString = buildPartsAvatarString(config);

    try {
      // DB 저장
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarConfig: { avatarString } }),
      });

      if (res.ok) {
        onSave(avatarString);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }, [config, onSave, onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <div className="mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Edit Character</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <CharacterEditor initialConfig={initialConfig} onChange={setConfig} />

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
