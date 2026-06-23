"use client";

/**
 * ParticipantPanel - 통합 참가자 패널
 *
 * 소켓 플레이어 + LiveKit 미디어 참가자를 하나의 패널에 표시
 * - 미디어 참가자: 비디오 타일 (카메라/화면공유)
 * - 미디어 없는 플레이어: 아바타 리스트
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { VideoTile } from "./VideoTile";
import { MemberActionsMenu } from "../member-actions-menu";
import { useSpaceMembers, managedUserIdFromIdentity } from "../use-space-members";
import type { ParticipantTrack } from "@/features/space/livekit";

export type ViewMode = "sidebar" | "grid" | "hidden";

interface PlayerInfo {
  userId: string;
  nickname: string;
}

interface ParticipantPanelProps {
  participantTracks: Map<string, ParticipantTrack>;
  localParticipantId: string | null;
  spaceId: string;
  spaceName?: string;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  spotlightUsers?: Set<string>;
  globalOutputVolume?: number;
  mirrorLocalVideo?: boolean;
  players?: PlayerInfo[];
  currentUserId?: string;
  currentNickname?: string;
}

export function ParticipantPanel({
  participantTracks,
  localParticipantId,
  spaceId,
  spaceName = "Space",
  viewMode: externalViewMode,
  onViewModeChange,
  spotlightUsers = new Set(),
  globalOutputVolume = 100,
  mirrorLocalVideo = true,
  players = [],
  currentUserId,
  currentNickname,
}: ParticipantPanelProps) {
  const [internalViewMode, setInternalViewMode] =
    useState<ViewMode>("sidebar");

  const viewMode = externalViewMode ?? internalViewMode;
  const setViewMode = onViewModeChange ?? setInternalViewMode;

  // 멤버 관리 스냅샷 — 패널이 보일 때만 조회(GET 403이면 관리 UI 자연 숨김).
  const { membersByUserId, actorRole, refetch } = useSpaceMembers(
    spaceId,
    currentUserId ?? "",
    viewMode !== "hidden" && !!currentUserId
  );

  // 미디어 참가자 ID set
  const mediaParticipantIds = useMemo(
    () => new Set(participantTracks.keys()),
    [participantTracks]
  );

  // 미디어 없는 플레이어 (소켓만 연결)
  const nonMediaPlayers = useMemo(() => {
    // localParticipantId 형식: "user-{userId}" or just "{userId}"
    const normalizeId = (id: string) => id.replace(/^(user-|guest-)/, "");
    const mediaUserIds = new Set(
      Array.from(mediaParticipantIds).map(normalizeId)
    );

    const result: Array<{ id: string; nickname: string; isSelf: boolean }> = [];

    // 자기 자신 (미디어에 없을 때만)
    if (currentUserId && !mediaUserIds.has(currentUserId)) {
      result.push({ id: currentUserId, nickname: currentNickname || "나", isSelf: true });
    }

    // 다른 플레이어 (미디어에 없는 사람만)
    for (const p of players) {
      if (!mediaUserIds.has(p.userId) && p.userId !== currentUserId) {
        result.push({ id: p.userId, nickname: p.nickname, isSelf: false });
      }
    }

    return result;
  }, [players, mediaParticipantIds, currentUserId, currentNickname]);

  // 미디어 참가자 정렬
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

      return a.participantName.localeCompare(b.participantName, "ko");
    });
  }, [participantTracks, localParticipantId]);

  const allAudioTracks = useMemo(() => {
    const tracks: MediaStreamTrack[] = [];
    participantTracks.forEach((track) => {
      if (track.audioTrack) tracks.push(track.audioTrack);
    });
    return tracks;
  }, [participantTracks]);

  const totalCount = participantTracks.size + nonMediaPlayers.length;

  if (viewMode === "hidden") return null;

  return (
    <div
      className={cn(
        "flex flex-col bg-ink/85 backdrop-blur-md",
        viewMode === "sidebar" && "h-full w-64 border-l border-cream/10",
        viewMode === "grid" && "w-full"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cream/10 px-3 py-2">
        <span className="text-sm font-medium text-cream">
          참가자 ({totalCount})
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() =>
              setViewMode(viewMode === "sidebar" ? "grid" : "sidebar")
            }
            className="rounded p-1 text-cream/60 transition-colors hover:bg-cream/15 hover:text-cream"
            title={viewMode === "sidebar" ? "그리드 뷰" : "사이드바 뷰"}
          >
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {viewMode === "sidebar" ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7"
                />
              )}
            </svg>
          </button>
          <button
            onClick={() => setViewMode("hidden")}
            className="rounded p-1 text-cream/60 transition-colors hover:bg-cream/15 hover:text-cream"
            title="패널 숨기기"
          >
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className={cn(
          "flex-1 overflow-y-auto p-2",
          viewMode === "sidebar" && "space-y-2",
          viewMode === "grid" && "grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        )}
      >
        {/* Media participants (video tiles) */}
        {sortedTracks.map((track) => {
          const isLocal = track.participantId === localParticipantId;
          const hasScreenShare = !!track.screenTrack;

          // LiveKit identity → 관리 대상 userId (user- 접두사만; guest-/dev-는 null).
          const mediaUserId = managedUserIdFromIdentity(track.participantId);
          const mediaMember = mediaUserId
            ? membersByUserId.get(mediaUserId) ?? null
            : null;

          return (
            <div key={track.participantId}>
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
                    isSpotlight={spotlightUsers.has(track.participantId)}
                  />
                </div>
              )}
              <VideoTile
                track={track}
                isLocal={isLocal}
                spaceName={spaceName}
                allAudioTracks={allAudioTracks}
                globalOutputVolume={globalOutputVolume}
                mirrorLocalVideo={mirrorLocalVideo}
                isSpotlight={spotlightUsers.has(track.participantId)}
                actionsSlot={
                  <MemberActionsMenu
                    spaceId={spaceId}
                    target={{ userId: mediaUserId ?? "", nickname: track.participantName }}
                    member={mediaMember}
                    actorRole={actorRole}
                    currentUserId={currentUserId ?? ""}
                    onActionDone={refetch}
                    align="left"
                    // LiveKit room 참가자 → 음성 강제 음소거 가능(track.participantId = identity).
                    participantIdentity={track.participantId}
                  />
                }
              />
            </div>
          );
        })}

        {/* Non-media players (avatar list) */}
        {nonMediaPlayers.length > 0 && sortedTracks.length > 0 && (
          <div className="border-t border-cream/10 pt-2 mt-1" />
        )}
        {nonMediaPlayers.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-sm"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-cream/15 text-xs text-cream">
              {p.nickname.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-1 items-center gap-1.5 truncate">
              <span className="size-2 shrink-0 rounded-full bg-green-400" />
              <span className="truncate text-ink-light">{p.nickname}</span>
              {p.isSelf && (
                <span className="shrink-0 text-xs text-ink-muted">(나)</span>
              )}
            </div>
            {!p.isSelf && (
              <MemberActionsMenu
                spaceId={spaceId}
                target={{ userId: p.id, nickname: p.nickname }}
                member={membersByUserId.get(p.id) ?? null}
                actorRole={actorRole}
                currentUserId={currentUserId ?? ""}
                onActionDone={refetch}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
