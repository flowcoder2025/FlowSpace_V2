# FlowSpace Project Memory

## Project Overview
- **Name**: FlowSpace
- **Type**: flow_metaverse 리팩토링 프로젝트
- **Goal**: ComfyUI 기반 에셋 파이프라인 + 멀티에이전트 팀 시스템
- **Repo**: https://github.com/flowcoder2025/FlowSpace_V2.git

## Active Epic
| Epic | 상태 | Phase 진행 | 마지막 업데이트 |
|------|------|------------|-----------------|
| ComfyUI Asset Pipeline | 진행중 | Phase 6 완료 | 2026-02-19 |

## Architecture Decisions
- 5개 도메인 에이전트 + 오케스트레이터 체제
- Contract Governance (FlowHR 패턴 적용)
- EventBridge (React ↔ Phaser 통신)
- Socket.io (Client ↔ Server 실시간)
- Next.js 15 App Router + Prisma 6 + PostgreSQL (Supabase)
- NextAuth v5 + JWT + PrismaAdapter
- eslint-config-next v16: `defineConfig` + direct import 방식
- 백그라운드 에이전트 Write/Bash 권한 없음 → 오케스트레이터 직접 실행
- 소켓 인증: `/api/socket/token` → jose JWT 발급 → 서버 검증

## Team Structure
| Agent | Domain | Status |
|-------|--------|--------|
| Game Engine | Phaser, Avatar, Tiles | Phase 5 완료 |
| Asset Pipeline | ComfyUI, Processing | Phase 1 완료 |
| Communication | Socket.io, Realtime | Phase 4, 6 완료 |
| Frontend | Next.js, UI, Zustand | Phase 1~6 완료 |
| Backend | API, Prisma, Auth | Phase 2~3 완료 |

## Domain Work Protocol (필수 - 반드시 준수)
> **이전 세션에서 팀 프로토콜 미준수 발생. 다음 규칙 반드시 적용:**
1. 도메인 작업 전 `personas/{domain}.md` + `contracts/{domain}.md` 읽기
2. 관련 `shared/*.md` (event-protocol, data-ownership 등) 확인
3. 작업 시 "🔧 [Agent명] 역할로 작업" 명시
4. 완료 시 컨트랙트 준수 사항 보고

## Completed Work

### Phase 1: 팀 인프라 + 에셋 파이프라인 기반 ✅
- 팀 인프라 25파일 (personas, contracts, shared, memory)
- Next.js 15 스캐폴드 + Prisma 14 모델
- ComfyUI 클라이언트 (mock mode 포함)
- 워크플로우 템플릿 3종 + 에셋 파이프라인
- API 5개 + UI 2페이지 + Zustand 스토어
- EventBridge + AssetRegistry 포팅

### Phase 2: DB 연결 + 인증 시스템 ✅
- Supabase PostgreSQL 연결 (session pooler)
- NextAuth v5 (Credentials + Google/GitHub OAuth)
- 로그인/회원가입 UI + 온보딩
- 프로필 API (GET/PATCH /api/users/me)
- 게스트 세션 API (/api/guest)
- 기존 에셋 API에 인증 적용
- DB Seed (유저 2, 템플릿 3, 공간 1, 워크플로우 3)

### Phase 3: 공간(Space) 시스템 코어 ✅
- 공간 CRUD API (POST/GET/PATCH/DELETE /api/spaces)
- 멤버 관리 API (목록/참여/역할변경)
- 초대 코드 참여 API (/api/spaces/join/[inviteCode])
- 내 공간 목록 UI (/my-spaces)
- 공간 생성 UI (/spaces/new)
- 초대 참여 UI (/spaces/[inviteCode])
- Zustand space-store

### Phase 4: Socket.io 실시간 서버 ✅
- Socket.io 서버 (server/index.ts, handlers, middleware)
- JWT 기반 소켓 인증 (jose)
- Room join/leave + 접속자 관리
- 위치 동기화 브로드캐스트 (100ms throttle)
- 클라이언트 모듈 (socket/index.ts + internal/)
- useSocket 훅 (연결, 플레이어 목록, 이동 전송)

### Phase 5: Phaser 게임 엔진 ✅
- Phaser 3.90 + dynamic import (SSR 회피)
- 프로시저럴 타일셋 (512x448, Canvas API)
- 40x30 타일맵 + 6 레이어 (ground/walls/furniture/top/deco/collision)
- 프로시저럴 아바타 (4x4 grid, 24x32, 8색 팔레트)
- WASD/Arrow 이동 + 대각선 정규화 + 충돌
- 원격 플레이어 (Tween 보간) + Socket 브릿지
- 카메라 팔로우 (lerp 0.1, deadzone)
- 인터랙티브 오브젝트 (근접 48px, [E] 키)
- 공간 진입 페이지 (/space/[id]) + HUD
- **27 신규 파일, 1 수정** (tsc ✅ lint ✅ build ✅)

### Phase 6: 채팅 시스템 ✅
- 서버 채팅 핸들러 (sanitize + group/whisper 분기)
- 채팅 모듈 (useChat 훅, DOMPurify, CHAT_FOCUS EventBridge)
- 채팅 UI (ChatPanel: 접기/펼치기, 자동 스크롤, 메시지 표시)
- 통합: sendChatRef 패턴으로 순환 의존 해결
- **5 신규 파일, 5 수정** (tsc ✅ lint ✅ build ✅)

## Next Steps (Phase 7~)
1. **Phase 7: ComfyUI 실제 연동** (Asset Pipeline)
   - ComfyUI REST API 실제 연결 (현재 Mock mode)
2. Phase 8~11: 맵 에디터, 관리자, LiveKit, 배포
3. 채팅 DB 저장 / party 필터링 / 히스토리 (별도 Phase)

## Supabase DB 연결 정보
- Host: `aws-1-ap-southeast-2.pooler.supabase.com`
- Ref: `afdfkpxsfuyccdvrkqwu`
- Direct URL이 IPv6만 반환 → Session Pooler(:5432) 사용
- Prisma directUrl에 pooler URL 사용 중

## Key References (flow_metaverse)
- EventBridge: `src/features/space/game/events.ts`
- AssetRegistry: `src/config/asset-registry.ts`
- Avatar: `src/features/space/avatar/config.ts`
- MainScene: `src/features/space/game/scenes/MainScene.ts` (1661줄 → 분할 완료)
- Socket types: `src/features/space/socket/types.ts`

## Technical Notes
- npm install 완료, node_modules 존재
- prisma generate + db push 완료
- DB seed 완료 (테스트 계정: test@flowspace.dev / password123)
- build 결과: 28 라우트 (tsc ✅ eslint ✅ build ✅)
- 개발서버: `npm run dev` (3000) / `npm run dev:all` (3000+3001)

## Lessons (프로젝트 로컬)
- Supabase direct URL IPv6만 반환 시 → session pooler URL(:5432) 대체 사용
- NextAuth v5 JWT는 JWE(암호화) → 별도 서버에서 디코딩 어려움 → 별도 토큰 발급 API 사용
- `eslint-config-next v16`: refs during render 에러 → state로 전환 필요
- Phaser `textures.addSpriteSheet(key, canvas)` → TS 타입 불일치 → `as unknown as HTMLImageElement` 캐스트 필요
