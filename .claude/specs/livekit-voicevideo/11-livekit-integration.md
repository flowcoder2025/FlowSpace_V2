# Phase 11: LiveKit 음성/화상/화면공유/녹화

> Epic: [LiveKit 음성/화상 포팅](./README.md)
> 상태: 완료 | 업데이트: 2026-02-20

## 목표
LiveKit 기반 음성/화상/화면공유/녹화 기능을 space-client에 통합

## Task 목록
- [x] Task 11.1: LiveKit 모듈 구현 (7 files)
- [x] Task 11.2: API Routes (token + webhook)
- [x] Task 11.3: UI 컴포넌트 (VideoTile, ParticipantPanel, ScreenShare)
- [x] Task 11.4: Socket.io 미디어 핸들러 (recording/spotlight/proximity)
- [x] Task 11.5: Supporting hooks (useScreenRecorder, useVideoSettings, useAudioSettings)
- [x] Task 11.6: space-client.tsx 통합 (LiveKitRoomProvider + SpaceMediaLayer)
- [x] Task 11.7: QA 검증 + FAIL 수정 (3건)

## 변경된 파일

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `src/features/space/livekit/index.ts` | 추가 | Public API |
| `src/features/space/livekit/internal/types.ts` | 추가 | 타입 정의 |
| `src/features/space/livekit/internal/livekit-constants.ts` | 추가 | 상수 |
| `src/features/space/livekit/internal/LiveKitRoomProvider.tsx` | 추가 | 토큰 + 연결 관리 |
| `src/features/space/livekit/internal/LiveKitMediaContext.tsx` | 추가 | 3-tier 트랙 수집 컨텍스트 |
| `src/features/space/livekit/internal/useLiveKitMedia.ts` | 추가 | Standalone 미디어 훅 |
| `src/features/space/livekit/internal/useProximitySubscription.ts` | 추가 | 근접 기반 구독 |
| `src/app/api/livekit/token/route.ts` | 추가 | 토큰 발급 API |
| `src/app/api/livekit/webhook/route.ts` | 추가 | 이벤트 로깅 웹훅 |
| `src/components/space/video/VideoTile.tsx` | 추가 | 비디오 타일 |
| `src/components/space/video/ParticipantPanel.tsx` | 추가 | 참가자 패널 |
| `src/components/space/video/ScreenShare.tsx` | 추가 | 화면공유 오버레이 |
| `src/components/space/video/SpaceMediaLayer.tsx` | 추가 | 통합 미디어 레이어 |
| `server/handlers/media.ts` | 추가 | Socket.io 미디어 핸들러 |
| `src/features/space/socket/internal/use-socket.ts` | 수정 | 미디어 이벤트/에미터 |
| `src/features/space/socket/index.ts` | 수정 | 타입 export |
| `src/features/space/bridge/internal/use-socket-bridge.ts` | 수정 | 미디어 패스스루 |
| `src/app/space/[id]/space-client.tsx` | 수정 | LiveKit 래핑 + 미디어 UI |

## QA 검증 결과
- tsc ✅ lint ✅ (전체 0 에러, 0 경고)
- FAIL 3건 수정: 배너 겹침, onSocketError 미연결, onMemberUnmuted 누락
