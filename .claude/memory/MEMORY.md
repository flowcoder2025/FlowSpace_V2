# FlowSpace Project Memory

## Project Overview
- **Name**: FlowSpace
- **Type**: flow_metaverse 리팩토링 프로젝트
- **Goal**: ComfyUI 기반 에셋 파이프라인 + 메타버스 플랫폼
- **Repo**: https://github.com/flowcoder2025/FlowSpace_V2.git

## Active Epic
chibi-pipeline Phase 12 — 인프라 마이그레이션 + 디자인 시스템 정립 + LiveKit Chrome 회귀 우회 + **Chrome 146 picker 검정 박스 KNOWN ISSUE 분류** 완료. **다음: 충돌 영역 정밀화 → Y-sorting** (게임 본 작업), 또는 dashboard/invite 페이지 디자인 통합 + 랜딩 스크린샷 (에셋 완성 후)

### 인프라 통합 (2026-05-06 기준)
- **Vercel**: `flowspace-v2.vercel.app` (flowcoder 팀 Pro, 서울 리전 `icn1`)
- **DB**: Supabase **서울** (`ap-northeast-2`, 프로젝트 `FlowSpace2` / id `fqhcnudechuchaazwrzg`)
- **OCI Socket.io v2**: 포트 3002, `flowspace-v2_socket_1` 컨테이너, `socket-v2.144.24.72.143.nip.io` + `v2-socket.flow-coder.com`
- **OCI 공유 스택** (`/home/ubuntu/flowspace`): caddy + livekit만 유지 (v1 socket 제거됨, 소스는 1주 보존)
- **인증**: Google OAuth + Credentials 2체제 (GitHub provider 제거)
- **CD**: `OCI_SSH_PRIVATE_KEY` 시크릿 미설정 → 수동 배포 중 [KNOWN ISSUE]
- **CORS**: `CORS_ORIGINS` 콤마 구분 다중 origin
- **SSH**: `~/.ssh/flowspace-oci` 키로 `ubuntu@144.24.72.143`
- **롤백 자산**: 시드니 Supabase `afdfkpxsfuyccdvrkqwu` PAUSING + 로컬 `.backups/sydney-2026-05-06/` 백업 (며칠 후 영구 삭제 예정)
- **livekit-client**: `2.16.0` 핀 고정 (`@livekit/components-react@2.9.17`) — V1 매칭

### 디자인 시스템 (2026-05-06 정립)
- **모노크롬 흑백**: `cream #FFFFFF` / `cream-deep #FAFAFA` / `ink #0A0A0A` 5단계 회색 / `line #E5E5E5`
- **단일 액센트**: 로고 그라데이션이 유일한 컬러 포인트 (purple/magenta)
- **타이포**: Source Serif 4 (Google) + Pretendard (CDN) — `font-serif` 헤드라인 / `font-sans` 본문
- **버튼 일관성**: outline (border + cream bg) vs fill (brand bg + cream text)
- **Navbar**: 단일 컴포넌트 (LandingNavbar 통합), 마케팅 메뉴 모든 사용자, 로그인 시 "공간" 추가, 모바일 햄버거
- **인게임 UI**: 다크 글래스모피즘 (`bg-ink/80~95 + backdrop-blur-md`)
- **chat-panel.tsx + chat/* 의도적 예외** (현재 디자인 유지)

### LiveKit Chrome 146 워크어라운드 (영구 보존)
- **증상**: `setCameraEnabled(true)` → "Timeout starting video source" hang
- **해결**: `getUserMedia` 직접 acquire → `publishTrack(track, { source: Track.Source.Camera })`로 LiveKit 인계
- **참조**: `specs/livekit-voicevideo/13-chrome146-publishtrack-workaround.md`
- **추가 보강**: `cameraTogglingRef` in-flight guard + `try/finally` stream cleanup

### Chrome 146 화면공유 picker 검정 박스 (KNOWN ISSUE, 2026-05-07)
- **증상**: 창/전체화면 탭에서 picker 모달 바로 아래에 페이지 캡처 preview가 표시되는데, WebGL canvas 영역이 검정 fallback으로 보임
- **트리거**: WebGL canvas + self-capture 재귀 (자기 창이 active OS window일 때)
- **수용 결정**: 본인 시각적 잔재만 (공유 영상/타 참가자 영향 0). 코드 변경 없이 KNOWN ISSUE
- **폐기 가설**: Scale.RESIZE / backgroundColor / Chrome 동작 / backdrop-filter / `preserveDrawingBuffer:false`
- **폐기 해결책**: Phaser.CANVAS(타일 sub-pixel 줄무늬), `display:none`(Framebuffer Incomplete Attachment 크래시)
- **미검증 가설** (추후 가능): `antialias:false`, `selfBrowserSurface:exclude`
- **참조**: `specs/livekit-voicevideo/14-chrome146-screenshare-picker.md`

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
| 랜딩 + 디자인 시스템 + Navbar 통합 | 2026-05-06 | 랜딩 신규, 27 파일 디자인 통합, 단일 Navbar (모바일 햄버거 포함) |
| LiveKit Chrome 146 워크어라운드 | 2026-05-06 | publishTrack 직접 호출 패턴, 영구 보존 |
| oci-deployment Phase 4~5 | 2026-05-06 | Supabase 서울 마이그레이션 + OCI v1 제거 |
| 인증 단순화 | 2026-05-06 | GitHub OAuth 제거 + Google OAuth 활성화 |
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
- 배포: Vercel(Next.js) + OCI(Socket.io Docker) + Caddy(리버스 프록시) + GitHub Actions CD

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
- **하이브리드 방식**: ref(down) 1장 + left/up 2장 SD 생성 → 코드 걷기 변환 (3호출, ~55초)
- **Down = Phase A 레퍼런스 직접 사용** (재생성 안 함 → 얼굴/디테일 100% 일치)
- **IP-Adapter 최적 설정**: `style and composition`, weight=0.8, endAt=0.5 (A/B 테스트 13종으로 확정)
- **Rembg AI 배경 제거**: 3개 워크플로우에 InspyrenetRembg 노드
- **right mirror**: left 생성 → sharp.flop() 반전

### v5 파이프라인 (2026-02-25, 흰 테두리 근본 해결)
- **원인**: ref 이미지에 흰 아웃라인 → IP-Adapter 전파 (LoRA 아님)
- **해결**: clean ref (IP-Adapter 없이) + `thick outline, bold lineart` 제거
- **결과**: 6캐릭터 × 3방향 = 18장 전원 흰 아웃라인 0%
- **출력**: `ComfyUI/output/v5/refs/` + `v5/final/` (이전: `legacy/`)
- **배치**: `scripts/batch-chibi-directions.py` v5 (`--gen-refs` → `--upload-refs` → 기본)
- **워크플로우**: `v5_clean_ref_pipeline.json`, `v5_front_left_pipeline.json`, `v5_back_pipeline.json`

### 점프 + 걷기 시스템 (2026-02-25)
- **점프**: 순수 시각 연출 (Tween, 물리 위치 불변)
  - Tween: 0→-20→0, 150ms×2 yoyo, Sine.Out
  - apply/restore 패턴: preupdate에서 오프셋 복원 → 물리 엔진 body←sprite 동기화에 잘못된 Y 전파 차단
  - emitMovement는 오프셋 적용 **전에** 호출 (네트워크 전송 위치에 시각 오프셋 미포함)
  - squash&stretch: 도약(scaleY 1.15/scaleX 0.9, 60ms) + 착지(scaleY 0.85/scaleX 1.12, 80ms yoyo)
  - 바닥 그림자: fillEllipse, 점프 높이에 비례 축소/투명화
- **걷기 애니메이션**: `generate-walking-frames.py` (코드 기반, standing→walking 변형)
  - `shear_upper_body()`: 상체 수평 전단 (팔 스윙 효과, 다리 반대 방향)
  - `scale_leg_vertical()`: 다리 수직 압축 (갭 없는 걷기)
  - overlap 30px: 상체가 다리 위를 덮음 (LANCZOS 보간 경계 반투명 방지)
  - `remove_white_fringe()`: 임시 디프린지 (ComfyUI Alpha Erode로 대체 예정)

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
- Socket types·transport 상수: `src/features/space/protocol/` (SSOT — `internal/socket-events.ts` 타입 + `internal/socket-constants.ts` 상수, WI-012-1)
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
- Phaser Arcade Physics sprite.y 직접 수정 → body←sprite 동기화로 위치 드리프트. preupdate에서 복원 필수
- 걷기 프레임 다리 shift → 갭 발생. scale_leg_vertical(수직 압축)으로 갭 없이 다리 길이 차이 구현
- 상체-다리 경계선 → overlap 30px로 해결 (상체가 다리 위를 덮음)
- 코드 레벨 walk bob(sin 바운스) ≠ 스프라이트 프레임 애니메이션(팔/다리 움직임): 혼동하지 말 것
- Phaser Tween 시각 오프셋 + emitMovement: 네트워크 전송 위치에 시각 오프셋 포함 방지 → emitMovement를 오프셋 적용 전에 호출
- LANCZOS 보간 + 알파 채널 = 경계 반투명 픽셀 생성: 이미지 영역 압축/합성 시 overlap으로 덮어야 함
- Windows Prisma DLL lock: `npm run build` 실패 시 `npx next build`로 우회 가능 (prisma generate 스킵)
- 측면 걷기 가랑이 감지 실패 시 fallback 필요: 의상이 다리를 가리면 폭 변화 감지 안 됨 → leg_ratio<0.15면 75% 위치 사용
- pixelArt:true → 텍스트도 nearest-neighbor 강제. AI 캐릭터용으로 pixelArt:false + antialias:true 전환
- 대각선 이동 시 vy==vx이면 up/down 우선됨 → ZEP처럼 측면 우선으로 변경
- ComfyUI 체크포인트명은 파일명 정확히 확인 필수: `animagine-xl-3.1` → 실제는 `animagineXL31_v31`
- 프로시저럴 타일셋(Canvas API 직접 그리기)은 이미지 교체가 불가 → 이미지 로드 방식으로 전환 필요
- 2D 모델(Klein/SV3D)은 front→back 깊이 모순 발생 (앞뒤 둘 다 파여있음). 진짜 3D 복원(Hunyuan3D)만 물리적 깊이 일관성 보장
- Kijai ComfyUI-Hunyuan3DWrapper: `custom_nodes/`에 설치됨. pymeshlab + custom_rasterizer wheel 필요. nvdiffrast는 빌드 실패
- Open3D Visualizer(visible=False)로 Windows에서 GLB → PNG 렌더 가능 (`scripts/render-back-view.py`)
- docker-compose v1 (`docker-compose`)은 OCI에서 사용 중 — `docker compose` (v2) 안 됨
- docker-compose v1의 ContainerConfig KeyError: `down` 후 `up --build` 로 우회
- Vercel 도메인 추가 시 해당 도메인의 팀 scope에서 실행해야 함 (다른 팀 = 403)
- OCI Caddy는 v1 docker network 안이라 v2 컨테이너에 직접 접근 불가 → `172.18.0.1:포트`(호스트 게이트웨이) 사용
- **Supabase 리전 변경 불가**: 신규 프로젝트 + 데이터 마이그레이션이 유일 방법. 같은 organization, 같은 비밀번호로 신규 생성 시 connection string은 ref + region만 다름
- **Prisma 스키마 드리프트**: 운영 DB가 마이그레이션 파일과 어긋날 수 있음 (수동 ALTER 누적). 신규 DB 동기화 시 `prisma migrate deploy` + `prisma db push` 둘 다 실행 필수
- **psycopg3 + JSONB**: dict/list를 자동 변환 안 함 → `from psycopg.types.json import Json; Json(value)` 래핑 필수
- **session_replication_role='replica'**: PostgreSQL FK 우회. 의존성 순서 무시하고 INSERT 가능 (마이그레이션 시 유용)
- **`_prisma_migrations` 중복 주의**: `migrate deploy` + 데이터 dump 둘 다 같은 행 INSERT → 중복 발생. 한 쪽만 보존 필요
- **Caddyfile 블록 제거 = brace-aware 파싱 필수**: 단순 regex로는 중첩 `{...}` 처리 불가. Python으로 brace counter 작성
- **Caddy 핫 리로드**: `docker exec flowspace-caddy caddy reload --config /etc/caddy/Caddyfile` (재시작 없이 설정 적용)
- **Chrome 146 `getDisplayMedia` picker preview**: 모달 바로 아래에 active OS window의 라이브 캡처 표시. 자기 창이 active면 self-capture 재귀 발생 → WebGL canvas는 검정 fallback, Canvas 2D는 정상
- **Phaser 3 `Phaser.CANVAS` + TilemapLayer 조합**: Canvas 2D `drawImage` 매 타일 호출 시 sub-pixel 좌표에서 인접 타일 1px 줄무늬 발생 (WebGL batch 렌더는 정확). roundPixels:true로 회피 안 됨 — Canvas 2D 모드에선 타일 atlas padding 추가가 본질 해결
- **Phaser Scale.RESIZE + 게임 캔버스 `display:none`**: width/height 0 감지 → WebGL Framebuffer Incomplete Attachment 크래시. 캔버스 hide 우회 시 visibility:hidden 또는 off-screen 이동 필요 (단 self-capture 박스 회피 효과는 미검증)
- **Playwright 1.58.2 + 시스템 Chrome 채널**: dev 서버에 자동 로그인 + Phaser 캔버스 캡처 가능. `chromium.launch({ channel: "chrome" })` 또는 기본 chromium. 게임 룸 진입 후 6초 정도 대기 권장 (씬/에셋/LiveKit 로드 여유)
