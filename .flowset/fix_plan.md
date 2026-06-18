# FlowSpace Fix Plan

> WI 워크리스트. 상태값: `READY | ACTIVE | VERIFY | BLOCKED | DONE | DROPPED`. 한 번에 하나만 `ACTIVE`.
> WI ID/타입은 wi-global enum 준수: feat·fix·docs·style·refactor·test·chore·perf·ci·revert.
> 초기 시드 = 2026-06-19 듀얼 블라인드 검증(codex CLI + Claude) 확정 결함.

## Active WI
- **ID**: WI-001-fix
- **Type**: fix (보안)
- **Status**: ACTIVE
- **Branch**: `fix/WI-001-fix-auth-authz` (develop에서 분기)
- **Goal**: 인증/인가 우회 및 데이터 노출 결함 차단
- **Scope**:
  - `server/handlers/room.ts` (socket join 인가)
  - `src/app/api/spaces/[id]/route.ts`, `src/app/api/spaces/[id]/members/route.ts` (응답 노출·IDOR)
  - `src/app/api/guest/route.ts` (PASSWORD 우회)
  - `src/middleware.ts`, `server/middleware/auth.ts`, `src/app/api/socket/token/route.ts` (인증 경계)
  - `src/app/api/spaces/[id]/admin/members/route.ts` (역할 계층)
- **Acceptance**:
  - `join:space`가 socket 세션 기준 멤버십/접근권(PRIVATE·PASSWORD·BANNED) 동기 검증 후에만 join
  - members PATCH가 `target.spaceId === id` 경계 검증 (cross-space IDOR 차단)
  - GET 응답에서 `accessSecret`·email 등 비공개 필드 노출 금지 (select allowlist)
  - guest 생성 시 PASSWORD 공간은 accessSecret 검증
  - `middleware.ts` 루트는 `pathname === "/"` exact 매칭 (startsWith no-op 제거)
  - `AUTH_SECRET` 미설정 시 fail-closed
  - admin member action(ban/kick/mute)에 "호출자 역할 ≤ 대상 역할" 공통 가드
- **Required gates**: `npx tsc --noEmit` · `npm run lint` · `npx vitest run` · `npm run build` · dual review(codex+evaluator) · `.flowset/eval-results/WI-001-fix.pass`

## Queue
| WI | Type | Status | Goal | Notes |
|---|---|---|---|---|
| WI-002-fix | fix | READY | Phaser `MainScene.shutdown()` SHUTDOWN 이벤트 미연결 → eventBridge 리스너 누수 + `useScreenRecorder` unmount cleanup | 보안 다음 |
| WI-003-refactor | refactor | READY | 타 모듈 `internal/*` 직접 import 위반 정리 (editor↔game, server→socket/chat) | 경계 위반 |
| WI-004-fix | fix | READY | `api/assets/[id]` DELETE unlink 시 `public` 경로 격리(`../` 차단) | P2 |

## Done
- (없음)
