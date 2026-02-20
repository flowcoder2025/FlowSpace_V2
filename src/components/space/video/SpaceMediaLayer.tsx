"use client";

/**
 * SpaceMediaLayer - LiveKit 컨텍스트 내부에서 미디어 UI 렌더링
 *
 * LiveKitRoomProvider 하위에서 useLiveKitMedia를 호출하여
 * ParticipantPanel, ScreenShareOverlay, 미디어 컨트롤을 통합 제공
 */

import { useState, useMemo, useCallback } from "react";
import { useLiveKitMedia } from "@/features/space/livekit";
import { ParticipantPanel, type ViewMode } from "./ParticipantPanel";
import { ScreenShareOverlay } from "./ScreenShare";
import { cn } from "@/lib/utils";

interface PlayerInfo {
  userId: string;
  nickname: string;
}

interface SpaceMediaLayerProps {
  spaceName: string;
  spotlightUsers: Set<string>;
  isRecording: boolean;
  recorderNickname?: string;
  players?: PlayerInfo[];
  currentUserId?: string;
  currentNickname?: string;
}

export function SpaceMediaLayer({
  spaceName,
  spotlightUsers,
  isRecording,
  recorderNickname,
  players = [],
  currentUserId,
  currentNickname,
}: SpaceMediaLayerProps) {
  const {
    participantTracks,
    mediaState,
    mediaError,
    isAvailable,
    localParticipantId,
    toggleCamera,
    toggleMicrophone,
    toggleScreenShare,
  } = useLiveKitMedia();

  const [viewMode, setViewMode] = useState<ViewMode>("sidebar");
  const [screenShareDismissed, setScreenShareDismissed] = useState<
    Set<string>
  >(new Set());

  // Find active screen share (not dismissed)
  const activeScreenShare = useMemo(() => {
    const entry = Array.from(participantTracks.entries()).find(
      ([id, track]) => track.screenTrack && !screenShareDismissed.has(id)
    );
    return entry ? { id: entry[0], track: entry[1] } : null;
  }, [participantTracks, screenShareDismissed]);

  const allAudioTracks = useMemo(() => {
    const tracks: MediaStreamTrack[] = [];
    participantTracks.forEach((track) => {
      if (track.audioTrack) tracks.push(track.audioTrack);
    });
    return tracks;
  }, [participantTracks]);

  const dismissScreenShare = useCallback(
    (participantId: string) => {
      setScreenShareDismissed((prev) => new Set(prev).add(participantId));
    },
    []
  );

  // Reset dismissed on new screen share
  const handleScreenShareClose = useCallback(() => {
    if (activeScreenShare) {
      dismissScreenShare(activeScreenShare.id);
    }
  }, [activeScreenShare, dismissScreenShare]);

  return (
    <>
      {/* Status banners (stacked vertically to avoid overlap) */}
      {(isRecording || mediaError || !isAvailable) && (
        <div className="pointer-events-none absolute left-1/2 top-14 z-30 flex -translate-x-1/2 flex-col items-center gap-2">
          {isRecording && (
            <div className="flex items-center gap-2 rounded-full bg-red-600/90 px-4 py-1.5 text-white shadow-lg">
              <div className="size-2 animate-pulse rounded-full bg-white" />
              <span className="text-sm font-medium">
                {recorderNickname
                  ? `${recorderNickname}님이 녹화 중`
                  : "녹화 중"}
              </span>
            </div>
          )}
          {mediaError && (
            <div className="pointer-events-auto rounded-lg bg-red-900/90 px-4 py-2 text-sm text-white shadow-lg">
              {mediaError.message}
            </div>
          )}
          {!isAvailable && !mediaError && (
            <div className="rounded-lg bg-gray-800/90 px-4 py-2 text-sm text-gray-300 shadow-lg">
              음성/영상 서버 미연결
            </div>
          )}
        </div>
      )}

      {/* Screen share overlay */}
      {activeScreenShare && (
        <ScreenShareOverlay
          track={activeScreenShare.track}
          isLocal={activeScreenShare.id === localParticipantId}
          spaceName={spaceName}
          allAudioTracks={allAudioTracks}
          onClose={handleScreenShareClose}
        />
      )}

      {/* Participant panel (sidebar) */}
      {viewMode !== "hidden" && (participantTracks.size > 0 || players.length > 0) && (
        <div
          className={cn(
            "absolute right-0 top-0 z-20",
            viewMode === "sidebar" ? "h-full w-64" : "bottom-0 w-full"
          )}
        >
          <ParticipantPanel
            participantTracks={participantTracks}
            localParticipantId={localParticipantId}
            spaceName={spaceName}
            viewMode={viewMode}
            players={players}
            currentUserId={currentUserId}
            currentNickname={currentNickname}
            onViewModeChange={setViewMode}
            spotlightUsers={spotlightUsers}
          />
        </div>
      )}

      {/* Media controls (bottom center) */}
      <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
        <div className={cn(
          "flex items-center gap-2 rounded-full bg-gray-900/90 px-4 py-2 shadow-lg backdrop-blur-sm",
          !isAvailable && "opacity-60"
        )}>
            {/* Microphone toggle */}
            <button
              onClick={toggleMicrophone}
              disabled={!isAvailable}
              className={cn(
                "rounded-full p-2.5 transition-colors",
                !isAvailable
                  ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                  : mediaState.isMicrophoneEnabled
                    ? "bg-gray-700 text-white hover:bg-gray-600"
                    : "bg-red-600 text-white hover:bg-red-500"
              )}
              title={
                !isAvailable
                  ? "서버 미연결"
                  : mediaState.isMicrophoneEnabled
                    ? "마이크 끄기"
                    : "마이크 켜기"
              }
            >
              <svg
                className="size-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                {mediaState.isMicrophoneEnabled ? (
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                ) : (
                  <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                )}
              </svg>
            </button>

            {/* Camera toggle */}
            <button
              onClick={toggleCamera}
              disabled={!isAvailable}
              className={cn(
                "rounded-full p-2.5 transition-colors",
                !isAvailable
                  ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                  : mediaState.isCameraEnabled
                    ? "bg-gray-700 text-white hover:bg-gray-600"
                    : "bg-red-600 text-white hover:bg-red-500"
              )}
              title={
                !isAvailable
                  ? "서버 미연결"
                  : mediaState.isCameraEnabled
                    ? "카메라 끄기"
                    : "카메라 켜기"
              }
            >
              <svg
                className="size-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                {mediaState.isCameraEnabled ? (
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                ) : (
                  <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z" />
                )}
              </svg>
            </button>

            {/* Screen share toggle */}
            <button
              onClick={() => toggleScreenShare()}
              disabled={!isAvailable}
              className={cn(
                "rounded-full p-2.5 transition-colors",
                !isAvailable
                  ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                  : mediaState.isScreenShareEnabled
                    ? "bg-blue-600 text-white hover:bg-blue-500"
                    : "bg-gray-700 text-white hover:bg-gray-600"
              )}
              title={
                !isAvailable
                  ? "서버 미연결"
                  : mediaState.isScreenShareEnabled
                    ? "화면공유 중지"
                    : "화면공유"
              }
            >
              <svg
                className="size-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z" />
              </svg>
            </button>

            {/* Show/hide participant panel */}
            {viewMode === "hidden" && participantTracks.size > 0 && (
              <button
                onClick={() => setViewMode("sidebar")}
                className="rounded-full bg-gray-700 p-2.5 text-white transition-colors hover:bg-gray-600"
                title="참가자 패널 표시"
              >
                <svg
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
    </>
  );
}
