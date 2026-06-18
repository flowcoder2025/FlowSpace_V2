# FlowSpace Fix Plan

> WI 워크리스트. 상태값: `READY | ACTIVE | VERIFY | BLOCKED | DONE | DROPPED`. 한 번에 하나만 `ACTIVE`.
> WI ID/타입은 wi-global enum 준수: feat·fix·docs·style·refactor·test·chore·perf·ci·revert.
> 초기 시드 = 2026-06-19 듀얼 블라인드 검증(codex CLI + Claude) 확정 결함.

## Active WI
- **WI-002-fix** (ACTIVE, branch `fix/WI-002-fix-phaser-shutdown-leak` @ develop) — Phaser `MainScene` 생명주기 cleanup 미연결 → eventBridge 싱글톤 리스너 누수 + `useScreenRecorder` unmount cleanup.
  - 근본원인(검증): Phaser 3.90 SceneManager는 `init/preload/create/update`만 자동 연결. `MainScene.shutdown()`은 dead code(자동 호출 안 됨). `game.destroy(true)`→`SceneManager.destroy`→씬별 `sys.destroy()`→**DESTROY만 emit**(SHUTDOWN 아님). 따라서 cleanup은 SHUTDOWN+DESTROY 둘 다 연결 필요.
  - 누수 규모: shutdown 미실행 → 전 서브시스템 destroy() 스킵 → 게임 생성마다 eventBridge에 ~21 리스너 누적(MainScene 2/RemotePlayer 4/Input 3/Camera 1/Object 4/Editor 7), 파괴된 씬 참조 보유.
  - useScreenRecorder: unmount cleanup(useEffect) 부재 → timer interval/notification timeout/AudioContext/MediaRecorder 누수.

## Queue
| WI | Type | Status | Goal | Notes |
|---|---|---|---|---|
| WI-003-refactor | refactor | READY | 타 모듈 `internal/*` 직접 import 위반 정리 (editor↔game, server→socket/chat) | 경계 위반 |
| WI-004-fix | fix | READY | `api/assets/[id]` DELETE unlink 시 `public` 경로 격리(`../` 차단) | P2 |
| WI-005-fix | fix | READY | 접속 중 소켓 ban/kick 실시간 추방 (dashboard 제재 시 현재 연결 즉시 종료/room 제거). Next HTTP↔socket.io 크로스프로세스 채널(Redis pub-sub/내부훅/액션별 DB재조회 택1) 설계 필요 | WI-001 듀얼검증서 codex 신규 P2 분리. reconnect는 WI-001 join 게이트가 이미 차단 |

## Done
- **WI-001-fix** (보안) — 인증/인가 우회·데이터 노출 8건 차단. 기계게이트 4/4 PASS + 듀얼검증(codex PASS·evaluator PASS 9.375) + `.pass` 생성. 구현: join 동기인가, members IDOR, GET select allowlist, 멤버 PII 게이트, guest PASSWORD, middleware exact, AUTH_SECRET fail-closed, 역할계층 canActOn. **develop 머지 완료 (PR#1, merge `f8e7ba2`)**.
