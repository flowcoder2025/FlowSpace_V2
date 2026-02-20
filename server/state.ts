/**
 * Socket Server Shared State
 * Recording, spotlight, and proximity states
 */

// ============================================
// Recording State
// ============================================
export interface RecordingStatusData {
  isRecording: boolean;
  recorderId: string;
  recorderNickname: string;
  startedAt: number;
}

export const recordingStates = new Map<string, RecordingStatusData>();

// ============================================
// Spotlight State: spaceId → Map<participantId, ActiveSpotlight>
// ============================================
export interface ActiveSpotlight {
  participantId: string;
  nickname: string;
}

export const spotlightStates = new Map<
  string,
  Map<string, ActiveSpotlight>
>();

export function getOrCreateSpotlightState(
  spaceId: string
): Map<string, ActiveSpotlight> {
  if (!spotlightStates.has(spaceId)) {
    spotlightStates.set(spaceId, new Map());
  }
  return spotlightStates.get(spaceId)!;
}

// ============================================
// Proximity State: spaceId → boolean (enabled/disabled)
// Default: false (global mode)
// ============================================
export const proximityStates = new Map<string, boolean>();

export function getProximityState(spaceId: string): boolean {
  return proximityStates.get(spaceId) ?? false;
}

export function setProximityState(spaceId: string, enabled: boolean): void {
  proximityStates.set(spaceId, enabled);
}
