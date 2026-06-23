import { describe, it, expect } from "vitest";
import { TrackSource } from "livekit-server-sdk";
import {
  parseParticipantIdentity,
  findMicrophoneTrack,
  computePublishSourcesForMute,
  computePublishSourcesForUnmute,
  buildModeratedPermission,
} from "./moderation";

describe("parseParticipantIdentity — 토큰 라우트 발급 형식만 허용", () => {
  it("user-{userId}를 user kind로 파싱", () => {
    expect(parseParticipantIdentity("user-abc123")).toEqual({
      kind: "user",
      userId: "abc123",
    });
  });

  it("guest-{guestSessionId}를 guest kind로 파싱", () => {
    expect(parseParticipantIdentity("guest-sess-9")).toEqual({
      kind: "guest",
      guestSessionId: "sess-9",
    });
  });

  it("dev-anon-* 은 운영 계약 제외 → null", () => {
    expect(parseParticipantIdentity("dev-anon-1700000000000")).toBeNull();
  });

  it("prefix 없는 bare 값 → null", () => {
    expect(parseParticipantIdentity("abc123")).toBeNull();
  });

  it("remainder 빈 값(user-/guest-)은 → null", () => {
    expect(parseParticipantIdentity("user-")).toBeNull();
    expect(parseParticipantIdentity("guest-")).toBeNull();
  });

  it("비-string 입력 → null", () => {
    expect(parseParticipantIdentity(null)).toBeNull();
    expect(parseParticipantIdentity(undefined)).toBeNull();
    expect(parseParticipantIdentity(123)).toBeNull();
    expect(parseParticipantIdentity({})).toBeNull();
  });
});

describe("findMicrophoneTrack", () => {
  it("MICROPHONE source 트랙의 sid + muted를 반환", () => {
    const tracks = [
      { sid: "TR_cam", source: TrackSource.CAMERA, muted: false },
      { sid: "TR_mic", source: TrackSource.MICROPHONE, muted: true },
    ];
    expect(findMicrophoneTrack(tracks)).toEqual({ sid: "TR_mic", muted: true });
  });

  it("마이크 트랙이 없으면 null", () => {
    const tracks = [{ sid: "TR_cam", source: TrackSource.CAMERA, muted: false }];
    expect(findMicrophoneTrack(tracks)).toBeNull();
  });

  it("빈 트랙 목록 → null", () => {
    expect(findMicrophoneTrack([])).toBeNull();
  });
});

describe("computePublishSourcesForMute — canPublishSources []=전체허용 시맨틱", () => {
  it("현재 []([]=전체허용) → 마이크만 제외한 명시 목록", () => {
    const result = computePublishSourcesForMute([]);
    expect(result).toContain(TrackSource.CAMERA);
    expect(result).toContain(TrackSource.SCREEN_SHARE);
    expect(result).toContain(TrackSource.SCREEN_SHARE_AUDIO);
    expect(result).not.toContain(TrackSource.MICROPHONE);
  });

  it("non-empty → 마이크만 필터링, 다른 source 제한 보존(codex risk #1)", () => {
    const result = computePublishSourcesForMute([
      TrackSource.CAMERA,
      TrackSource.MICROPHONE,
    ]);
    expect(result).toEqual([TrackSource.CAMERA]);
  });

  it("이미 마이크 없는 non-empty → 그대로(idempotent), 타 제한 보존", () => {
    const result = computePublishSourcesForMute([TrackSource.CAMERA]);
    expect(result).toEqual([TrackSource.CAMERA]);
  });
});

describe("computePublishSourcesForUnmute — 권한 복원만(force-unmute 아님)", () => {
  it("현재 []([]=전체허용, 마이크 이미 허용) → [] 유지(idempotent)", () => {
    expect(computePublishSourcesForUnmute([])).toEqual([]);
  });

  it("non-empty + 마이크 없음 → 마이크 추가, 다른 제한 보존(codex risk #1)", () => {
    const result = computePublishSourcesForUnmute([TrackSource.CAMERA]);
    expect(result).toContain(TrackSource.CAMERA);
    expect(result).toContain(TrackSource.MICROPHONE);
    expect(result).toHaveLength(2);
  });

  it("non-empty + 마이크 이미 있음 → 그대로(idempotent)", () => {
    const result = computePublishSourcesForUnmute([
      TrackSource.CAMERA,
      TrackSource.MICROPHONE,
    ]);
    expect(result).toEqual([TrackSource.CAMERA, TrackSource.MICROPHONE]);
  });

  it("화면공유만 제한된 상태에서 unmute해도 화면공유 제한 보존", () => {
    // 가상의 화면공유 제재(CAMERA만 허용)에서 음성 unmute 시 마이크만 추가
    const result = computePublishSourcesForUnmute([TrackSource.CAMERA]);
    expect(result).not.toContain(TrackSource.SCREEN_SHARE);
  });
});

describe("buildModeratedPermission — permission atomic 보존(codex risk #1)", () => {
  it("mute: canSubscribe/canPublish/canPublishData/hidden 보존, canPublishSources만 마이크 제거", () => {
    const current = {
      canSubscribe: true,
      canPublish: true,
      canPublishData: true,
      hidden: false,
      canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE],
    };
    const result = buildModeratedPermission(current, true);
    expect(result.canSubscribe).toBe(true);
    expect(result.canPublish).toBe(true);
    expect(result.canPublishData).toBe(true);
    expect(result.hidden).toBe(false);
    expect(result.canPublishSources).toEqual([TrackSource.CAMERA]);
  });

  it("기존 hidden:true 등 비표준 권한도 보존(다른 제재 해제 방지)", () => {
    const current = {
      canSubscribe: false,
      canPublish: true,
      canPublishData: false,
      hidden: true,
      canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE],
    };
    const result = buildModeratedPermission(current, true);
    expect(result.canSubscribe).toBe(false);
    expect(result.canPublishData).toBe(false);
    expect(result.hidden).toBe(true);
  });

  it("unmute: 권한 복원(마이크 추가)만, 나머지 보존", () => {
    const current = {
      canSubscribe: true,
      canPublish: true,
      canPublishData: true,
      hidden: false,
      canPublishSources: [TrackSource.CAMERA],
    };
    const result = buildModeratedPermission(current, false);
    expect(result.canPublishSources).toContain(TrackSource.MICROPHONE);
    expect(result.canPublishSources).toContain(TrackSource.CAMERA);
  });

  it("current undefined → 토큰 grant 기본값으로 폴백", () => {
    const result = buildModeratedPermission(undefined, true);
    expect(result.canSubscribe).toBe(true);
    expect(result.canPublish).toBe(true);
    expect(result.canPublishData).toBe(true);
    expect(result.hidden).toBe(false);
    expect(result.canPublishSources).not.toContain(TrackSource.MICROPHONE);
  });
});
