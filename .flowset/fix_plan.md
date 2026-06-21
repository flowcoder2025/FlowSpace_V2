# FlowSpace Fix Plan

> WI 워크리스트. 상태값: `READY | ACTIVE | VERIFY | BLOCKED | DONE | DROPPED`. 한 번에 하나만 `ACTIVE`.
> WI ID/타입은 wi-global enum 준수: feat·fix·docs·style·refactor·test·chore·perf·ci·revert.
> 초기 시드 = 2026-06-19 듀얼 블라인드 검증(codex CLI + Claude) 확정 결함.

## Active WI
- **WI-007-feat** (ACTIVE) — 스페이스 생성 슈퍼어드민 전용 제한 + 슈퍼어드민 부트스트랩. **타깃 base = `main`** (사용자 지시, develop 통합 플로우 예외). 수용 기준:
  1. `POST /api/spaces`는 `isSuperAdmin !== true` 면 403 (`prisma.space.create` 유일 경로 차단).
  2. `/spaces/new` 페이지는 비-슈퍼어드민을 `/my-spaces`로 redirect (서버 가드).
  3. `my-spaces`의 '새 스페이스' 생성 진입점(toolbar + empty-state 버튼)은 슈퍼어드민에게만 노출.
  4. 슈퍼어드민 부트스트랩 `scripts/set-super-admin.mjs` — 멱등, 미존재 사용자 시 명확 실패(생성 안 함), `--list` 지원.
  5. **자기완결성**: 변경이 `main`(WI-001/002 미반영) 베이스에서 tsc/lint/vitest/build 통과 — develop 전용 코드(canActOn 등)에 의존하지 않음.
  6. 기존 권한 부여(슈퍼어드민 역할 위임: `members`/`admin/members` PATCH) 회귀 없음.

## Queue
| WI | Type | Status | Goal | Notes |
|---|---|---|---|---|
| WI-003-refactor | refactor | READY | 타 모듈 `internal/*` 직접 import 위반 정리 (editor↔game, server→socket/chat) | 경계 위반 |
| WI-004-fix | fix | READY | `api/assets/[id]` DELETE unlink 시 `public` 경로 격리(`../` 차단) | P2 |
| WI-005-fix | fix | READY | 접속 중 소켓 ban/kick 실시간 추방 (dashboard 제재 시 현재 연결 즉시 종료/room 제거). Next HTTP↔socket.io 크로스프로세스 채널(Redis pub-sub/내부훅/액션별 DB재조회 택1) 설계 필요 | WI-001 듀얼검증서 codex 신규 P2 분리. reconnect는 WI-001 join 게이트가 이미 차단 |
| WI-006-fix | fix | READY | `useScreenRecorder` `recorder.onerror` 경로에서 pending stopRecording resolve 미종결 → 'error' 이벤트 시 Promise 영구 pending | P3, WI-002 듀얼검증서 evaluator 신규(발산). 무해(자원 누수 없음·기능 무영향). onerror에서도 pendingStopResolveRef settle 또는 안전망 타임아웃 |

## Done
- **WI-002-fix** (안정성) — Phaser 씬 생명주기 cleanup 미연결 누수 + useScreenRecorder unmount 정리. 기계게이트 4/4 PASS + 듀얼검증 3라운드(codex PASS·evaluator WARNING 9.6, P3 1건 defer→WI-006) + `.pass` 생성. 구현: MainScene `create()`에서 SHUTDOWN+DESTROY once 연결 + 멱등 가드 + 반대편 리스너 해제; useScreenRecorder useEffect cleanup + mountedRef 가드 + pendingStopResolveRef. **develop 머지 완료 (PR#2, merge `256ae57`)**.
- **WI-001-fix** (보안) — 인증/인가 우회·데이터 노출 8건 차단. 기계게이트 4/4 PASS + 듀얼검증(codex PASS·evaluator PASS 9.375) + `.pass` 생성. 구현: join 동기인가, members IDOR, GET select allowlist, 멤버 PII 게이트, guest PASSWORD, middleware exact, AUTH_SECRET fail-closed, 역할계층 canActOn. **develop 머지 완료 (PR#1, merge `f8e7ba2`)**.
