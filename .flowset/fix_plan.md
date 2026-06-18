# FlowSpace Fix Plan

> WI 워크리스트. 상태값: `READY | ACTIVE | VERIFY | BLOCKED | DONE | DROPPED`. 한 번에 하나만 `ACTIVE`.
> WI ID/타입은 wi-global enum 준수: feat·fix·docs·style·refactor·test·chore·perf·ci·revert.
> 초기 시드 = 2026-06-19 듀얼 블라인드 검증(codex CLI + Claude) 확정 결함.

## Active WI
- (없음) — WI-002-fix develop 머지 완료(PR#2). 다음 세션에서 WI-003-refactor를 develop에서 분기해 ACTIVE 설정.

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
