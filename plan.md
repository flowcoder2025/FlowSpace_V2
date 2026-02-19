# FlowSpace 전체 로드맵

> **최종 업데이트**: 2026-02-19
> **Repo**: https://github.com/flowcoder2025/FlowSpace_V2.git
> **기반**: flow_metaverse 리팩토링 + ComfyUI AI 에셋 파이프라인 신규

---

## 프로젝트 비전

FlowSpace는 **2D 메타버스 플랫폼**으로, 사용자가 가상 공간에서 아바타로 이동하며
실시간으로 소통하고, **AI(ComfyUI)로 게임 에셋을 자동 생성**할 수 있는 서비스이다.

### flow_metaverse 대비 개선점
| 기존 문제 | FlowSpace 해결책 |
|-----------|-----------------|
| 수동 에셋 파이프라인 (Nanobanana3 → chroma-key) | ComfyUI 기반 AI 자동 생성 |
| `SpaceLayout.tsx` 66KB God Component | 5 도메인 모듈 분리 |
| `MainScene.ts` 1661줄 | 씬 모듈화 (scene, sprite, tilemap 분리) |
| 음성/영상 불안정 | LiveKit 재설계 (단순화) |
| 공간기반 커뮤니케이션 버그 다수 | Socket.io 이벤트 재설계 |

### 기술 스택
| 레이어 | 기술 |
|--------|------|
| Frontend | Next.js 15, React 19, Tailwind CSS 4, Radix UI |
| Game | Phaser 3.90 |
| State | Zustand 5 |
| Backend | Next.js API Routes, Prisma 6, PostgreSQL |
| Auth | NextAuth 5 |
| Real-time | Socket.io 4 |
| Voice/Video | LiveKit (예정) |
| AI Asset | ComfyUI REST API |

### 팀 구조
5개 도메인 에이전트 + 오케스트레이터 (Contract Governance)

| Agent | Domain | 소유 경로 |
|-------|--------|----------|
| Game Engine | Phaser, Avatar, Tiles | `src/features/space/game/`, `src/features/space/avatar/` |
| Asset Pipeline | ComfyUI, Processing | `src/features/assets/`, `src/lib/comfyui/` |
| Communication | Socket.io, Realtime | `src/features/space/socket/`, `server/` |
| Frontend | Next.js, UI, Zustand | `src/app/`, `src/components/` |
| Backend | API, Prisma, Auth | `src/app/api/`, `prisma/`, `src/lib/` |

---

## 로드맵 개요

```
Phase 1  ✅ 팀 인프라 + 에셋 파이프라인 기반        ← 완료
Phase 2  ✅ DB 연결 + 인증 시스템                    ← 완료
Phase 3  ✅ 공간(Space) 시스템 코어                   ← 완료
Phase 4  ✅ Socket.io 실시간 서버                     ← 완료
Phase 5  ✅ Phaser 게임 엔진                          ← 완료
Phase 6  ✅ 채팅 시스템                               ← 완료 (보완 포함)
Phase 7  ✅ ComfyUI 실제 연동 + 에셋 스튜디오         ← 완료 (보완 포함)
Phase 8  🔲 맵 에디터                                 ← 공간 커스터마이징
Phase 9  🔲 관리자 대시보드                            ← 운영 도구
Phase 10 🔲 음성/영상 (LiveKit)                       ← 고급 커뮤니케이션
Phase 11 🔲 테스트 + 최적화 + 배포                     ← 프로덕션 준비
```

---

## Phase 1: 팀 인프라 + 에셋 파이프라인 기반 ✅ 완료

> 2026-02-19 완료 | 59파일 생성 | [스펙](/.claude/specs/comfyui-asset-pipeline/01-infra-and-pipeline.md)

### 완료 항목
- [x] 팀 인프라 25파일 (personas, contracts, shared, memory, PROTOCOL, RACI)
- [x] Next.js 15 프로젝트 스캐폴드 (package.json, tsconfig, eslint, layout)
- [x] Prisma 스키마 14 모델 (flow_metaverse 기반 + GeneratedAsset, AssetWorkflow 신규)
- [x] ComfyUI REST 클라이언트 (client, types, config, mock mode)
- [x] 워크플로우 템플릿 3종 (character-sprite, tileset-grid, map-background)
- [x] 에셋 후처리 파이프라인 (processor, validator, specs, workflow-loader)
- [x] 에셋 API 5개 (generate, list, detail, delete, workflows)
- [x] 에셋 UI (AssetGenerateForm, AssetList, Zustand store)
- [x] EventBridge + AssetRegistry + Phaser 에셋 로더
- [x] Level 1 검증 통과 (tsc, eslint, build)

### 산출물
| 카테고리 | 파일 수 | 경로 |
|----------|---------|------|
| 팀 인프라 | 25 | `.claude/team/` |
| Prisma | 1 | `prisma/schema.prisma` |
| ComfyUI | 4 | `src/lib/comfyui/` |
| 에셋 파이프라인 | 6 | `src/features/assets/` |
| API | 4 | `src/app/api/` |
| UI | 4 | `src/components/assets/`, `src/app/assets/` |
| 게임엔진 기반 | 5 | `src/features/space/game/` |
| 워크플로우 | 3 | `comfyui-workflows/` |
| 설정/기타 | 7 | root config files |

---

## Phase 2: DB 연결 + 인증 시스템 ✅ 완료

> 2026-02-19 완료 | **도메인**: Backend
> **목표**: PostgreSQL 연결, NextAuth 인증, 사용자 관리 API

### 왜 먼저?
모든 기능(공간 생성, 채팅, 에셋 저장 등)이 인증된 사용자 ID를 필요로 함.
DB 없이는 어떤 데이터도 영속화할 수 없음.

### Tasks
| # | Task | 설명 | 예상 파일 |
|---|------|------|----------|
| 2.1 | PostgreSQL 설정 | `.env`에 DATABASE_URL, `prisma db push` 실행 | `.env`, `prisma/` |
| 2.2 | NextAuth 설정 | Google/GitHub OAuth + Credentials provider | `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts` |
| 2.3 | 인증 미들웨어 | 보호된 라우트 미들웨어 + 세션 체크 | `src/middleware.ts` |
| 2.4 | 로그인/회원가입 UI | 로그인 페이지 + 온보딩 플로우 | `src/app/login/`, `src/app/onboarding/` |
| 2.5 | 사용자 프로필 API | GET/PATCH `/api/users/me`, 닉네임/아바타 설정 | `src/app/api/users/` |
| 2.6 | 게스트 세션 | 비로그인 사용자 임시 세션 토큰 발급 | `src/lib/guest.ts` |
| 2.7 | 기존 API 인증 적용 | 에셋 API에 세션 체크 추가 | `src/app/api/assets/` 수정 |
| 2.8 | DB Seed | 테스트 데이터 (유저, 공간 템플릿, 워크플로우) | `prisma/seed.ts` |

### 핵심 산출물
```
src/lib/auth.ts                          # NextAuth 설정
src/app/api/auth/[...nextauth]/route.ts  # Auth API
src/middleware.ts                         # 라우트 보호
src/app/login/page.tsx                   # 로그인 페이지
src/app/onboarding/page.tsx              # 온보딩
src/app/api/users/me/route.ts            # 프로필 API
prisma/seed.ts                           # DB 시드
.env                                     # 환경변수
```

### flow_metaverse 참조
- `src/app/api/auth/[...nextauth]/route.ts` - NextAuth 설정
- `src/app/login/page.tsx` - 로그인 UI
- `src/app/onboarding/page.tsx` - 온보딩 플로우
- `prisma/schema.prisma` - User, Account, Session 모델

### 검증 기준
- [x] DB 연결 성공 (`prisma db push`)
- [x] OAuth 로그인 동작 (Google or GitHub)
- [x] 세션 쿠키 발급 확인
- [x] 미인증 사용자 API 403 응답
- [x] Level 1 검증 통과

---

## Phase 3: 공간(Space) 시스템 코어 ✅ 완료

> 2026-02-19 완료 | **도메인**: Backend + Frontend
> **목표**: 공간 생성/참여/관리, 멤버 권한 시스템

### Tasks
| # | Task | 설명 |
|---|------|------|
| 3.1 | 공간 CRUD API | POST/GET/PATCH/DELETE `/api/spaces` |
| 3.2 | 공간 접근 제어 | PUBLIC/PRIVATE/PASSWORD, 초대 코드 |
| 3.3 | 멤버 관리 API | 참여/탈퇴/역할변경 (OWNER, STAFF, PARTICIPANT) |
| 3.4 | 공간 템플릿 | OFFICE, CLASSROOM, LOUNGE 기본 템플릿 데이터 |
| 3.5 | 내 공간 목록 UI | `/my-spaces` - 공간 카드 그리드 + 생성 버튼 |
| 3.6 | 공간 생성 UI | `/spaces/new` - 이름, 템플릿, 접근방식 폼 |
| 3.7 | 공간 참여 플로우 | `/spaces/[inviteCode]` - 초대 링크 → 참여 |
| 3.8 | 공간 Zustand 스토어 | 현재 공간 상태, 멤버 목록 관리 |

### 핵심 산출물
```
src/app/api/spaces/route.ts              # 공간 목록 + 생성
src/app/api/spaces/[id]/route.ts         # 공간 상세/수정/삭제
src/app/api/spaces/[id]/members/route.ts # 멤버 관리
src/app/my-spaces/page.tsx               # 내 공간 목록
src/app/spaces/new/page.tsx              # 공간 생성
src/app/spaces/[inviteCode]/page.tsx     # 초대 참여
src/components/spaces/                   # 공간 관련 UI 컴포넌트
src/stores/space-store.ts                # 공간 상태 관리
```

### flow_metaverse 참조
- `src/app/my-spaces/page.tsx` - 공간 목록 UI
- `src/app/spaces/new/page.tsx` - 생성 폼
- `prisma/schema.prisma` - Space, SpaceMember, Template 모델

### 검증 기준
- [x] 공간 생성 → DB 저장 → 목록 노출
- [x] 초대 코드로 참여 동작
- [x] 멤버 역할 (OWNER가 STAFF 지정 가능)
- [x] Level 1 검증 통과

---

## Phase 4: Socket.io 실시간 서버 ✅ 완료

> 2026-02-19 완료 | **도메인**: Communication
> **목표**: 멀티플레이어 기반 (입장/퇴장, 위치 동기화, 이벤트 브로드캐스트)

### Tasks
| # | Task | 설명 |
|---|------|------|
| 4.1 | Socket.io 서버 설정 | `server/index.ts` - Express + Socket.io, CORS, 네임스페이스 |
| 4.2 | 인증 미들웨어 | 소켓 연결 시 세션 검증 (NextAuth 토큰 or 게스트 토큰) |
| 4.3 | Room 관리 | 공간별 Room join/leave, 접속자 목록 브로드캐스트 |
| 4.4 | 위치 동기화 | 플레이어 위치 수신 → Room 내 브로드캐스트 (경량 payload) |
| 4.5 | 이벤트 타입 정의 | `src/features/space/socket/types.ts` - C2S/S2C 이벤트 타입 |
| 4.6 | 클라이언트 훅 | `useSocket()` - 연결/해제/재연결 + 이벤트 핸들링 |
| 4.7 | EventBridge 연동 | Socket 이벤트 → EventBridge → Phaser 전달 |
| 4.8 | 이벤트 로그 | SpaceEventLog에 입장/퇴장 기록 |

### 핵심 산출물
```
server/
├── index.ts                             # Socket.io 서버 엔트리
├── middleware/auth.ts                   # 소켓 인증
├── handlers/room.ts                    # Room 관리
├── handlers/movement.ts               # 위치 동기화
└── handlers/events.ts                  # 이벤트 라우팅

src/features/space/socket/
├── index.ts                            # Public API
├── internal/
│   ├── types.ts                       # C2S/S2C 이벤트 타입
│   ├── use-socket.ts                  # React 훅
│   └── socket-client.ts              # 클라이언트 인스턴스
```

### flow_metaverse 참조
- `src/features/space/socket/types.ts` - 50+ 이벤트 타입
- `server/` 디렉토리 구조 (없으면 새로 설계)
- 경량 위치 payload 패턴 (x, y, direction만 전송)

### 검증 기준
- [x] `npm run dev:all`로 Next.js + Socket.io 동시 실행
- [x] 소켓 연결/해제 동작
- [x] Room join/leave + 접속자 목록 갱신
- [x] 위치 동기화 브로드캐스트
- [x] Level 1 검증 통과

---

## Phase 5: Phaser 게임 엔진 ✅ 완료

> 2026-02-19 완료 | **도메인**: Game Engine
> **목표**: 2D 월드 렌더링, 아바타 이동, 타일맵, 오브젝트 상호작용

### Tasks
| # | Task | 설명 |
|---|------|------|
| 5.1 | Phaser 초기화 | Next.js 내 Phaser Canvas 마운트 (dynamic import, SSR 회피) |
| 5.2 | MainScene 구현 | 타일맵 로드, 레이어 렌더링, 카메라 설정 |
| 5.3 | 아바타 시스템 | 스프라이트 애니메이션, 4방향 이동 (WASD/Arrow) |
| 5.4 | 원격 플레이어 | Socket 위치 수신 → 다른 플레이어 렌더링/보간 이동 |
| 5.5 | 충돌 시스템 | 타일맵 충돌 레이어 + 오브젝트 충돌 |
| 5.6 | 카메라 팔로우 | 플레이어 추적 카메라 + 월드 바운드 |
| 5.7 | 오브젝트 상호작용 | 맵 오브젝트 클릭/근접 → 이벤트 발생 |
| 5.8 | 공간 진입 페이지 | `/space/[id]/page.tsx` - Phaser + UI 오버레이 통합 |

### 핵심 산출물
```
src/features/space/game/
├── index.ts
├── internal/
│   ├── scenes/
│   │   ├── main-scene.ts              # 메인 게임 씬
│   │   ├── preload-scene.ts           # 에셋 프리로드
│   │   └── ui-scene.ts                # UI 오버레이 씬
│   ├── sprites/
│   │   ├── player-sprite.ts           # 내 아바타
│   │   └── remote-sprite.ts           # 다른 플레이어
│   ├── tilemap/
│   │   ├── tilemap-loader.ts          # 타일맵 로드/렌더
│   │   └── collision.ts               # 충돌 레이어
│   └── objects/
│       ├── map-object.ts              # 맵 오브젝트 기반
│       └── interactive.ts             # 상호작용 로직

src/features/space/avatar/
├── index.ts
├── internal/
│   ├── avatar-config.ts               # 아바타 설정 (색상, 파츠)
│   ├── avatar-schema.ts               # Zod 검증 스키마
│   └── sprite-generator.ts            # 프로시저럴 스프라이트 생성

src/app/space/[id]/page.tsx             # 공간 진입 페이지
src/components/space/                   # 공간 내 UI 오버레이
```

### flow_metaverse 참조
- `src/features/space/game/scenes/MainScene.ts` - 메인 씬 (1661줄 → 분할 대상)
- `src/features/space/avatar/config.ts` - 아바타 설정
- `src/features/space/avatar/avatar.schema.ts` - 커스터마이징 스키마
- `src/features/space/game/tiles/TilesetGenerator.ts` - 타일셋 생성

### 검증 기준
- [x] Phaser 캔버스 렌더링 (Next.js SSR 에러 없음)
- [x] 아바타 WASD 이동 + 애니메이션
- [x] 타일맵 렌더링 + 충돌
- [x] 원격 플레이어 동기화 (2개 브라우저 테스트)
- [x] Level 1 검증 통과

---

## Phase 6: 채팅 시스템 ✅ 완료 (보완 포함)

> 2026-02-19 완료 | **도메인**: Communication + Frontend
> **목표**: 실시간 텍스트 채팅 (전체/귓속말/파티존/시스템/리액션/관리)

### Tasks
| # | Task | 설명 |
|---|------|------|
| 6.1 | 채팅 Socket 핸들러 | 메시지 수신 → Room 브로드캐스트 → DB 저장 |
| 6.2 | 메시지 타입 | MESSAGE, WHISPER, PARTY, SYSTEM, ANNOUNCEMENT |
| 6.3 | 채팅 API | GET `/api/spaces/[id]/messages` (히스토리 로드) |
| 6.4 | 채팅 UI | 채팅 패널 (드래그 가능), 입력창, 메시지 리스트 |
| 6.5 | 귓속말 | 특정 유저에게 1:1 메시지 |
| 6.6 | 메시지 리액션 | 👍❤️✅ 리액션 추가/제거 |
| 6.7 | 파티존 채팅 | 특정 영역 내 유저만 참여하는 그룹 채팅 |
| 6.8 | XSS 방지 | DOMPurify로 메시지 새니타이징 |

### 핵심 산출물
```
server/handlers/chat.ts                  # 채팅 이벤트 핸들러 (Optimistic, DB저장, 관리)
server/handlers/party.ts                 # 파티존 채팅 핸들러
src/app/api/spaces/[id]/messages/route.ts # 메시지 히스토리 API (cursor 페이지네이션)
src/features/space/chat/internal/
├── chat-types.ts                        # MessageType, ChatTab, Reaction 등 타입
├── chat-filter.ts                       # 탭별 필터링, URL 추출
├── chat-parser.ts                       # 입력 파싱 (whisper, admin command)
├── use-chat.ts                          # 채팅 훅 (리액션, reply, ID매핑)
└── use-chat-storage.ts                  # LocalStorage 캐싱 (7일 만료)
src/components/space/
├── chat-panel.tsx                       # 오케스트레이터
└── chat/
    ├── chat-tabs.tsx                    # 5탭 (all/party/whisper/system/links)
    ├── chat-message-list.tsx            # 메시지 렌더링 (리액션, 답장, 호버 액션)
    └── chat-input-area.tsx              # 입력 (귓속말/관리명령/파티모드)
```

### 검증 기준
- [x] 실시간 메시지 송수신
- [x] 귓속말 대상만 수신 확인
- [x] XSS 공격 차단 (`<script>` 무력화)
- [x] 리액션 토글 동작
- [x] 파티존 채팅 분리
- [x] 관리 명령 (mute/unmute/kick/announce)
- [x] Level 1 검증 통과

---

## Phase 7: ComfyUI 실제 연동 + 에셋 스튜디오 ✅ 완료 (보완 포함)

> 2026-02-19 완료 | **도메인**: Asset Pipeline
> **목표**: Mock → Real ComfyUI 전환, 에셋 스튜디오 UI 고도화, DB기록, 배치생성

### Tasks
| # | Task | 설명 |
|---|------|------|
| 7.1 | ComfyUI 연결 테스트 | 실제 ComfyUI 인스턴스 연결 (포트 8001) |
| 7.2 | WebSocket 진행률 | 생성 진행 상황 실시간 표시 |
| 7.3 | 이미지 저장 | 생성된 이미지 → `public/assets/` 저장 + DB 기록 |
| 7.4 | 썸네일 생성 | 원본 → 썸네일 자동 생성 |
| 7.5 | 에셋 스튜디오 UI | 프롬프트 에디터 + 미리보기 + 히스토리 |
| 7.6 | 에셋 → 게임 적용 | 생성된 에셋을 Phaser에 즉시 로드 |
| 7.7 | 배치 생성 | 여러 에셋 동시 생성 큐 |
| 7.8 | 워크플로우 커스터마이징 | 사용자가 파라미터 조정 가능한 UI |

### 핵심 산출물
```
src/lib/comfyui/
├── client.ts                           # Real mode 강화
├── websocket.ts                        # WS 진행률 추적
└── storage.ts                          # 이미지 저장/썸네일

src/app/assets/studio/page.tsx          # 에셋 스튜디오
src/components/assets/
├── asset-studio.tsx                    # 스튜디오 메인
├── prompt-editor.tsx                   # 프롬프트 에디터
├── generation-progress.tsx             # 진행률 표시
└── asset-preview.tsx                   # 미리보기
```

### 검증 기준
- [x] 실제 ComfyUI에서 이미지 생성 성공 (auto/mock/real 3-모드)
- [x] 생성된 이미지 파일 저장 + DB 기록 (GeneratedAsset 테이블)
- [x] 생성 진행률 폴링 표시
- [x] 에셋 스튜디오 UI (2-column, 프롬프트 에디터, 미리보기, 히스토리)
- [x] 배치 생성 API + UI
- [x] 에셋 → 게임 로더 (EventBridge ASSET_GENERATED)
- [x] 워크플로우 선택 드롭다운
- [x] 전역 네비게이션 (Studio 추가)
- [x] Level 1 검증 통과

---

## Phase 8: 맵 에디터 🔲

> **의존**: Phase 5 | **도메인**: Game Engine + Frontend
> **목표**: 공간 커스터마이징 (오브젝트 배치, 포탈, 가구)

### Tasks
| # | Task | 설명 |
|---|------|------|
| 8.1 | 에디터 모드 토글 | 일반 모드 ↔ 에디터 모드 전환 |
| 8.2 | 오브젝트 팔레트 | AssetRegistry 기반 배치 가능 오브젝트 목록 |
| 8.3 | 드래그 앤 드롭 배치 | 오브젝트를 맵에 드래그하여 배치 |
| 8.4 | 오브젝트 CRUD | 배치/이동/회전/삭제 + API 저장 |
| 8.5 | 포탈 링크 | 두 포탈 오브젝트 연결 (텔레포트) |
| 8.6 | 실시간 동기화 | 에디터 변경 → Socket 브로드캐스트 |
| 8.7 | AI 에셋 연동 | Phase 7에서 생성한 에셋을 맵에 배치 가능 |
| 8.8 | 에디터 UI | 사이드바 팔레트 + 속성 패널 |

### 핵심 산출물
```
src/features/space/game/internal/editor/
├── editor-mode.ts                      # 에디터 모드 관리
├── object-placer.ts                    # 오브젝트 배치 로직
└── portal-linker.ts                    # 포탈 연결

src/app/api/spaces/[id]/objects/route.ts # 맵 오브젝트 API
src/components/editor/
├── editor-toolbar.tsx                  # 에디터 도구바
├── object-palette.tsx                  # 오브젝트 팔레트
└── property-panel.tsx                  # 속성 편집
src/stores/editor-store.ts             # 에디터 상태
```

### flow_metaverse 참조
- 맵 에디터 컴포넌트
- MapObject 모델 (position, rotation, customData)
- pair linking 패턴 (포탈)

### 검증 기준
- [ ] 오브젝트 배치/이동/삭제 동작
- [ ] 포탈 텔레포트 동작
- [ ] AI 생성 에셋 맵 배치
- [ ] Level 1 검증 통과

---

## Phase 9: 관리자 대시보드 🔲

> **의존**: Phase 3, 6 | **도메인**: Backend + Frontend
> **목표**: 공간 관리, 멤버 관리, 이벤트 로그, 분석

### Tasks
| # | Task | 설명 |
|---|------|------|
| 9.1 | 관리자 라우트 보호 | OWNER/STAFF만 접근 가능 |
| 9.2 | 공간 대시보드 | 접속자 수, 메시지 수, 에셋 수 요약 |
| 9.3 | 멤버 관리 | 역할 변경, 뮤트, 킥, 밴 |
| 9.4 | 이벤트 로그 | SpaceEventLog 조회 + 필터링 |
| 9.5 | 공지사항 | 전체 공지 브로드캐스트 |
| 9.6 | 메시지 관리 | 메시지 삭제 (모더레이션) |
| 9.7 | 사용량 분석 | 일별/시간별 접속자, 채팅량 차트 |
| 9.8 | 공간 설정 | 브랜딩 (로고, 색상), 최대 인원, 접근 방식 |

### 핵심 산출물
```
src/app/dashboard/spaces/[id]/
├── page.tsx                            # 대시보드 메인
├── members/page.tsx                    # 멤버 관리
├── logs/page.tsx                       # 이벤트 로그
└── settings/page.tsx                   # 공간 설정

src/app/api/spaces/[id]/admin/
├── members/route.ts                    # 멤버 관리 API
├── logs/route.ts                       # 이벤트 로그 API
└── analytics/route.ts                  # 분석 API

src/components/dashboard/               # 대시보드 UI
```

### flow_metaverse 참조
- `src/app/admin/` - 관리자 페이지
- `src/app/dashboard/spaces/[id]/` - 공간 대시보드
- UsageHourly/Daily 모델, ResourceSnapshot 패턴

### 검증 기준
- [ ] OWNER만 대시보드 접근 가능
- [ ] 멤버 뮤트/킥 동작
- [ ] 이벤트 로그 필터 동작
- [ ] Level 1 검증 통과

---

## Phase 10: 음성/영상 (LiveKit) 🔲

> **의존**: Phase 4, 5 | **도메인**: Communication
> **목표**: 근접 기반 음성/영상 통화

### 개요
flow_metaverse에서 가장 불안정했던 영역. **단순화 우선**으로 재설계.

### Tasks
| # | Task | 설명 |
|---|------|------|
| 10.1 | LiveKit 서버 설정 | LiveKit Cloud 또는 Self-hosted 설정 |
| 10.2 | 토큰 발급 API | LiveKit 접속 토큰 생성 |
| 10.3 | 연결 훅 | `useLiveKit()` - 연결/해제/디바이스 관리 |
| 10.4 | 근접 구독 | 근처 플레이어만 음성/영상 구독 (거리 기반) |
| 10.5 | 마이크/카메라 토글 | ON/OFF + 볼륨 미터 |
| 10.6 | 화면 공유 | 스크린 쉐어 + 뷰어 UI |
| 10.7 | UI 오버레이 | 음성/영상 상태 표시, 디바이스 설정 |
| 10.8 | 스포트라이트 | 관리자가 특정 유저를 하이라이트 |

### 핵심 산출물
```
src/features/space/livekit/
├── index.ts
├── internal/
│   ├── use-livekit.ts                  # 연결 훅
│   ├── proximity.ts                    # 근접 구독 로직
│   └── device-manager.ts              # 디바이스 관리

src/app/api/livekit/token/route.ts      # 토큰 발급
src/components/media/                   # 미디어 컨트롤 UI
```

### flow_metaverse 참조
- `src/features/space/livekit/useLiveKit.ts` - 연결 훅
- 근접 구독 로직 (불안정 → 재설계 대상)
- 스포트라이트 기능

### 검증 기준
- [ ] 음성 통화 동작 (2인 이상)
- [ ] 근접 거리 밖 유저 음성 차단
- [ ] 마이크/카메라 토글
- [ ] Level 1 검증 통과

---

## Phase 11: 테스트 + 최적화 + 배포 🔲

> **의존**: Phase 1~10 | **도메인**: 전체
> **목표**: 프로덕션 품질 달성

### Tasks
| # | Task | 설명 |
|---|------|------|
| 11.1 | 단위 테스트 | 에셋 파이프라인, 유틸리티, API 핸들러 |
| 11.2 | 통합 테스트 | 인증 플로우, 공간 생성→참여→채팅 |
| 11.3 | E2E 테스트 | Playwright - 주요 유저 플로우 |
| 11.4 | 성능 최적화 | 번들 사이즈, 이미지 최적화, 코드 스플리팅 |
| 11.5 | Socket 최적화 | 메시지 배칭, 위치 업데이트 throttle |
| 11.6 | CI/CD | GitHub Actions - Level 1/2/3 자동 검증 |
| 11.7 | 환경 분리 | dev/staging/production 환경 설정 |
| 11.8 | Vercel 배포 | 프로덕션 배포 + Socket.io 서버 분리 배포 |

### 핵심 산출물
```
__tests__/
├── unit/                              # 단위 테스트
├── integration/                       # 통합 테스트
└── e2e/                              # E2E 테스트

.github/workflows/
├── ci.yml                            # PR 검증
├── cd.yml                            # 자동 배포
└── contract-gate.yml                 # Contract 검증

jest.config.ts                        # Jest 설정
playwright.config.ts                  # Playwright 설정
```

### 검증 기준
- [ ] 테스트 커버리지 > 70%
- [ ] Lighthouse 성능 점수 > 80
- [ ] 프로덕션 빌드 에러 없음
- [ ] CI 파이프라인 Green

---

## 의존성 그래프

```
Phase 1 (✅)
    │
    ├──→ Phase 2 (✅ DB + Auth)
    │       │
    │       ├──→ Phase 3 (✅ Space)
    │       │       │
    │       │       ├──→ Phase 4 (✅ Socket.io)
    │       │       │       │
    │       │       │       ├──→ Phase 5 (✅ Phaser)
    │       │       │       │       │
    │       │       │       │       └──→ Phase 8 (🔲 Map Editor)
    │       │       │       │
    │       │       │       ├──→ Phase 6 (✅ Chat)
    │       │       │       │
    │       │       │       └──→ Phase 10 (🔲 LiveKit)
    │       │       │
    │       │       └──→ Phase 9 (🔲 Admin)
    │       │
    │       └──→ Phase 7 (✅ ComfyUI Real)
    │
    └──→ Phase 11 (🔲 Test + Deploy) ← 모든 Phase 후
```

## 우선순위 요약

| 우선순위 | Phase | 이유 |
|---------|-------|------|
| 🔴 Critical | 2 (Auth) | 모든 기능의 전제조건 |
| 🔴 Critical | 3 (Space) | 메타버스의 핵심 단위 |
| 🟠 High | 4 (Socket) | 멀티플레이어 필수 |
| 🟠 High | 5 (Phaser) | 메타버스 경험의 핵심 |
| 🟡 Medium | 6 (Chat) | 기본 커뮤니케이션 |
| 🟡 Medium | 7 (ComfyUI) | FlowSpace 차별화 포인트 |
| 🟢 Normal | 8 (Editor) | 공간 커스터마이징 |
| 🟢 Normal | 9 (Admin) | 운영 필수 |
| 🔵 Low | 10 (LiveKit) | 고급 기능, 복잡도 높음 |
| 🔵 Low | 11 (Deploy) | 마지막 단계 |

---

## 마일스톤

| 마일스톤 | 포함 Phase | 목표 |
|---------|-----------|------|
| **M1: 로그인 가능** | Phase 2 | 인증 + DB 동작 |
| **M2: 공간 입장 가능** | Phase 3, 4, 5 | 공간 생성 → 입장 → 아바타 이동 |
| **M3: 채팅 가능** | Phase 6 | 실시간 텍스트 채팅 |
| **M4: AI 에셋 생성** | Phase 7 | ComfyUI로 에셋 생성 → 게임 적용 |
| **M5: 공간 꾸미기** | Phase 8 | 맵 에디터 + AI 에셋 배치 |
| **M6: 운영 가능** | Phase 9, 10 | 관리자 도구 + 음성/영상 |
| **M7: 프로덕션** | Phase 11 | 테스트 완료 + 배포 |

---

## Prisma 스키마 현황 (14 모델)

| 모델 | 도메인 | Phase | 상태 |
|------|--------|-------|------|
| User | Auth | 2 ✅ | 사용 중 (NextAuth) |
| Account | Auth | 2 ✅ | 사용 중 (OAuth) |
| Session | Auth | 2 ✅ | 사용 중 (세션 관리) |
| VerificationToken | Auth | 2 ✅ | 스키마 정의됨 |
| Space | Space | 3 ✅ | 사용 중 (공간 CRUD) |
| Template | Space | 3 ✅ | 사용 중 (맵 템플릿) |
| SpaceMember | Space | 3 ✅ | 사용 중 (멤버십/권한) |
| GuestSession | Auth | 2 ✅ | 사용 중 (게스트 세션) |
| ChatMessage | Chat | 6 ✅ | 사용 중 (채팅 DB 저장) |
| PartyZone | Chat | 6 ✅ | 스키마 정의됨, 준비 완료 |
| MapObject | Editor | 8 | 스키마 정의됨, Phase 8 대기 |
| SpaceEventLog | Admin | 9 | 스키마 정의됨, Phase 9 대기 |
| GeneratedAsset | Asset | 7 ✅ | 사용 중 (에셋 생성/조회/배치) |
| AssetWorkflow | Asset | 7 ✅ | 사용 중 (워크플로우 관리) |

> 참고: flow_metaverse는 23 모델. FlowSpace는 핵심 14개로 시작, 필요 시 추가
> (Spotlight, UsageHourly/Daily, ResourceSnapshot 등은 해당 Phase에서 추가)
