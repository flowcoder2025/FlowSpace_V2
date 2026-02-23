# FlowSpace Project Memory

## Project Overview
- **Name**: FlowSpace
- **Type**: flow_metaverse 리팩토링 프로젝트
- **Goal**: ComfyUI 기반 에셋 파이프라인 + 메타버스 플랫폼
- **Repo**: https://github.com/flowcoder2025/FlowSpace_V2.git

## Active Epic
없음 (치비 파이프라인 완료)

### 치비 파이프라인 batch 리팩토링 (완료 2026-02-23)
- **결과**: 24회 → 3회 호출, 19분 → 4.4분 (77% 단축), GRADE: PASS
- **핵심 변경**:
  1. ControlNet/IP-Adapter 제거
  2. ComfyUI Rembg 노드 도입 (AI 배경 제거)
  3. batch_size=8로 방향당 1회 호출
  4. processor.ts 대폭 축소
- **SpriteSheetMaker**: 폴더 기반이라 실제 미사용 → composeSpriteSheet 코드 유지

### 치비 LoRA 학습 (완료)
- **결과**: 12 epochs, 2100 steps, loss=0.055
- **체크포인트**: `C:\Users\User\sd-scripts\output\` (6개, 각 325MB)
- **채택**: epoch 8 (`flowspace-chibi-v1-000008.safetensors`) → ComfyUI loras/에 복사됨
- **트리거 워드**: `flowspace_chibi`
- **검증**: GRADE: PASS, 방향 내 일관성 yuugiri 대비 개선 확인

## Recently Completed
| Epic | 완료일 | 핵심 산출물 |
|------|--------|------------|
| 치비 파이프라인 batch 리팩토링 | 2026-02-23 | Phase 10, 77% 속도 향상, Rembg AI 배경 제거 |
| 치비 LoRA 학습 | 2026-02-23 | Phase 1~4 완료, epoch 8 채택 |
| 치비 캐릭터 파이프라인 | 2026-02-22 | Phase 1~8 완료, IP-Adapter 포함 |

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

### 에셋 파이프라인 (2026-02-19 ~ 02-23)
- **ComfyUI 통합**: auto/real/mock 3모드, capability-checker로 설치 상태 자동 감지
- **워크플로우 JSON**: `_meta.parameters` 기반 파라미터 주입 (injectWorkflowParams)
- **후처리 체인**: removeBackground → normalizeDirectionFrames → composeSpriteSheet (유형별)
- **품질 프리셋**: draft/standard/high (steps, cfg, sampler, scheduler 묶음)
- **Seamless 타일**: 전용 워크플로우 variant + 2px 엣지 블렌딩
- **에셋 갤러리 통합**: 스튜디오/생성폼 제거 → 단일 /assets 페이지 (2026-02-22)
- **right = left mirror**: OpenPose 측면 포즈 좌/우 구분 불가 → sharp.flop() (2026-02-23)

### 치비 캐릭터 파이프라인 (2026-02-22 ~ 02-23)
- **모델 스택**: Animagine XL 3.1 + flowspace-chibi LoRA + ControlNet(OpenPose) + IP-Adapter
- **per-frame 방식 유지**: 프레임별 개별 생성 (ControlNet 방향 가이드 + IP-Adapter identity 유지)
- **batch 접근 실패**: batch_size=8 시도 → 캐릭터 identity 붕괴 + 방향 불일치 → 복원
- **Rembg AI 배경 제거 추가**: 3개 워크플로우(frame/ipadapter/fallback)에 InspyrenetRembg 노드 삽입
- **LoRA 우선순위**: flowspace-chibi > chibistyle > yuugiri (CHIBI_LORA_PRIORITY)
- **right mirror**: left 생성 → sharp.flop() 반전

### 아바타 시스템 (2026-02-21)
- **3종 공존**: `classic:` / `custom:` / `parts:` 포맷 하위 호환
- **Custom Avatar 비동기 로드**: sync fallback(기본 파츠) → async Canvas 스케일(128→32x48) → re-emit
- **런타임 스왑**: texture 제거 → 재생성 → animation 재등록

### UI/UX (2026-02-22)
- **전체 한글화**: 13개 컴포넌트, 모든 필드에 title 속성 한글 설명
- **barrel import 우회**: `@/features/assets` barrel이 sharp(Node전용) re-export → 클라이언트에서 직접 internal import

## Key References
- EventBridge: `src/features/space/game/events/` (types.ts + event-bridge.ts)
- Game Manager: `src/features/space/game/internal/game-manager.ts`
- MainScene: `src/features/space/game/internal/scenes/main-scene.ts`
- Input Controller: `src/features/space/game/internal/player/input-controller.ts`
- Socket types: `src/features/space/socket/internal/types.ts`
- Socket Client: `src/features/space/socket/internal/socket-client.ts`
- Socket Bridge: `src/features/space/bridge/internal/use-socket-bridge.ts`
- Chat Panel: `src/components/space/chat-panel.tsx` (드래그/리사이즈/Enter 활성화)
- Auth Config: `src/lib/auth.config.ts` (Edge 호환)
- Prisma Config: `prisma.config.ts` (dotenv + seed)

## Technical Notes
- npm install 완료, node_modules 존재
- prisma migrate 초기화 완료 (0_init 베이스라인)
- DB seed 완료 (테스트 계정: test@flowspace.dev / password123)
- build: 50+ 라우트 (tsc ✅ eslint ✅ build ✅ standalone)
- 테스트: Vitest 52/52 통과 (chat-parser + chat-filter)
- 개발서버: `npm run dev:all` (Next.js 3000 + Socket.io 3001 + LiveKit 7880)
- ComfyUI 포트: **8000**
- **Tailwind CSS 수정 (2026-02-23)**: v4.1.8, `source(none)` + 명시적 `@source` (oxide 스캐너 바이너리 파일 스캔 방지)

## Lessons (프로젝트 로컬)
- tsx(cross-env)로 실행하는 소켓 서버는 .env 자동 로드 안 함 → `import { config } from "dotenv"` 필수
- Supabase Transaction Pooler(PgBouncer, 6543): `?pgbouncer=true&connection_limit=1` 필수
- React 이벤트 위임 → Phaser window 리스너와 충돌 → Phaser clearCaptures/addCapture 토글로 해결
- auth.config.ts 분리: Edge Runtime에서 Prisma/bcrypt import 방지 (NextAuth v5 권장 패턴)
- Tailwind CSS v4 + oxide: 프로젝트 내 바이너리/JSON 파일을 스캔하면 Invalid code point 에러 → `source(none)` 필수
- OpenPose 측면 포즈는 좌/우 구분 불가 → right = left mirror가 정답
- ControlNet은 치비 스프라이트에 효과 미미 (단순 포즈 + 프롬프트로 충분)
