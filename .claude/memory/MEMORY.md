# FlowSpace Project Memory

## Project Overview
- **Name**: FlowSpace
- **Type**: flow_metaverse 리팩토링 프로젝트
- **Goal**: ComfyUI 기반 에셋 파이프라인 + 메타버스 플랫폼
- **Repo**: https://github.com/flowcoder2025/FlowSpace_V2.git

## Active Epic
| Epic | 상태 | 다음 작업 |
|------|------|-----------|
| 치비 LoRA 학습 | 플랜 완료, 승인 대기 | Phase 1: kohya_ss 설치 |

### 치비 LoRA 학습 상세
- **목표**: 게임 스프라이트 전용 치비 스타일 LoRA → 32프레임 시각적 일관성 확보
- **도구**: kohya_ss (sd-scripts)
- **학습 데이터**: 35~50장 (AI 선별 + 오픈소스)
- **하이퍼파라미터**: dim=32, alpha=16, AdamW8bit, LR=5e-5, 12 epochs
- **트리거 워드**: `flowspace_chibi`
- **yuugiri 대체** (fallback 유지)
- **플랜 파일**: `~/.claude/plans/fluffy-meandering-hollerith.md`

## Recently Completed
| Epic | 완료일 | 핵심 산출물 |
|------|--------|------------|
| 치비 캐릭터 파이프라인 | 2026-02-22 | Phase 1~8 완료, IP-Adapter 포함, GRADE: PASS |

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
| 에셋-게임 연동 | 2026-02-22 | Phase 1 (연동 수정+한글화+ControlNet 설치) |
| 에셋 갤러리 리팩토링 | 2026-02-22 | Ad-hoc (스튜디오→갤러리 통합) |

## Architecture Decisions

### 플랫폼 기반
- 6 도메인 rules (`.claude/rules/` path-based auto-load)
- EventBridge (React ↔ Phaser 통신)
- Socket.io (Client ↔ Server 실시간) + dotenv 명시 로드 (tsx 환경)
- Next.js 15 App Router + Prisma 6 + PostgreSQL (Supabase)
- NextAuth v5 + JWT + PrismaAdapter + **auth.config.ts 분리 (Edge Runtime)**
- 소켓 인증: `/api/socket/token` → jose JWT 발급 → 서버 검증
- DB: Supabase Transaction Pooler + `pgbouncer=true` (prepared statement 호환)
- 배포: Dockerfile (standalone) + docker-compose + GitHub Actions CI

### 에셋 파이프라인 (2026-02-19 ~ 02-22)
- **ComfyUI 통합**: auto/real/mock 3모드, capability-checker로 설치 상태 자동 감지
- **워크플로우 JSON**: `_meta.parameters` 기반 파라미터 주입 (injectWorkflowParams)
- **후처리 체인**: removeBackground → alignCharacterFrames → blendTileEdges (유형별)
- **품질 프리셋**: draft/standard/high (steps, cfg, sampler, scheduler 묶음)
- **Seamless 타일**: 전용 워크플로우 variant + 2px 엣지 블렌딩
- **에셋 갤러리 통합**: 스튜디오/생성폼 제거 → 단일 /assets 페이지 (2026-02-22)

### 치비 캐릭터 파이프라인 (2026-02-22)
- **픽셀아트 → 치비/SD 전환**: 사용자가 픽셀아트 스타일 거부 → Animagine XL 3.1 기반 치비로 변경
- **프레임별 개별 생성**: 단일 시트 생성 불가 → 32프레임 순차 생성 + ControlNet 포즈 제어 + 합성
- **모델 스택**: Animagine XL 3.1 + yuugiri-lyco LoRA (치비) + OpenPoseXL2 (포즈) + IP-Adapter Plus (identity)
- **폭 정규화**: normalizeDirectionFrames — median bbox + fit:fill + 2차 equalization → stddev=0px 달성
- **alignCharacterFrames 제거**: normalizeDirectionFrames가 중앙+바닥선 처리, 추가 시프트는 클리핑 유발
- **alpha 임계값**: extractBBox alpha>10 (분석기와 동일 기준)
- **IP-Adapter 2-Phase**: Phase A(down_0 레퍼런스) → Phase B(32프레임 identity 주입) — 외형 일관성 확보
- **IPAdapterAdvanced 선택**: IPAdapter Simple은 clip_vision 직접 입력 불가 → Advanced 사용
- **Graceful Fallback**: IP-Adapter 미설치 시 기존 chibi-frame 워크플로우 자동 사용
- **방향별 seed 고정**: 같은 방향 8프레임은 동일 seed → 걷기 사이클 내 외형 일관성
- **시각적 일관성 한계**: IP-Adapter+ControlNet으로도 프레임 간 외형(갑옷 디테일, 체형, 색상) 불일치 → 에셋 사용 불가 판정
- **LoRA 학습 결정 (2026-02-22)**: kohya_ss로 범용 치비 스프라이트 스타일 LoRA 학습, yuugiri 대체 (fallback 유지)

### 아바타 시스템 (2026-02-21)
- **3종 공존**: `classic:` / `custom:` / `parts:` 포맷 하위 호환
- **Custom Avatar 비동기 로드**: sync fallback(기본 파츠) → async Canvas 스케일(128→32x48) → re-emit
- **런타임 스왑**: texture 제거 → 재생성 → animation 재등록

### UI/UX (2026-02-22)
- **전체 한글화**: 13개 컴포넌트, 모든 필드에 title 속성 한글 설명
- **ControlNet 상태 표시**: "(미설치)" → "(설정 필요)" 변경
- **barrel import 우회**: `@/features/assets` barrel이 sharp(Node전용) re-export → 클라이언트에서 직접 internal import

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
