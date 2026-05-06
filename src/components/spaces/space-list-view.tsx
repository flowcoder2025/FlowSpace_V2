"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSpaceStore } from "@/stores/space-store";
import { SpaceCard } from "./space-card";

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "owned", label: "내가 만든" },
  { key: "joined", label: "참여 중" },
] as const;

export function SpaceListView() {
  const router = useRouter();
  const { spaces, isLoading, filter, setFilter, fetchSpaces } =
    useSpaceStore();

  useEffect(() => {
    fetchSpaces();
  }, [fetchSpaces]);

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-1 rounded-lg border border-line bg-cream-deep/40 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === f.key
                  ? "bg-cream text-ink shadow-sm"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => router.push("/spaces/new")}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-brand-deep"
        >
          새 스페이스
          <span aria-hidden="true">+</span>
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : spaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-cream-deep/30 py-20 px-6 text-center">
          <h3 className="font-serif text-xl font-medium text-ink">
            아직 스페이스가 없습니다
          </h3>
          <p className="mt-2 max-w-sm text-sm text-ink-muted">
            첫 스페이스를 만들거나, 초대 링크로 다른 공간에 입장하세요.
          </p>
          <button
            onClick={() => router.push("/spaces/new")}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-brand-deep"
          >
            첫 스페이스 만들기
            <span aria-hidden="true">→</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map((space) => (
            <SpaceCard key={space.id} space={space} />
          ))}
        </div>
      )}
    </div>
  );
}
