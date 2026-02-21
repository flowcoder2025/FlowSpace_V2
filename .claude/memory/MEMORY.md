# FlowSpace Project Memory

## Project Overview
- **Name**: FlowSpace
- **Type**: flow_metaverse 리팩토링 프로젝트
- **Goal**: ComfyUI 기반 에셋 파이프라인 + 메타버스 플랫폼
- **Repo**: https://github.com/flowcoder2025/FlowSpace_V2.git

## Active Epic
| Epic | 상태 | Phase 진행 | 마지막 업데이트 |
|------|------|------------|-----------------|
| (없음) | | | |

## Completed Epics
| Epic | 완료일 | Phase 수 |
|------|--------|----------|
| ComfyUI Asset Pipeline | 2026-02-19 | Phase 1~7 |
| Map Editor | 2026-02-19 | Phase 8 |
| Admin Dashboard | 2026-02-19 | Phase 9 |
| Chat Port (flow_metaverse → FlowSpace) | 2026-02-20 | Phase 10 (6 sub-phases) |
| LiveKit 음성/화상 포팅 | 2026-02-20 | Phase 11 (통합+QA) |
| 파츠 조합 캐릭터 시스템 | 2026-02-21 | Phase 1~3 (Core+UI+인게임) |
| ComfyUI 파이프라인 개선 | 2026-02-22 | Phase 1~4 (프롬프트+배경제거+Seamless+ControlNet) |

## Architecture Decisions
- 6 도메인 rules (`.claude/rules/` path-based auto-load)
- event-protocol → `.claude/reference/` (인간용 레퍼런스)
- EventBridge (React ↔ Phaser 통신)
- Socket.io (Client ↔ Server 실시간) + dotenv 명시 로드 (tsx 환경)
- Next.js 15 App Router + Prisma 6 + PostgreSQL (Supabase)
- NextAuth v5 + JWT + PrismaAdapter + **auth.config.ts 분리 (Edge Runtime)**
- 소켓 인증: `/api/socket/token` → jose JWT 발급 → 서버 검증
- Admin Dashboard: requireSpaceAdmin 헬퍼 (OWNER/STAFF/superAdmin)
- 채팅 드래그/리사이즈: useChatDrag 훅 (localStorage 위치/크기 저장)
- Phaser 키보드 캡처: chatFocused 시 clearCaptures/addCapture 토글
- DB: Supabase Transaction Pooler + `pgbouncer=true` (prepared statement 호환)
- 배포: Dockerfile (standalone) + docker-compose + GitHub Actions CI

## Next Steps (긴급 — 연동 누락 수정)
1. **인게임 아바타 에디터 버튼 추가** — space-client.tsx HUD에 버튼 1개
2. **에셋→Phaser 연동** — loadAssetToPhaser 호출 + ASSET_GENERATED 리스너
3. **맵 에디터에서 생성 에셋 사용** — 타일셋/오브젝트 선택/배치
4. **생성 캐릭터 → 아바타 적용** — 커스텀 스프라이트를 아바타로
5. processor.ts DEBUG 로그 제거

## Next Steps (일반)
1. ComfyUI 추가 개선 (LoRA 지원, Flux.1 모델, 실시간 프리뷰)
2. 에디터 명령어 연동 (chat-parser editor_command → 맵 에디터)
3. 브라우저 알림 (Notification API)
4. 모바일 반응형
5. 프로덕션 배포 (Vercel/Docker)

## Supabase DB 연결 정보
- Host: `aws-1-ap-southeast-2.pooler.supabase.com`
- Transaction Pooler: 포트 6543 (`pgbouncer=true` 필수)
- Session Pooler: 포트 5432 (Direct URL)

## Key References
- EventBridge: `src/features/space/game/events/` (types.ts + event-bridge.ts)
- Game Manager: `src/features/space/game/internal/game-manager.ts`
- MainScene: `src/features/space/game/internal/scenes/main-scene.ts`
- Input Controller: `src/features/space/game/internal/player/input-controller.ts`
- Socket types: `src/features/space/socket/internal/types.ts`
- Socket Client: `src/features/space/socket/internal/socket-client.ts`
- Socket Bridge: `src/features/space/bridge/internal/use-socket-bridge.ts`
- Chat Panel: `src/components/space/chat-panel.tsx` (드래그/리사이즈/Enter 활성화)
- Chat Drag Hook: `src/features/space/hooks/internal/useChatDrag.ts`
- Auth Config: `src/lib/auth.config.ts` (Edge 호환)
- Prisma Config: `prisma.config.ts` (dotenv + seed)
- LiveKit Provider: `src/features/space/livekit/internal/LiveKitRoomProvider.tsx`
- SpaceMediaLayer: `src/components/space/video/SpaceMediaLayer.tsx`
- Participant Panel: `src/components/space/video/ParticipantPanel.tsx` (Players 통합)

## Technical Notes
- npm install 완료, node_modules 존재
- prisma migrate 초기화 완료 (0_init 베이스라인)
- DB seed 완료 (테스트 계정: test@flowspace.dev / password123)
- build: 50+ 라우트 (tsc ✅ eslint ✅ build ✅ standalone)
- 테스트: Vitest 52/52 통과 (chat-parser + chat-filter)
- 개발서버: `npm run dev:all` (Next.js 3000 + Socket.io 3001 + LiveKit 7880)
- LiveKit 바이너리: `bin/livekit-server.exe` v1.9.11 (gitignore, 수동 설치)
- Playwright: 프로젝트 devDependency로 설치됨 (E2E 디버깅용)

## Avatar System (Parts)
- **해상도**: 32x48 (4x4 spritesheet = 128x192)
- **레이어 순서**: body → bottom → top → eyes → hair → accessory
- **조합**: 3×6×4×6×4×5 = 8,640 기본 조합 (색상 무한)
- **포맷**: `"parts:body_01:FFC0A0|hair_03:FF0000|eyes_02|top_05:2196F3|bottom_02:333366|acc_none"`
- **공존**: classic: / custom: / parts: (하위 호환)
- **DB**: User.avatarConfig (Json?) — `{ avatarString: "parts:..." }`
- **에디터**: `src/components/avatar/` (React 독립, Phaser 불필요)
- **런타임 스왑**: `updateAvatar(avatarString)` — texture 교체 + animation 재생성
- **소켓**: `avatar:update` → `player:avatar-updated` 브로드캐스트

## Lessons (프로젝트 로컬)
- tsx(cross-env)로 실행하는 소켓 서버는 .env 자동 로드 안 함 → `import { config } from "dotenv"` 필수
- Supabase Transaction Pooler(PgBouncer, 6543): `?pgbouncer=true&connection_limit=1` 필수
- React 이벤트 위임 → Phaser window 리스너와 충돌 → Phaser clearCaptures/addCapture 토글로 해결
- 메시지 id는 Date.now() 기반 (세션 간 localStorage 캐시 충돌 방지)
- auth.config.ts 분리: Edge Runtime에서 Prisma/bcrypt import 방지 (NextAuth v5 권장 패턴)
- prisma.config.ts: Prisma 7 대비, dotenv quiet 모드로 .env 로드
- localStorage 캐시: 시스템 메시지 제외 + 로드 시 중복 id 제거
- Phaser createCursorKeys/addKey: 자동으로 키 캡처(preventDefault) → chatFocused 시 clearCaptures 필요
