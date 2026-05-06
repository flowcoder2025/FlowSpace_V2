# 디자인 시스템 전면 롤아웃

**날짜**: 2026-05-06
**유형**: Ad-hoc (마이그레이션 + 기능 강화)

## 개요

랜딩페이지에서 확정한 FlowSpace 디자인 토큰(cream/ink/line/brand)을 전체 앱(Navbar, 인증, 운영자 대시보드, 인게임 UI)으로 확장 적용.
스크립트 기반 일괄 치환(47파일) + 수동 보강(8파일) + Phaser Scale 방식 변경(1파일).

---

## 변경 파일

### 그룹 A — Navbar + 인증 + 온보딩 + 스페이스 (10파일)

| 파일 | 변경 유형 |
|------|-----------|
| `src/components/layout/navbar.tsx` | 토큰 치환 |
| `src/app/(auth)/login/page.tsx` | 토큰 치환 |
| `src/app/(auth)/register/page.tsx` | 토큰 치환 |
| `src/app/(main)/onboarding/page.tsx` | 토큰 치환 |
| `src/app/(main)/spaces/page.tsx` | 토큰 치환 |
| `src/app/(main)/spaces/new/page.tsx` | 토큰 치환 |
| `src/app/(main)/spaces/[id]/invite/page.tsx` | 토큰 치환 |
| `src/components/spaces/space-card.tsx` | 토큰 치환 |
| `src/components/spaces/space-list.tsx` | 토큰 치환 |
| `src/components/spaces/invite-form.tsx` | 토큰 치환 |

### 그룹 B — 운영자 대시보드 (17파일)

| 파일 | 변경 유형 |
|------|-----------|
| `src/app/(main)/admin/page.tsx` | 토큰 치환 |
| `src/app/(main)/admin/spaces/page.tsx` | 토큰 치환 |
| `src/app/(main)/admin/spaces/[id]/page.tsx` | 토큰 치환 |
| `src/app/(main)/admin/spaces/[id]/edit/page.tsx` | 토큰 치환 |
| `src/app/(main)/admin/users/page.tsx` | 토큰 치환 |
| `src/app/(main)/admin/users/[id]/page.tsx` | 토큰 치환 |
| `src/components/admin/admin-nav.tsx` | 토큰 치환 |
| `src/components/admin/stats-card.tsx` | 토큰 치환 |
| `src/components/admin/space-table.tsx` | 토큰 치환 |
| `src/components/admin/user-table.tsx` | 토큰 치환 |
| `src/components/admin/user-role-form.tsx` | 토큰 치환 |
| `src/components/admin/space-form.tsx` | 토큰 치환 |
| `src/components/admin/space-settings-form.tsx` | 토큰 치환 |
| `src/components/admin/map-editor-launcher.tsx` | 토큰 치환 |
| `src/components/admin/member-list.tsx` | 토큰 치환 |
| `src/components/admin/asset-manager.tsx` | 토큰 치환 |
| `src/components/admin/object-placer.tsx` | 토큰 치환 |

### 그룹 C — 게임 룸 인게임 UI (20파일)

| 파일 | 변경 유형 |
|------|-----------|
| `src/features/space/game/internal/loading-screen.tsx` | 토큰 치환 + 글래스모피즘 + font-serif + 한글화 |
| `src/features/space/game/internal/game-hud.tsx` | 토큰 치환 + 글래스모피즘 |
| `src/features/space/game/internal/connection-status.tsx` | 토큰 치환 + 한글화 ("Connected" → "연결됨") |
| `src/features/space/game/internal/video-grid.tsx` | 토큰 치환 + 글래스모피즘 |
| `src/features/space/game/internal/voice-panel.tsx` | 토큰 치환 + 글래스모피즘 |
| `src/features/space/game/internal/livekit-controls.tsx` | 토큰 치환 |
| `src/features/space/game/internal/minimap.tsx` | 토큰 치환 + 글래스모피즘 |
| `src/features/space/game/internal/interaction-prompt.tsx` | 토큰 치환 + 글래스모피즘 |
| `src/features/space/map-editor/internal/editor-toolbar.tsx` | 토큰 치환 + 글래스모피즘 + font-serif + 한글화 ("Edit Map" → "맵 편집") |
| `src/features/space/map-editor/internal/editor-panel.tsx` | 토큰 치환 + 글래스모피즘 |
| `src/features/space/map-editor/internal/tile-palette.tsx` | 토큰 치환 |
| `src/features/space/map-editor/internal/object-picker.tsx` | 토큰 치환 |
| `src/features/space/map-editor/internal/layer-panel.tsx` | 토큰 치환 |
| `src/features/space/map-editor/internal/editor-settings.tsx` | 토큰 치환 |
| `src/features/space/chat/internal/chat-panel.tsx` | **치환 제외** (의도적 예외) |
| `src/features/space/chat/internal/chat-message.tsx` | **치환 제외** (의도적 예외) |
| `src/features/space/chat/internal/chat-input.tsx` | **치환 제외** (의도적 예외) |
| `src/features/space/chat/internal/chat-header.tsx` | **치환 제외** (의도적 예외) |
| `src/features/space/chat/internal/chat-members.tsx` | **치환 제외** (의도적 예외) |
| `src/features/space/chat/internal/chat-reactions.tsx` | **치환 제외** (의도적 예외) |

### Phaser 설정 (1파일)

| 파일 | 변경 유형 |
|------|-----------|
| `src/features/space/game/internal/phaser-config.ts` | Scale 방식 변경 |

---

## 마이그레이션 매핑 테이블

스크립트 `scripts/migrate-design-system.py`에 인코딩된 치환 규칙. 재실행 가능한 자산.

### 컬러 치환

| Before | After | 의미 |
|--------|-------|------|
| `bg-blue-600` | `bg-brand` | 주요 CTA 배경 |
| `bg-blue-700` | `bg-brand-deep` | CTA hover |
| `hover:bg-blue-700` | `hover:bg-brand-deep` | CTA hover 상태 |
| `text-blue-600` | `text-brand` | 브랜드 텍스트 링크 |
| `text-gray-900` | `text-ink` | 본문 텍스트 |
| `text-gray-800` | `text-ink-soft` | 보조 텍스트 |
| `text-gray-700` | `text-ink-soft` | 보조 텍스트 |
| `text-gray-600` | `text-ink-muted` | 캡션 |
| `text-gray-500` | `text-ink-muted` | 캡션 |
| `text-gray-400` | `text-ink-light` | 비활성 |
| `text-gray-300` | `text-ink-light` | 비활성 |
| `bg-gray-50` | `bg-cream-deep` | 카드/섹션 배경 |
| `bg-gray-100` | `bg-cream-deep` | 카드/섹션 배경 |
| `bg-gray-800` | `bg-ink` | 다크 배경 |
| `bg-gray-900` | `bg-ink` | 다크 배경 |
| `border-gray-200` | `border-line` | 구분선 |
| `border-gray-300` | `border-line` | 구분선 |
| `focus:ring-blue-500` | `focus:ring-ink/20` | 포커스 링 |
| `ring-blue-500` | `ring-ink/20` | 포커스 링 |

### 의도적 미치환 컬러 (시맨틱)

| 클래스 | 유지 이유 |
|--------|-----------|
| `red-*`, `rose-*` | 에러/위험 시맨틱 |
| `green-*`, `emerald-*` | 성공/온라인 시맨틱 |
| `yellow-*`, `amber-*` | 경고 시맨틱 |
| `purple-*` | LiveKit/미디어 역할 구분 |

---

## 인게임 UI 다크 글래스모피즘 패턴

게임 월드(어두운 타일맵) 위에 올라오는 UI 패널의 공통 스타일 명세.

### 기본 패턴

```tsx
// 패널 컨테이너
className="bg-ink/80 backdrop-blur-md border border-cream/10 rounded-xl"

// 헤더 구분선
className="border-b border-cream/15"

// 버튼 (활성)
className="bg-cream/10 hover:bg-cream/20 text-cream border border-cream/15"

// 버튼 (비활성/기본)
className="bg-ink/60 hover:bg-ink/80 text-ink-light"

// 텍스트 위계
// 제목:  text-cream
// 본문:  text-cream/80
// 캡션: text-ink-light 또는 text-cream/50
```

### 투명도 선택 기준

| 투명도 | 용도 |
|--------|------|
| `bg-ink/95` | 에디터 패널 — 타일 선택 집중 필요 |
| `bg-ink/80` | HUD, 미니맵 — 게임 월드 살짝 투과 |
| `bg-ink/60` | 인터랙션 힌트 — 게임 분위기 유지 |
| `border-cream/10` | 테두리 기본 |
| `border-cream/15` | 섹션 구분선 |

### font-serif 적용 위치

LoadingScreen 헤드라인 + 에디터 패널 헤더 제목에만 적용. 본문은 font-sans 유지.

```tsx
// LoadingScreen
<h1 className="font-serif text-4xl font-light text-cream">FlowSpace</h1>

// 에디터 헤더
<h2 className="font-serif text-lg font-medium text-cream">맵 편집</h2>
```

### 한글화 목록

| Before | After |
|--------|-------|
| "Edit Map" | "맵 편집" |
| "Connected" | "연결됨" |
| "Disconnected" | "연결 끊김" |
| "Connecting..." | "연결 중..." |
| "Loading..." | "불러오는 중..." |

---

## Phaser Scale.RESIZE 결정

### 변경 내용

```typescript
// Before
scale: {
  mode: Phaser.Scale.FIT,
  autoCenter: Phaser.Scale.CENTER_BOTH,
  backgroundColor: "#1a1a2e",
}

// After
scale: {
  mode: Phaser.Scale.RESIZE,
  autoCenter: Phaser.Scale.NO_CENTER,
  backgroundColor: "#0a0a0a",
}
```

### 결정 사유

- `Scale.FIT`: letterbox(상하/좌우 여백 줄) 발생. 게임 룸이 전체 화면 컨테이너를 채우지 못함.
- `Scale.RESIZE`: parent 요소(`<div id="game-container">`) 크기를 그대로 사용. letterbox 없음. 브라우저 창 리사이즈 시 캔버스 크기 자동 추적.

### 게임 월드 좌표 영향

없음. `Scale.RESIZE`는 Phaser 내부 게임 좌표계(픽셀 단위 타일 위치, 플레이어 이동, 카메라)에 영향을 주지 않는다. 캔버스 크기만 변경되며, 카메라 뷰포트는 캔버스 크기에 자동 연동된다.

### backgroundColor 변경

`#1a1a2e` → `#0a0a0a` (ink 토큰값). 타일맵 로드 전 또는 타일 없는 영역의 배경색을 디자인 시스템과 통일.

---

## 의도적 예외

| 대상 | 예외 사유 |
|------|-----------|
| `src/features/space/chat/**` | 사용자 명시 요청 — 별도 스타일 유지 |
| 시맨틱 컬러 (`red/green/emerald/yellow`) | 상태 의미 보존 필수 |
| `src/app/(main)/admin/**` API 라우트 | UI 없음 (서버 로직만) |

---

## 마이그레이션 스크립트

`scripts/migrate-design-system.py` — 재사용 가능한 자산.

```
인수: 없음 (프로젝트 루트에서 실행)
동작: src/ 하위 .tsx/.ts 파일 스캔 → 매핑 테이블 기반 일괄 치환
예외 처리: chat/ 디렉토리 건너뜀, 시맨틱 컬러 건너뜀
출력: 치환된 파일 목록 + 변경 건수 리포트
```

---

## 비고

- 이 롤아웃 전에 `landing/2026-05-06-initial-implementation.md`에서 토큰 최초 확정. 전체 앱으로 확산되는 기준점이 됨.
- `bg-gray-*`/`text-gray-*` 계열이 앱 전체에서 제거됨. 이후 신규 컴포넌트는 반드시 FlowSpace 토큰 사용.
- Tailwind v4 `@theme` 토큰이므로 `globals.css`에서 값을 바꾸면 전체에 즉시 반영.
