# Epic: LiveKit 음성/화상 포팅

> 상태: 통합 완료 | 시작: 2026-02-20 | 완료: 2026-02-20

## 목표
flow_metaverse의 LiveKit 음성/화상/화면공유/녹화 시스템을 FlowSpace로 포팅

## Phase 구성
| Phase | 이름 | 상태 |
|-------|------|------|
| 11 | LiveKit 모듈 + API + UI + 통합 | ✅ 완료 |

## 아키텍처
- `LiveKitRoomProvider` → 토큰 페칭 + LiveKitRoom 컨텍스트
- `LiveKitMediaInternalProvider` → 3-tier 트랙 수집 (useTracks → subscribedTracksRef → room.remoteParticipants)
- `SpaceMediaLayer` → ParticipantPanel + ScreenShareOverlay + 미디어 컨트롤
- Socket.io 미디어 이벤트: recording/spotlight/proximity 양방향
- API: `/api/livekit/token` (인증 + 토큰 발급), `/api/livekit/webhook` (이벤트 로깅)

## 핵심 파일
- `src/features/space/livekit/` (7 files - 모듈)
- `src/components/space/video/` (4 files - UI)
- `src/app/api/livekit/` (token + webhook)
- `server/handlers/media.ts` (Socket.io 핸들러)
