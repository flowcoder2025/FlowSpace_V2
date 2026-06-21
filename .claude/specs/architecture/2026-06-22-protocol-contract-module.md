# 통신 도메인 순수 계약 모듈 (protocol) — WI-012-1

- **WI**: WI-012-1-refactor (WI-012를 위험 프로파일로 분할한 첫 PR; codex consult D6)
- **날짜**: 2026-06-22
- **선행**: WI-003(경계 캡슐화)이 등록한 후속 항목 해소. `2026-06-22-module-boundary-encapsulation.md` §B 참조.
- **상태**: develop 머지 대상

## 문제

통신 도메인 순수 계약이 모듈 3곳에 분산·오배치되어 있었다.

1. **socket 이벤트 타입**(`socket/internal/types.ts`) — 순수 타입(import 0)이지만 `internal/`(private)에 있어, 별도 esbuild 번들인 `server/` 9개소가 "private를 서버 예외로 직접 읽는" 약한 계약으로 의존. 도메인 규칙(`communication.md`)·참조 문서(`event-protocol.md`)가 이 internal 경로를 SSOT로 가리킴.
2. **소켓 transport 상수**(`MOVE_THROTTLE_MS`, `RECONNECTION_*`) — 의미상 통신 상수(communication.md invariant #1/#2)인데 물리적으로 `chat/internal/chat-constants.ts`에 오배치. WI-003이 cross-module internal 위반을 `chat/index.ts` 임시 re-export("안정 API 아님, 후속 이동 예정" 주석)로 미봉.

## 결정 (codex 설계 협의 1R 반영)

**슬림 protocol 모듈** — `src/features/space/protocol` 신설, 통신 순수 계약의 SSOT.

| 결정 | 내용 | 근거 |
|---|---|---|
| D1 | socket 이벤트 타입 + transport 상수만 승격 | server가 private를 예외로 읽는 약한 계약을 공개 계약으로 정상화. enforce는 범위 제외 |
| (enforce) | `enforce/internal/contract.ts`는 **잔류** | WI-005에서 이미 독립 계약으로 안정화 + Dockerfile/CI 등록 완료. 건드릴 이득 없음 |
| D2 | `DEFAULT_NICKNAME`은 **chat 잔류** | transport 동작 상수가 아닌 채팅 도메인 사용자 표시 기본값. server chat/party도 그 의미로 사용 |

## 구조

```
src/features/space/protocol/
  index.ts                       # Public 배럴 — 타입/상수만 re-export (React/Node 무의존)
  internal/
    socket-events.ts             # 이벤트/페이로드 타입 (구 socket/internal/types.ts)
    socket-constants.ts          # RECONNECTION_* / MOVE_THROTTLE_MS (구 chat-constants 일부)
```

- **인앱 소비자**(socket 모듈 등)는 `@/features/space/protocol` 배럴 경유(ESLint `no-restricted-imports` + `module-boundaries.test.ts`가 강제).
- **서버**(`server/`, 별도 esbuild 번들)는 배럴이 아닌 순수 internal 파일을 직접 상대 import + `Dockerfile.socket` COPY. 배럴 import 금지 — protocol 배럴이 React를 끌지 않아도, 패턴 일관성·최소 COPY를 위해 internal 직접 참조 유지.

## 변경 표면

| 영역 | 파일 | 변경 |
|---|---|---|
| 신규 | `protocol/{index,internal/socket-events,internal/socket-constants}.ts` | 순수 계약 모듈 |
| 삭제 | `socket/internal/types.ts` | protocol/internal/socket-events로 이동 |
| facade | `socket/index.ts` | socket 타입을 `@/features/space/protocol`에서 재노출(기존 소비자 4개소 무변경) |
| import | `socket/internal/{socket-client,use-socket}.ts` | 타입·소켓상수를 protocol 배럴에서 소비(`DEFAULT_NICKNAME`만 chat 유지) |
| 정리 | `chat/internal/chat-constants.ts`, `chat/index.ts` | 소켓상수 정의·임시 re-export 제거 |
| 서버 | `server/index.ts` + `handlers/{room,movement,editor,avatar,media,chat,party,enforce}.ts` (9) | 타입 import 경로를 protocol/internal/socket-events로 |
| 배포 | `Dockerfile.socket`, `.github/workflows/deploy-socket.yml` | COPY/paths를 socket-events.ts로 갱신(소켓상수는 서버 미사용 → COPY 불필요). **+ 선재 P1 해소**: 서버 런타임 의존 `src/lib/auth-secret.ts`(WI-001 도입, Dockerfile COPY 누락이던 것) 추가 — esbuild metafile로 src 런타임 입력 3개(chat-constants·enforce contract·auth-secret) 전수 COPY 실증 |
| 문서 | `communication.md`, `event-protocol.md`, `module-boundary-encapsulation.md` | SSOT 포인터 갱신 |

> **선재 P1(Dockerfile COPY 누락) 해소**: develop 상태에서 `server/middleware/auth.ts`가 런타임 import하는 `src/lib/auth-secret.ts`(WI-001 `80a3adb` 도입)가 `Dockerfile.socket` COPY·`deploy-socket.yml` paths에 빠져 있었다. `import type`가 아닌 런타임 import라 Docker 빌드 컨텍스트에서 esbuild가 resolve 실패 → 향후 main 승격 시 OCI 소켓 빌드가 깨질 결함. 본 WI가 COPY/paths를 다루므로 함께 닫음. `socket-events.ts`는 `import type`-only라 esbuild가 elide(번들 미포함)하지만 계약 추적용으로 COPY 유지.

## 위험과 방어

- **서버 esbuild 번들 붕괴(WI-003 1급 함정)**: protocol 배럴이 타 배럴/런타임 값을 import하면 React가 번들에 끌려옴 → 방어: protocol은 **타입/상수만**(import 0), 서버는 순수 파일 직접 참조. **로컬 esbuild 번들 게이트로 선검증**(Dockerfile 커맨드 재현, exit 0).
- **Dockerfile COPY ↔ import 경로 불일치 → OCI 빌드 실패**: 과거 chat-constants COPY 누락 선례. COPY 목적지 경로를 서버 상대 import 해석 경로와 정확히 일치시킴(`src/features/space/protocol/internal/socket-events.ts`).
- **배포 트리거**: `deploy-socket.yml`은 `main` push에만 발동 → develop 단계 자동 배포 없음. 승격(별도 승인) 시점에 OCI 재빌드.

## 검증

- 기계 게이트 5/5: tsc 0 · lint 0(기존 LiveKit 경고 1) · vitest 128/128 · next build 0 · **서버 esbuild 번들 0**.
- `module-boundaries.test.ts`: 신규 protocol 모듈도 배럴 경유 강제 — 통과(인앱 소비자 위반 0).
