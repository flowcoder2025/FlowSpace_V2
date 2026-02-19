# Frontend Contract

- **Owner**: Frontend Agent
- **Version**: 1.0.0
- **Last Updated**: 2026-02-19

## Scope

### In
- Next.js App Router 페이지
- UI 컴포넌트 (공유 + 페이지별)
- Zustand 상태 관리
- Tailwind CSS 스타일링
- 폼 처리/유효성 검증
- 반응형 레이아웃

### Out
- API 로직 (Backend)
- Phaser 게임 로직 (Game Engine)
- Socket 서버 (Communication)
- 에셋 생성 (Asset Pipeline)

## Entities
- 없음 (서버 사이드는 Backend 담당)

## API Surface

### Pages (Routes)
| Route | Description | Auth |
|-------|-------------|------|
| `/` | 랜딩 페이지 | No |
| `/spaces` | 공간 목록 | Yes |
| `/spaces/[id]` | 공간 (게임 뷰) | Yes |
| `/assets` | 에셋 관리 | Yes |
| `/assets/generate` | 에셋 생성 | Yes |

### Events Published (via EventBridge)
| Event | Payload | Description |
|-------|---------|-------------|
| `CHAT_FOCUS` | `{ focused: boolean }` | 채팅 입력 포커스 |
| `UI_OVERLAY_TOGGLE` | `{ visible: boolean }` | UI 오버레이 표시 |
| `GENERATE_ASSET_REQUEST` | `{ type, prompt, params }` | 에셋 생성 요청 |

### Events Consumed (via EventBridge)
| Event | Source | Handler |
|-------|--------|---------|
| `SCENE_READY` | Game Engine | 로딩 화면 해제 |
| `ASSET_GENERATED` | Asset Pipeline | 에셋 목록 갱신 |
| `ASSET_GENERATION_FAILED` | Asset Pipeline | 에러 토스트 표시 |

## Data Ownership
| Table | Access |
|-------|--------|
| 없음 | API 통해 데이터 접근 |

## Invariants
1. 서버 컴포넌트 우선, 클라이언트 컴포넌트 최소화
2. `"use client"` 명시적 선언
3. 컴포넌트 2회 반복 시 분리
4. 하드코딩 금지 → constants/ 분리
5. Phaser 직접 호출 금지 → EventBridge 사용

## Test Plan
- 컴포넌트 렌더링 테스트 (React Testing Library)
- 폼 유효성 검증 테스트
- 라우팅 테스트
- Zustand 스토어 테스트

## Dependencies

### Upstream
| Domain | What | How |
|--------|------|-----|
| Backend | API 엔드포인트 | REST API (fetch) |
| Game Engine | 게임 이벤트 | EventBridge |
| Communication | 채팅/상태 | Socket.io client |
| Asset Pipeline | 생성 상태 | EventBridge |

### Downstream
| Domain | What | How |
|--------|------|-----|
| Game Engine | UI 이벤트 | EventBridge |

## Breaking Changes
- v1.0.0: 초기 버전

## Consumer Impact
- 라우트 변경 시: 사용자 북마크 영향
- EventBridge 이벤트 변경 시: Game Engine 영향
