"use client";

/**
 * LiveKitRoomProvider
 *
 * @livekit/components-react의 LiveKitRoom을 래핑하여
 * 토큰 페칭, 연결 상태 관리, 에러 처리를 통합 제공
 *
 * 핵심: 토큰 유무와 관계없이 동일한 컴포넌트 트리 유지
 * connect prop으로 연결 여부만 제어하여 언마운트/리마운트 방지
 */

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import type { RoomOptions } from "livekit-client";
import { LiveKitMediaInternalProvider } from "./LiveKitMediaContext";
import {
  LIVEKIT_URL,
  IS_DEV,
  SKIP_LIVEKIT_ENV,
  AUTO_SKIP_IN_DEV,
  SERVER_CHECK_TIMEOUT_MS,
} from "./livekit-constants";

const LiveKitRoom = dynamic(
  () => import("@livekit/components-react").then((mod) => mod.LiveKitRoom),
  { ssr: false }
);

interface TokenResponse {
  token: string;
  participantId: string;
  participantName: string;
}

interface LiveKitRoomProviderProps {
  spaceId: string;
  participantId: string;
  participantName: string;
  sessionToken?: string;
  children: ReactNode;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  onParticipantIdResolved?: (resolvedId: string) => void;
}

interface LiveKitProviderState {
  isConnecting: boolean;
  isConnected: boolean;
  connectionError: string | null;
  effectiveParticipantId: string | null;
}

export function LiveKitRoomProvider({
  spaceId,
  participantId,
  participantName,
  sessionToken,
  children,
  onConnected,
  onDisconnected,
  onError,
  onParticipantIdResolved,
}: LiveKitRoomProviderProps) {
  const [token, setToken] = useState<string | null>(null);
  const [, setState] = useState<LiveKitProviderState>({
    isConnecting: true,
    isConnected: false,
    connectionError: null,
    effectiveParticipantId: null,
  });

  // Fetch token from API
  const fetchToken = useCallback(async () => {
    try {
      setState((prev) => ({
        ...prev,
        isConnecting: true,
        connectionError: null,
      }));

      const response = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName: `space-${spaceId}`,
          participantName,
          participantId,
          sessionToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || "Failed to get LiveKit token"
        );
      }

      const data: TokenResponse = await response.json();
      setToken(data.token);
      setState((prev) => ({
        ...prev,
        effectiveParticipantId: data.participantId,
        isConnecting: false,
      }));

      if (
        onParticipantIdResolved &&
        data.participantId !== participantId
      ) {
        onParticipantIdResolved(data.participantId);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Connection failed";
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        connectionError: errorMessage,
      }));

      if (onError && error instanceof Error) {
        onError(error);
      }
    }
  }, [
    spaceId,
    participantId,
    participantName,
    sessionToken,
    onParticipantIdResolved,
    onError,
  ]);

  // Check if LiveKit server is available (dev mode only)
  const checkServerAvailability =
    useCallback(async (): Promise<boolean> => {
      if (SKIP_LIVEKIT_ENV) {
        setState((prev) => ({
          ...prev,
          isConnecting: false,
          connectionError: null,
        }));
        return false;
      }

      if (!AUTO_SKIP_IN_DEV) {
        return true;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          SERVER_CHECK_TIMEOUT_MS
        );
        await fetch("http://localhost:7880", {
          signal: controller.signal,
          mode: "no-cors",
        });
        clearTimeout(timeoutId);
        return true;
      } catch {
        if (IS_DEV) {
          console.info(
            "[LiveKitProvider] 개발 모드: 서버 미실행 상태, 비디오/오디오 기능 비활성화"
          );
        }
        setState((prev) => ({
          ...prev,
          isConnecting: false,
          connectionError: "LiveKit server not running",
        }));
        return false;
      }
    }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const isAvailable = await checkServerAvailability();
      if (mounted && isAvailable) {
        await fetchToken();
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [checkServerAvailability, fetchToken]);

  const roomOptions = useMemo(
    (): RoomOptions => ({
      adaptiveStream: false,
      dynacast: true,
    }),
    []
  );

  const handleConnected = useCallback(() => {
    setState((prev) => ({ ...prev, isConnected: true }));
    onConnected?.();
  }, [onConnected]);

  const handleDisconnected = useCallback(() => {
    setState((prev) => ({ ...prev, isConnected: false }));
    onDisconnected?.();
  }, [onDisconnected]);

  const handleError = useCallback(
    (error: Error) => {
      console.error("[LiveKitProvider] Room error:", error);
      setState((prev) => ({
        ...prev,
        connectionError: error.message,
      }));
      onError?.(error);
    },
    [onError]
  );

  return (
    <LiveKitRoom
      token={token || ""}
      serverUrl={LIVEKIT_URL}
      connect={!!token}
      options={roomOptions}
      onConnected={handleConnected}
      onDisconnected={handleDisconnected}
      onError={handleError}
    >
      <LiveKitMediaInternalProvider>
        {children}
      </LiveKitMediaInternalProvider>
    </LiveKitRoom>
  );
}
