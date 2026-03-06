"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { PartsAvatarConfig } from "@/features/space/avatar";
import { DEFAULT_PARTS_AVATAR, buildPartsAvatarString, parseAvatarString, CHIBI_CHARACTERS } from "@/features/space/avatar";
import { PLAYER_WIDTH, PLAYER_HEIGHT } from "@/constants/game-constants";
import { CharacterEditor } from "@/components/avatar";

interface AvatarEditorModalProps {
  currentAvatar: string;
  onSave: (avatarString: string) => void;
  onClose: () => void;
}

type AvatarTab = "parts" | "ai";

export function AvatarEditorModal({ currentAvatar, onSave, onClose }: AvatarEditorModalProps) {
  // 현재 아바타가 parts 타입이면 파싱, 아니면 기본값
  const parsed = parseAvatarString(currentAvatar);
  const initialConfig: PartsAvatarConfig =
    parsed.type === "parts" ? parsed : DEFAULT_PARTS_AVATAR;

  const [tab, setTab] = useState<AvatarTab>(
    parsed.type === "chibi" ? "ai" : "parts"
  );
  const [config, setConfig] = useState<PartsAvatarConfig>(initialConfig);
  const [selectedChibiId, setSelectedChibiId] = useState<string | null>(
    parsed.type === "chibi" ? parsed.characterId : null
  );
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);

    let avatarString: string;
    if (tab === "ai" && selectedChibiId) {
      avatarString = `chibi:${selectedChibiId}`;
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
  }, [tab, selectedChibiId, config, onSave, onClose]);

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
            <div className="grid grid-cols-4 gap-2">
              {CHIBI_CHARACTERS.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() =>
                    setSelectedChibiId(selectedChibiId === ch.id ? null : ch.id)
                  }
                  className={`flex flex-col items-center rounded-lg border-2 p-2 transition-colors ${
                    selectedChibiId === ch.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <ChibiThumbnail spritePath={ch.spritePath} alt={ch.name} />
                  <span className="mt-1 w-full truncate text-center text-[10px] text-gray-600">
                    {ch.name}
                  </span>
                </button>
              ))}
            </div>
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
            disabled={saving || (tab === "ai" && !selectedChibiId)}
            className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "적용"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 스프라이트시트 첫 프레임(정면 idle)을 canvas로 추출하여 썸네일 표시 */
function ChibiThumbnail({ spritePath, alt }: { spritePath: string; alt: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = spritePath;
    img.onload = () => {
      canvas.width = PLAYER_WIDTH;
      canvas.height = PLAYER_HEIGHT;
      ctx.clearRect(0, 0, PLAYER_WIDTH, PLAYER_HEIGHT);
      ctx.drawImage(img, 0, 0, PLAYER_WIDTH, PLAYER_HEIGHT, 0, 0, PLAYER_WIDTH, PLAYER_HEIGHT);
    };
  }, [spritePath]);

  return (
    <canvas
      ref={canvasRef}
      width={PLAYER_WIDTH}
      height={PLAYER_HEIGHT}
      className="h-16 w-12 object-contain"
      style={{ imageRendering: "pixelated" }}
      aria-label={alt}
    />
  );
}
