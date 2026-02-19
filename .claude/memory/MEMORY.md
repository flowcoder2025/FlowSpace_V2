# FlowSpace Project Memory

## Project Overview
- **Name**: FlowSpace
- **Type**: flow_metaverse 리팩토링 프로젝트
- **Goal**: ComfyUI 기반 에셋 파이프라인 + 멀티에이전트 팀 시스템
- **Repo**: https://github.com/flowcoder2025/FlowSpace_V2.git

## Active Epic
| Epic | 상태 | Phase 진행 | 마지막 업데이트 |
|------|------|------------|-----------------|
| ComfyUI Asset Pipeline | 진행중 | Phase 1 완료 | 2026-02-19 |

## Architecture Decisions
- 5개 도메인 에이전트 + 오케스트레이터 체제
- Contract Governance (FlowHR 패턴 적용)
- EventBridge (React ↔ Phaser 통신)
- Socket.io (Client ↔ Server 실시간)
- Next.js 15 App Router + Prisma 6 + PostgreSQL
- eslint-config-next v16: `defineConfig` + direct import 방식 (FlatCompat 불가)
- 백그라운드 에이전트 Write/Bash 권한 없음 → 오케스트레이터 직접 실행

## Team Structure
| Agent | Domain | Status |
|-------|--------|--------|
| Game Engine | Phaser, Avatar, Tiles | Ready |
| Asset Pipeline | ComfyUI, Processing | Phase 1 완료 |
| Communication | Socket.io, Realtime | Ready |
| Frontend | Next.js, UI, Zustand | Phase 1 완료 |
| Backend | API, Prisma, Auth | Phase 1 완료 |

## Completed Work (Phase 1)
- 팀 인프라 25파일 (personas, contracts, shared, memory)
- Next.js 15 스캐폴드 + Prisma 14 모델
- ComfyUI 클라이언트 (mock mode 포함)
- 워크플로우 템플릿 3종
- 에셋 파이프라인 (processor, validator, loader)
- API 5개 + UI 2페이지 + Zustand 스토어
- EventBridge + AssetRegistry 포팅
- Level 1 검증 통과 (tsc, eslint, build)

## Next Steps
1. 실제 ComfyUI 연동 (mock → real)
2. NextAuth 인증 통합
3. Socket.io 서버 (Communication)
4. Phaser 씬 구현 (Game Engine)
5. 단위/통합 테스트

## Key References (flow_metaverse)
- EventBridge: `src/features/space/game/events.ts`
- AssetRegistry: `src/config/asset-registry.ts`
- Avatar: `src/features/space/avatar/config.ts`
- Prisma Schema: `prisma/schema.prisma`
- TilesetGenerator: `src/features/space/game/tiles/TilesetGenerator.ts`

## Technical Notes
- npm install 완료, node_modules 존재
- prisma generate 완료
- DB 연결 미설정 (DATABASE_URL 필요)
- build 결과: 9 라우트 (static 3 + dynamic 4 + API 4)
