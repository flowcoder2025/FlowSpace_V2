# Epic: ComfyUI Asset Pipeline

## Overview
ComfyUI 기반 에셋 파이프라인을 도입하여 게임엔진 내 캐릭터, 오브젝트, 맵 에셋을 AI로 자동 생성하는 시스템 구축

## Status: 진행중
- 시작일: 2026-02-19
- Phase 진행: Phase 5 완료 (Phase 6 대기)

## Phases
| Phase | 이름 | Agent | 상태 |
|-------|------|-------|------|
| 1 | [팀 인프라 + 에셋 파이프라인 기반](./01-infra-and-pipeline.md) | All | 완료 |
| 2-3 | [DB + 인증 + 공간 시스템](./02-auth-and-spaces.md) | Backend + Frontend | 완료 |
| 4 | [Socket.io 실시간 서버](./03-socket-realtime.md) | Communication | 완료 |
| 5 | [Phaser 게임 엔진](./05-phaser-game-engine.md) | Game Engine | 완료 |
| 6 | 채팅 시스템 | Communication + Frontend | 대기 |
| 7 | ComfyUI 실제 연동 | Asset Pipeline | 대기 |

## Architecture Decisions
- 5개 도메인 에이전트 + 오케스트레이터 체제
- Contract Governance (FlowHR 패턴)
- ComfyUI REST API + Mock mode
- flow_metaverse 스키마 기반 확장
- NextAuth v5 + JWT + Supabase PostgreSQL
- 소켓 인증: 별도 JWT 발급 (/api/socket/token)

## Key References
- flow_metaverse: `C:\Team-jane\flow_metaverse\`
- EventBridge, AssetRegistry, TilesetGenerator 패턴 포팅
- 전체 로드맵: `plan.md` (Phase 1~11)
