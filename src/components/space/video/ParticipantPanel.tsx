"use client";

/**
 * ParticipantPanel - 참가자 목록 패널
 *
 * 기능:
 * - 사이드바/그리드/숨김 뷰 모드
 * - 이름 기반 정렬
 * - 화면공유 우선 표시
 * - 모든 오디오 트랙 수집 (녹화용)
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { VideoTile } from "./VideoTile";
import type { ParticipantTrack } from "@/features/space/livekit";

export type ViewMode = "sidebar" | "grid" | "hidden";

interface ParticipantPanelProps {
  participantTracks: Map<string, ParticipantTrack>;
  localParticipantId: string | null;
  spaceName?: string;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  spotlightUsers?: Set<string>;
  globalOutputVolume?: number;
  mirrorLocalVideo?: boolean;
}

export function ParticipantPanel({
  participantTracks,
  localParticipantId,
  spaceName = "Space",
  viewMode: externalViewMode,
  onViewModeChange,
  spotlightUsers = new Set(),
  globalOutputVolume = 100,
  mirrorLocalVideo = true,
}: ParticipantPanelProps) {
  const [internalViewMode, setInternalViewMode] =
    useState<ViewMode>("sidebar");

  const viewMode = externalViewMode ?? internalViewMode;
  const setViewMode = onViewModeChange ?? setInternalViewMode;

  // Sort: screen shares first, then alphabetical
  const sortedTracks = useMemo(() => {
    const all = Array.from(participantTracks.values());

    return all.sort((a, b) => {
      const aHasScreen = !!a.screenTrack;
      const bHasScreen = !!b.screenTrack;
      if (aHasScreen && !bHasScreen) return -1;
      if (!aHasScreen && bHasScreen) return 1;

      const aIsLocal = a.participantId === localParticipantId;
      const bIsLocal = b.participantId === localParticipantId;
      if (aIsLocal && !bIsLocal) return -1;
      if (!aIsLocal && bIsLocal) return 1;

      return a.participantName.localeCompare(
        b.participantName,
        "ko"
      );
    });
  }, [participantTracks, localParticipantId]);

  // Collect all audio tracks for recording
  const allAudioTracks = useMemo(() => {
    const tracks: MediaStreamTrack[] = [];
    participantTracks.forEach((track) => {
      if (track.audioTrack) {
        tracks.push(track.audioTrack);
      }
    });
    return tracks;
  }, [participantTracks]);

  if (viewMode === "hidden") return null;

  return (
    <div
      className={cn(
        "flex flex-col bg-gray-900/95 backdrop-blur-sm",
        viewMode === "sidebar" &&
          "h-full w-64 border-l border-gray-800",
        viewMode === "grid" && "w-full"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-3 py-2">
        <span className="text-sm font-medium text-white">
          참가자 ({participantTracks.size})
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() =>
              setViewMode(
                viewMode === "sidebar" ? "grid" : "sidebar"
              )
            }
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
            title={
              viewMode === "sidebar"
                ? "그리드 뷰"
                : "사이드바 뷰"
            }
          >
            <svg
              className="size-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {viewMode === "sidebar" ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7"
                />
              )}
            </svg>
          </button>
          <button
            onClick={() => setViewMode("hidden")}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
            title="패널 숨기기"
          >
            <svg
              className="size-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Participant tiles */}
      <div
        className={cn(
          "flex-1 overflow-y-auto p-2",
          viewMode === "sidebar" && "space-y-2",
          viewMode === "grid" &&
            "grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        )}
      >
        {sortedTracks.map((track) => {
          const isLocal =
            track.participantId === localParticipantId;
          const hasScreenShare = !!track.screenTrack;

          return (
            <div key={track.participantId}>
              {/* Screen share tile (priority) */}
              {hasScreenShare && (
                <div className="mb-2">
                  <VideoTile
                    track={track}
                    isLocal={isLocal}
                    isScreenShare
                    canRecord
                    spaceName={spaceName}
                    allAudioTracks={allAudioTracks}
                    globalOutputVolume={globalOutputVolume}
                    isSpotlight={spotlightUsers.has(
                      track.participantId
                    )}
                  />
                </div>
              )}
              {/* Camera tile */}
              <VideoTile
                track={track}
                isLocal={isLocal}
                spaceName={spaceName}
                allAudioTracks={allAudioTracks}
                globalOutputVolume={globalOutputVolume}
                mirrorLocalVideo={mirrorLocalVideo}
                isSpotlight={spotlightUsers.has(
                  track.participantId
                )}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
