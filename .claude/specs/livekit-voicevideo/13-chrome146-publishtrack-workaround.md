# Phase 13: Chrome 146 카메라 hang — publishTrack 직접 호출 우회

> 상태: 완료 | 적용일: 2026-05-06 | 영구 보존 가치 있는 아키텍처 결정

## 증상
사용자 환경(Windows 10 + Chrome 146 + USB 웹캠 HK 1080P Cam)에서 LiveKit 카메라 토글 시:
```
AbortError: Timeout starting video source
```
- 음성은 정상 publish
- 비디오만 LiveKit Client SDK 내부 10초 타임아웃 발동
- Microsoft Edge에서는 정상 동작 (동일 PC, 동일 카메라)
- OS Camera 앱은 정상 (디바이스 자체는 OK)
- Chrome 권한 패널에 비디오 미리보기 표시됨 (Chrome이 카메라 acquire 자체는 성공)

## 진단 시도 기록 (실패한 가설들)

| 시도 | 결과 |
|------|------|
| `videoCaptureDefaults` 540p 강제 | 효과 없음 |
| Phaser Scale.RESIZE → FIT 원복 (GPU 압박 가설) | 효과 없음 |
| `livekit-client` 2.17.x → 2.16.0 다운그레이드 | 효과 없음 |
| `getUserMedia` pre-warm 후 release-then-reacquire | Pre-warm 649ms 성공하나 LiveKit 재호출에서 timeout |

## 확정된 원인
**Chrome 146의 release-then-reacquire 패턴 hang**:
1. LiveKit Client `setCameraEnabled(true)` 내부에서 `createLocalVideoTrack` → `getUserMedia` 호출
2. 호출 자체는 첫 시도에서 성공 가능
3. 하지만 LiveKit 내부에서 임시로 release → 재acquire하는 시점에 Chrome이 hang
4. Edge는 같은 Chromium 베이스지만 카메라 release 처리 스택 일부가 다름

LiveKit Client SDK가 Chrome 146 회귀의 영향을 받음. SDK 버그가 아닌 Chrome WebRTC 회귀에 가까움.

## 채택된 해결책: publishTrack 직접 호출

LiveKit 내부 `getUserMedia` 재호출 자체를 우회. 우리가 직접 acquire한 `MediaStreamTrack`을 LiveKit에 인계.

```ts
// 켜기 (이전: setCameraEnabled(true))
const stream = await navigator.mediaDevices.getUserMedia({ video: true });
const videoTrack = stream.getVideoTracks()[0];
await localParticipant.publishTrack(videoTrack, {
  source: Track.Source.Camera,
});

// 끄기 (이전: setCameraEnabled(false))
const publications = Array.from(localParticipant.trackPublications.values());
for (const pub of publications) {
  if (pub.source === Track.Source.Camera && pub.track) {
    await localParticipant.unpublishTrack(pub.track, true); // stop=true
  }
}
```

**왜 이게 동작하나**:
- `localParticipant.isCameraEnabled` getter는 `getTrackPublication(Track.Source.Camera)`의 존재 여부 기반 → publishTrack with source=Camera 후 자동으로 true 반환
- LiveKit Room 이벤트(`LocalTrackPublished/Unpublished`)도 정상 발화 → `useLocalParticipant().isCameraEnabled` React hook 자동 갱신 → UI 동기화 정상
- LiveKit 내부의 release-then-reacquire 시퀀스 자체를 거치지 않음

## 추가 보강 (race condition + leak 방어)

```ts
const cameraTogglingRef = useRef(false);

const toggleCamera = async () => {
  if (cameraTogglingRef.current) {
    console.warn("[Camera] toggle ignored — in-flight");
    return false;
  }
  cameraTogglingRef.current = true;

  let acquiredStream: MediaStream | null = null;
  try {
    // ... acquire + publishTrack
    acquiredStream = await navigator.mediaDevices.getUserMedia({ video: true });
    await localParticipant.publishTrack(/* ... */);
    acquiredStream = null;  // LiveKit 인계 완료 신호
  } finally {
    if (acquiredStream) {
      acquiredStream.getTracks().forEach((t) => t.stop());  // 누수 방지
    }
    cameraTogglingRef.current = false;
  }
};
```

- **In-flight guard**: getUserMedia 수초 대기 중 재클릭 무시
- **try/finally stream cleanup**: publishTrack 실패 시 카메라 점유 leak 방지

## 관련 파일
- `src/features/space/livekit/internal/LiveKitMediaContext.tsx` — `toggleCamera` 함수
- `src/features/space/livekit/internal/useLiveKitMedia.ts` — 동일 패턴 적용 가능 (현재 미적용, 사용처는 LiveKitMediaContext.tsx의 useLiveKitMedia export)

## 진단 자산 (재발 시 사용)
콘솔 로그로 진단:
```
[Camera] Direct acquire OK (Nms)  ← getUserMedia 성공
```

만약 이 로그가 안 나오면 = `getUserMedia` 자체가 hang → OS/Chrome 권한 문제.
이 로그는 나오는데 publish 후 다른 에러 = LiveKit signaling/network 문제.

## 향후 livekit-client 업그레이드 시 검증
1. 새 버전에 회귀 fix가 있는지 changelog 확인
2. Chrome 146+ 환경에서 `setCameraEnabled` 직접 호출 시도
3. 정상 동작하면 publishTrack 우회 패턴 제거 가능 (코드 단순화)
4. 그 전까지 이 패턴 영구 보존

## 핵심 교훈
1. **SDK 회귀는 외부 환경(Chrome 업데이트) 변화로도 발생** — 우리 코드 무관해 보여도 우회 패턴 필요
2. **publishTrack(MediaStreamTrack, options)** = LiveKit 내부 헬퍼를 우회하는 강력한 fallback
3. **isCameraEnabled getter는 publication 기반** → publishTrack with source=Camera로도 정상 동기화
4. **release-then-reacquire 패턴은 Chrome에서 hang 가능성** → 우리가 acquire한 stream을 직접 인계
5. **격리 테스트(Edge/시크릿)** = 가장 빠른 회귀 원인 격리법
