"use client";

import { useState, useCallback, useEffect } from "react";
import type { PartsAvatarConfig } from "@/features/space/avatar";
import { DEFAULT_PARTS_AVATAR, buildPartsAvatarString, parseAvatarString } from "@/features/space/avatar";
import { CharacterEditor } from "@/components/avatar";

interface AvatarEditorModalProps {
  currentAvatar: string;
  onSave: (avatarString: string) => void;
  onClose: () => void;
}

interface CharacterAsset {
  id: string;
  name: string;
  thumbnailPath: string | null;
}

type AvatarTab = "parts" | "ai";

export function AvatarEditorModal({ currentAvatar, onSave, onClose }: AvatarEditorModalProps) {
  // 현재 아바타가 parts 타입이면 파싱, 아니면 기본값
  const parsed = parseAvatarString(currentAvatar);
  const initialConfig: PartsAvatarConfig =
    parsed.type === "parts" ? parsed : DEFAULT_PARTS_AVATAR;

  const [tab, setTab] = useState<AvatarTab>(
    parsed.type === "custom" ? "ai" : "parts"
  );
  const [config, setConfig] = useState<PartsAvatarConfig>(initialConfig);
  const [selectedCustomId, setSelectedCustomId] = useState<string | null>(
    parsed.type === "custom" ? parsed.textureKey.replace("character_", "") : null
  );
  const [aiCharacters, setAiCharacters] = useState<CharacterAsset[]>([]);
  const [saving, setSaving] = useState(false);

  // AI 캐릭터 목록 로드
  useEffect(() => {
    if (tab !== "ai") return;
    let cancelled = false;

    fetch("/api/assets?status=COMPLETED&type=CHARACTER&limit=50")
      .then((res) => (res.ok ? res.json() : { assets: [] }))
      .then((data: { assets: CharacterAsset[] }) => {
        if (!cancelled) setAiCharacters(data.assets);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [tab]);

  const handleSave = useCallback(async () => {
    setSaving(true);

    let avatarString: string;
    if (tab === "ai" && selectedCustomId) {
      avatarString = `custom:character_${selectedCustomId}`;
    } else {
      avatarString = buildPartsAvatarString(config);
    }

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
  }, [tab, selectedCustomId, config, onSave, onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <div className="mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">캐릭터 편집</h2>
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

        {/* Tab selector */}
        <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setTab("parts")}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "parts"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            파츠 조합
          </button>
          <button
            type="button"
            onClick={() => setTab("ai")}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "ai"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            AI 캐릭터
          </button>
        </div>

        {/* Tab content */}
        {tab === "parts" ? (
          <CharacterEditor initialConfig={initialConfig} onChange={setConfig} />
        ) : (
          <div className="min-h-[200px]">
            {aiCharacters.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">
                아직 생성된 AI 캐릭터가 없습니다
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {aiCharacters.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() =>
                      setSelectedCustomId(selectedCustomId === ch.id ? null : ch.id)
                    }
                    className={`flex flex-col items-center rounded-lg border-2 p-2 transition-colors ${
                      selectedCustomId === ch.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {ch.thumbnailPath ? (
                      <img
                        src={ch.thumbnailPath}
                        alt={ch.name}
                        className="h-14 w-14 object-cover"
                        style={{ imageRendering: "pixelated" }}
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
                        ?
                      </div>
                    )}
                    <span className="mt-1 w-full truncate text-center text-[10px] text-gray-600">
                      {ch.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || (tab === "ai" && !selectedCustomId)}
            className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "적용"}
          </button>
        </div>
      </div>
    </div>
  );
}
