"use client";

/**
 * useProximitySubscription
 *
 * 근접 기반 LiveKit 트랙 구독 관리 훅
 *
 * 기능:
 * - 7x7 타일 범위 내 플레이어만 오디오/비디오 구독
 * - 거리에 따른 볼륨 감쇠 (선택적)
 * - 파티 존 / 스포트라이트 우선순위 처리
 */

import { useEffect, useCallback, useRef, useMemo } from "react";
import {
  useMaybeRoomContext,
  useRemoteParticipants,
} from "@livekit/components-react";
import {
  Track,
  RemoteParticipant,
  RemoteTrackPublication,
} from "livekit-client";
import {
  DEFAULT_PROXIMITY_RADIUS,
  PROXIMITY_MIN_VOLUME,
  PROXIMITY_THROTTLE_MS,
} from "./livekit-constants";

// ============================================
// Types
// ============================================

export interface Position {
  x: number;
  y: number;
}

export interface ProximityConfig {
  proximityRadius: number;
  enableVolumeAttenuation: boolean;
  minVolume: number;
  updateThrottleMs: number;
  enabled: boolean;
}

export interface UseProximitySubscriptionOptions {
  localPosition: Position | null;
  remotePositions: Map<string, Position>;
  spotlightUsers?: Set<string>;
  partyZoneUsers?: Set<string>;
  config?: Partial<ProximityConfig>;
}

// ============================================
// Default Config
// ============================================

const DEFAULT_CONFIG: ProximityConfig = {
  proximityRadius: DEFAULT_PROXIMITY_RADIUS,
  enableVolumeAttenuation: false,
  minVolume: PROXIMITY_MIN_VOLUME,
  updateThrottleMs: PROXIMITY_THROTTLE_MS,
  enabled: false,
};

// ============================================
// Helpers
// ============================================

function calculateDistance(pos1: Position, pos2: Position): number {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function calculateVolume(
  distance: number,
  maxDistance: number,
  minVolume: number
): number {
  if (distance <= 0) return 1.0;
  if (distance >= maxDistance) return minVolume;
  const ratio = 1 - distance / maxDistance;
  return minVolume + ratio * (1 - minVolume);
}

// ============================================
// Hook
// ============================================

export function useProximitySubscription({
  localPosition,
  remotePositions,
  spotlightUsers = new Set(),
  partyZoneUsers = new Set(),
  config: configOverride,
}: UseProximitySubscriptionOptions) {
  const room = useMaybeRoomContext();
  const remoteParticipants = useRemoteParticipants();

  const config = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...configOverride }),
    [configOverride]
  );

  const lastUpdateRef = useRef<number>(0);

  const subscriptionStates = useMemo(() => {
    const states = new Map<
      string,
      { shouldSubscribe: boolean; volume: number }
    >();

    if (!config.enabled || !localPosition) {
      remoteParticipants.forEach((p) => {
        states.set(p.identity, {
          shouldSubscribe: true,
          volume: 1.0,
        });
      });
      return states;
    }

    remoteParticipants.forEach((participant) => {
      const identity = participant.identity;
      const remotePos = remotePositions.get(identity);

      let shouldSubscribe = false;
      let volume = 1.0;

      if (spotlightUsers.has(identity)) {
        shouldSubscribe = true;
        volume = 1.0;
      } else if (partyZoneUsers.has(identity)) {
        shouldSubscribe = true;
        volume = 1.0;
      } else if (remotePos) {
        const distance = calculateDistance(
          localPosition,
          remotePos
        );
        shouldSubscribe = distance <= config.proximityRadius;

        if (
          shouldSubscribe &&
          config.enableVolumeAttenuation
        ) {
          volume = calculateVolume(
            distance,
            config.proximityRadius,
            config.minVolume
          );
        }
      }

      states.set(identity, { shouldSubscribe, volume });
    });

    return states;
  }, [
    localPosition,
    remotePositions,
    remoteParticipants,
    spotlightUsers,
    partyZoneUsers,
    config,
  ]);

  const updateSubscriptions = useCallback(() => {
    if (!room || !config.enabled) return;

    const now = Date.now();
    if (now - lastUpdateRef.current < config.updateThrottleMs)
      return;
    lastUpdateRef.current = now;

    remoteParticipants.forEach(
      (participant: RemoteParticipant) => {
        const state = subscriptionStates.get(
          participant.identity
        );
        if (!state) return;

        participant.trackPublications.forEach((pub) => {
          if (pub instanceof RemoteTrackPublication) {
            const isMediaTrack =
              pub.source === Track.Source.Camera ||
              pub.source === Track.Source.Microphone ||
              pub.source === Track.Source.ScreenShare;

            if (isMediaTrack) {
              if (
                pub.isSubscribed !== state.shouldSubscribe
              ) {
                pub.setSubscribed(state.shouldSubscribe);
              }

              if (
                pub.source === Track.Source.Microphone &&
                pub.audioTrack &&
                config.enableVolumeAttenuation
              ) {
                const audioElement =
                  pub.audioTrack.attachedElements?.[0];
                if (
                  audioElement &&
                  audioElement instanceof HTMLAudioElement
                ) {
                  audioElement.volume = state.volume;
                }
              }
            }
          }
        });
      }
    );
  }, [room, remoteParticipants, subscriptionStates, config]);

  useEffect(() => {
    if (config.enabled) {
      updateSubscriptions();
    }
  }, [updateSubscriptions, config.enabled]);

  const proximityInfo = useMemo(() => {
    const inRange: string[] = [];
    const outOfRange: string[] = [];

    subscriptionStates.forEach((state, identity) => {
      if (state.shouldSubscribe) {
        inRange.push(identity);
      } else {
        outOfRange.push(identity);
      }
    });

    return {
      enabled: config.enabled,
      localPosition,
      inRange,
      outOfRange,
      totalParticipants: remoteParticipants.length,
    };
  }, [
    subscriptionStates,
    config.enabled,
    localPosition,
    remoteParticipants,
  ]);

  return {
    enabled: config.enabled,
    inRangeCount: proximityInfo.inRange.length,
    outOfRangeCount: proximityInfo.outOfRange.length,
    proximityInfo,
    updateSubscriptions,
  };
}
