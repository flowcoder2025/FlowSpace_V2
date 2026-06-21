# 모듈 경계 캡슐화 정리 (WI-003-refactor)

- **WI**: WI-003-refactor
- **일자**: 2026-06-22
- **목표**: 타 모듈의 `internal/*` 직접 import 위반 정리 (배럴 경유 강제)
- **검증**: codex 4R(최종 PASS) · evaluator WARNING 9.5(P3×4 defer) · 기계게이트 5/5
- **설계 협의**: codex consult 1R (`.flowset/eval-results/WI-003-consult-r1.prompt.txt`)

## 아키텍처 규칙 (재확인)

```
경계 분리 → 모듈화(module/index.ts + module/internal/) → 캡슐화(index.ts만 공개)
```

외부 모듈은 대상 모듈의 **배럴(`index.ts`)** 을 통해서만 import한다. 타 모듈의 `internal/*` 직접 import는 금지한다. 동일 모듈 내부는 상대경로(`./internal/...`)를 쓴다.

## A. 인앱 위반 해소 (7건 → 배럴 routing)

| # | 위반 import 사이트 | 위반 대상 | 해소 |
|---|---|---|---|
| 1 | `src/stores/editor-store.ts` | `editor/internal/types` (타입) | `@/features/space/editor` 배럴 |
| 2 | `editor/internal/use-editor.ts` | `game/internal/tilemap/map-data` `extractDefaultMapData` | `@/features/space/game` 배럴 |
| 3 | `editor/internal/tile-palette-data.ts` | `game/internal/tilemap/tileset-generator` `TILE_INDEX` | `@/features/space/game` 배럴 |
| 4 | `editor/internal/editor-system.ts` | `game/internal/tilemap/tilemap-system` `TilemapResult` (타입) | `@/features/space/game` 배럴 |
| 5 | `game/internal/scenes/main-scene.ts` | `editor/internal/editor-system` `EditorSystem` | `@/features/space/editor` 배럴 |
| 6 | `socket/internal/use-socket.ts` | `chat/internal/chat-constants` `MOVE_THROTTLE_MS`,`DEFAULT_NICKNAME` | `@/features/space/chat` 배럴 |
| 7 | `socket/internal/socket-client.ts` | `chat/internal/chat-constants` `RECONNECTION_*` | `@/features/space/chat` 배럴 |

### 배럴 추가 export (cross-module integration surface)
- `game/index.ts`: `TILE_INDEX`, `extractDefaultMapData`, `type TilemapResult`
- `editor/index.ts`: `EditorSystem`
- `chat/index.ts`: `MOVE_THROTTLE_MS`, `RECONNECTION_ATTEMPTS/DELAY/DELAY_MAX/TIMEOUT`

> 이 심볼들은 원래 internal 구현이었다. 배럴 노출 시 "안정 공개 API 아님 — cross-module 해소용 표면" 주석을 남겨, 후속 boundary WI에서 경계를 재정리할 여지를 표시했다(codex 지적 위험: 배럴 export가 안정 API로 굳는 것).

### editor↔game 순환 안전성
- game → editor: `MainScene`이 `EditorSystem`을 인스턴스화(런타임). 단 `game-manager.ts`가 `MainScene`을 `await import("./scenes/main-scene")`로 **지연 로드** → `game/index.ts`의 정적 그래프는 editor에 도달하지 않음.
- editor → game: `editor/index.ts`가 `game/index.ts`를 정적 참조하나 game은 editor를 정적 참조하지 않음(단방향). game→editor 역참조는 런타임 lazy뿐 → **모듈 초기화 순환 없음**.

## B. 서버 cross-process 순수 계약 import — 본 WI 범위 밖 (후속 WI)

`server/`(별도 esbuild 단일 번들 프로세스)는 `socket/internal/types.ts`(순수 타입)·`chat/internal/chat-constants.ts`(순수 const, React 무의존)를 직접 import한다.

- **배럴 routing 불가**: `socket/index.ts`·`chat/index.ts` 배럴은 `useSocket`/`useChat` 등 React 훅을 함께 export → 서버 번들이 배럴을 import하면 React+클라 트리 전체가 esbuild 번들에 끌려와 빌드가 깨진다. Dockerfile.socket이 순수 계약 파일 2개만 명시 COPY하는 이유.
- **예외 범위(좁게 한정)**: React 의존성 없는 **순수 계약 파일에 한해**, **서버 프로세스(`server/**`)에서만** cross-process import 허용. 인앱(`src` 간) import에는 적용하지 않는다.
- **기계적 정합**: ESLint `globalIgnores`에 `server/**`·`scripts/**` 등록됨 → 서버/스크립트는 lint 대상 외. boundary 테스트도 `src/` 한정 스캔.
- **후속 WI(boundary/protocol) — 해소됨(WI-012-1, 2026-06-22)**: socket 이벤트 타입(`socket/internal/types.ts`)과 오배치 소켓 상수(`MOVE_THROTTLE_MS`/`RECONNECTION_*`)를 신규 순수 계약 모듈 `src/features/space/protocol`로 승격. server 9개소·`Dockerfile.socket` COPY·`deploy-socket.yml` paths·`communication.md`/`event-protocol.md` 포인터 갱신. 위 표 행 6/7의 chat 배럴 임시 routing은 제거되고 socket 모듈이 `@/features/space/protocol` 배럴에서 직접 소비. enforce 계약은 이미 독립 안정화되어 잔류(codex consult D1). `DEFAULT_NICKNAME`은 채팅 도메인 표시값이라 chat 잔류(D2). 스펙: `.claude/specs/architecture/2026-06-22-protocol-contract-module.md`.

## C. scripts dev 툴 — 제외 (문서화)

`scripts/debug-*.ts`, `scripts/quick-chibi-test.ts`가 `assets/internal/*`를 직접 import. dev/디버그 툴(테스트 커버리지 없음)이며 앱 런타임 경계 밖. ESLint `globalIgnores(scripts/**)`로 제외. `scripts/migrate-design-system.py:64-67`은 파이썬 문자열 리터럴(경로 목록)이며 import가 아님.

## 재발 방지 (이중 방어)

1. **ESLint** `no-restricted-imports`: `@/**/internal` + `@/**/internal/**` (alias 정밀, 오탐 0). IDE/lint 단계 즉시 피드백.
2. **vitest** `src/__tests__/module-boundaries.test.ts`: import 경로를 실제 해석해 cross-module `internal` 침범을 판정(**alias·상대경로 모두** 정밀, 동일모듈 오탐 0). glob으로는 상대경로 cross-module를 동일모듈 상향(`../../internal/*`)과 구분 불가하므로 테스트가 보강. 게이트(vitest)에서 강제.

## 후속 WI (등록)

- **WI-012-refactor (boundary/protocol)**: 통신 도메인 순수 계약(socket types·chat constants)을 공유 계약 모듈로 승격 + 서버/Docker/CI 경로 갱신 + 소켓 상수 물리 이동 + EventBridge 공개 계약(`game/events`) 단일 진입점 정리.
