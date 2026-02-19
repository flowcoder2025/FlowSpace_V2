# Phase 7: ComfyUI 실제 연동 + 전역 네비게이션

> Epic: [ComfyUI Asset Pipeline](./README.md)
> 상태: 완료 | 업데이트: 2026-02-19

## 목표
1. ComfyUI mock mode 고정 → auto/mock/real 3-모드 전환
2. 전역 네비게이션 추가 → 모든 페이지 간 이동 가능
3. 게임 뷰에서 나가는 Exit 버튼 추가
4. 홈페이지 리디자인 (인증 상태별 대시보드/히어로)

## Agent 역할
- 🔧 **Frontend Agent**: Task 7.1~7.5, 7.9 (네비게이션, 페이지)
- 🔧 **Asset Pipeline Agent**: Task 7.6~7.8 (ComfyUI 연동)

## Task 목록
- [x] Task 7.1: 네비게이션 상수 정의
- [x] Task 7.2: Navbar 컴포넌트
- [x] Task 7.3: Root Layout에 Navbar 통합
- [x] Task 7.4: 홈페이지 리디자인
- [x] Task 7.5: 기존 페이지 정리
- [x] Task 7.6: ComfyUI 3-모드 시스템
- [x] Task 7.7: ComfyUI Status API
- [x] Task 7.8: Processor 에러 개선
- [x] Task 7.9: Navbar에 ComfyUI 상태 표시
- [x] Task 7.10: 환경변수 + 빌드 검증

## 구현 상세

### Task 7.1: 네비게이션 상수 정의
**파일:** `src/constants/navigation.ts` (NEW)

```typescript
export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  MY_SPACES: "/my-spaces",
  SPACES_NEW: "/spaces/new",
  ASSETS: "/assets",
  ASSETS_GENERATE: "/assets/generate",
  SPACE: (id: string) => `/space/${id}`,
} as const;

export const NAV_ITEMS = [
  { label: "Spaces", href: ROUTES.MY_SPACES },
  { label: "Assets", href: ROUTES.ASSETS },
] as const;

export const NAVBAR_HIDDEN_ROUTES = ["/space/"] as const;
```

### Task 7.2: Navbar 컴포넌트
**파일:** `src/components/layout/navbar.tsx` (NEW)
- `useSession()` → 인증 상태별 UI (유저명+Logout / Sign In)
- `usePathname()` → 활성 링크 하이라이팅
- ComfyUIStatusDot 포함 (Task 7.9에서 구현)

**파일:** `src/components/layout/navbar-wrapper.tsx` (NEW)
- `NAVBAR_HIDDEN_ROUTES` 체크 → `/space/` prefix면 Navbar 숨김

**파일:** `src/components/layout/index.ts` (NEW)
- Public API: `Navbar`, `NavbarWrapper` export

### Task 7.3: Root Layout에 Navbar 통합
**파일:** `src/app/layout.tsx` (MOD)
- `<SessionProvider>` 안에 `<NavbarWrapper />` 추가
- `body`에 `flex min-h-screen flex-col` 적용
- children을 `<div className="flex-1">` 래핑

### Task 7.4: 홈페이지 리디자인
**파일:** `src/app/page.tsx` (MOD)
- Server component (`auth()` 사용)
- 인증됨: `Dashboard` - 퀵 액션 카드 3개 (Spaces, Assets, Create Space)
- 미인증: `Hero` - "시작하기" CTA → `/login`

### Task 7.5: 기존 페이지 정리
**파일:** `src/app/my-spaces/page.tsx` (MOD)
- `<header>` 제거 (Navbar로 대체), `<main>` content만 유지

**파일:** `src/app/assets/generate/page.tsx` (MOD)
- "← Back to Assets" 링크 추가 (`ROUTES.ASSETS` 사용)

**파일:** `src/components/space/space-hud.tsx` (MOD)
- Exit 버튼 추가 (`<a href={ROUTES.MY_SPACES}>`)
- `<a>` 태그 사용 (full page nav → Phaser/Socket 정리 보장)

### Task 7.6: ComfyUI 3-모드 시스템
**파일:** `src/lib/comfyui/types.ts` (MOD)

```typescript
export type ComfyUIMode = "auto" | "mock" | "real";

export interface ComfyUIStatus {
  connected: boolean;
  url: string;
  mode: ComfyUIMode;
  resolvedMode: "mock" | "real";
}

export type ComfyUIErrorType =
  | "CONNECTION_REFUSED" | "TIMEOUT" | "MISSING_MODEL"
  | "INVALID_WORKFLOW" | "QUEUE_FULL" | "UNKNOWN";

export class ComfyUIError extends Error {
  constructor(message: string, public readonly type: ComfyUIErrorType, public readonly cause?: unknown);
  static fromError(error: unknown): ComfyUIError; // 자동 분류
}
```

- `ComfyUIConfig.mockMode: boolean` → `mode: ComfyUIMode`로 전환

**파일:** `src/lib/comfyui/config.ts` (MOD)
- `COMFYUI_MODE` 환경변수 읽기 (auto/mock/real)
- `COMFYUI_MOCK_MODE` 하위호환 유지 (true → mock)
- 기본값: "auto"

**파일:** `src/lib/comfyui/client.ts` (MOD)
- `resolveEffectiveMode()`: auto → 연결 체크 → real/mock 캐시 (30초 TTL)
- 모든 메서드에서 `resolveEffectiveMode()` 호출
- `getStatus(): Promise<ComfyUIStatus>` 추가
- 에러를 `ComfyUIError.fromError()`로 래핑

**파일:** `src/lib/comfyui/index.ts` (MOD)
- `ComfyUIError`, `ComfyUIMode`, `ComfyUIStatus`, `ComfyUIErrorType` export 추가

### Task 7.7: ComfyUI Status API
**파일:** `src/app/api/comfyui/status/route.ts` (NEW)
- `GET` → `client.getStatus()` 반환
- 인증 불필요 (개발 유틸리티)

### Task 7.8: Processor 에러 개선
**파일:** `src/features/assets/internal/processor.ts` (MOD)
- `ComfyUIError.fromError()` 적용
- 에러 타입별 한국어 메시지 (CONNECTION_REFUSED, TIMEOUT, MISSING_MODEL, INVALID_WORKFLOW)
- `console.error` 로깅 강화

### Task 7.9: Navbar에 ComfyUI 상태 표시
**파일:** `src/components/layout/navbar.tsx` (MOD)
- `ComfyUIStatusDot` 구현: `/api/comfyui/status` 30초 폴링
- dot indicator: green (real), yellow (mock)
- `process.env.NODE_ENV !== "development"` → dev에서만 표시

### Task 7.10: 환경변수 + 빌드 검증
**파일:** `.env` (MOD) → `COMFYUI_MODE="auto"` 추가
- `tsc --noEmit` ✅
- `next lint` ✅
- `next build` ✅ (29 라우트)

## 변경된 파일
| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `src/constants/navigation.ts` | NEW | 라우트/네비 상수 |
| `src/components/layout/navbar.tsx` | NEW | 전역 네비게이션 바 |
| `src/components/layout/navbar-wrapper.tsx` | NEW | 조건부 렌더링 래퍼 |
| `src/components/layout/index.ts` | NEW | 레이아웃 모듈 Public API |
| `src/app/api/comfyui/status/route.ts` | NEW | ComfyUI 상태 엔드포인트 |
| `src/app/layout.tsx` | MOD | Navbar 통합, flex layout |
| `src/app/page.tsx` | MOD | 홈 리디자인 (Dashboard/Hero) |
| `src/app/my-spaces/page.tsx` | MOD | 헤더 제거 |
| `src/app/assets/generate/page.tsx` | MOD | 뒤로가기 링크 |
| `src/components/space/space-hud.tsx` | MOD | Exit 버튼 |
| `src/lib/comfyui/types.ts` | MOD | ComfyUIMode, Error, Status 타입 |
| `src/lib/comfyui/config.ts` | MOD | 3-모드 설정 |
| `src/lib/comfyui/client.ts` | MOD | auto 폴백, getStatus() |
| `src/lib/comfyui/index.ts` | MOD | 새 export 추가 |
| `src/features/assets/internal/processor.ts` | MOD | 에러 타입별 처리 |
| `.env` | MOD | COMFYUI_MODE=auto |

## 의도적 제외
- WebSocket 진행률 → 폴링으로 충분
- sharp 썸네일 → 원본 복사 (Windows native 이슈 방지)
- SSE/스트리밍 → 폴링으로 충분
