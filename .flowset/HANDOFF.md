# HANDOFF

## Active WI
(없음) — WI-007-feat **main 머지 완료**(별도 작업). 다음 세션은 develop 통합 큐 **WI-003-refactor**부터 + **WI-008-fix**(WI-007 P3×2).

## main↔develop 정합 상태 (2026-06-21)
- **WI-007-feat가 main + develop 양쪽에 반영됨**. 사용자 지시로 main에 먼저 직접 머지(별도 작업) 후 **back-sync 완료**(main→develop merge).
- main `2a6e2ed` = `11b04ac`(동결 베이스) + WI-007(`49d272e`). **WI-001/002는 여전히 main 미반영**(승격 대기).
- develop = WI-001/002 + WI-007(back-sync) + 원장. tsc/vitest PASS 확인.
- 결과: develop ⊇ main (WI-007 공통). 향후 develop→main 승격 시 WI-001/002가 main에 합류, WI-007 충돌 없음.

## Ground Truth
- Integration branch: `develop` (origin/develop 동기화 — 원장 커밋 포함)
- main: `2a6e2ed` (PR#3로 WI-007 머지). 그 외 WI-001/002 미반영 동결 유지.
- WI 브랜치 `feat/WI-007-feat-superadmin-space-creation`: 머지 후 **로컬+원격 삭제됨**
- 현재 체크아웃: `develop`
- WI-002 이전: develop @ `256ae57`(PR#2), main 동결 `11b04ac`

## Done (이번 세션)
- **WI-002-fix 구현 + 검증 완료** (커밋 `8e3358f`): 안정성/리소스 누수 2건
  - MainScene 생명주기: Phaser는 `scene.shutdown()`을 자동 호출 안 함(init/preload/create/update만 연결). `create()`에서 `Phaser.Scenes.Events.SHUTDOWN`+`DESTROY` once 연결 → eventBridge 싱글톤 리스너 누수(게임 재생성마다 ~21개) 차단. 멱등 가드 + 반대편 lifecycle 리스너 해제(재시작 누적 방지). `game.destroy(true)`는 DESTROY만 emit이 실제 teardown 경로.
  - useScreenRecorder: unmount cleanup(useEffect) 추가 — timer/notification/AudioContext/MediaRecorder 정리. mountedRef 가드(onstop setState-after-unmount 차단) + pendingStopResolveRef(stopRecording Promise dangling 차단). 훅 비소유 트랙(screenTrack/audioTracks)은 stop 안 함.
  - Codex 설계 협의 1회(착수 전) + 듀얼검증 3라운드. r1·r2에서 codex(fixNow)+evaluator 수렴 발견 → 즉시 수정 → r3 codex PASS.
  - 기계 게이트 4/4 PASS · `.pass`/`.merged.json` 생성

## Next (다음 세션 시작점)
1. `git checkout develop && git pull` 확인 (이미 develop @ 256ae57)
2. **WI-003-refactor** 착수: develop에서 `refactor/WI-003-refactor-...` 분기
   - 타 모듈 `internal/*` 직접 import 위반 정리 (editor↔game, server→socket/chat 경계)
   - `current.json` activeWI=WI-003-refactor / status=ACTIVE, `fix_plan.md` Active WI 블록 채우기
3. 경계 변경이면 구현 전 Codex 협의(`.claude/process/02`) → 구현 → 기계게이트 → 듀얼검증 → `.pass` → develop PR (WI-002와 동일 플로우)

## Open Issues (Queue)
- **WI-003-refactor** (READY): 경계 위반 `internal/*` 직접 import 정리 — 다음 우선
- **WI-004-fix** (READY): `api/assets/[id]` DELETE 경로 격리(`../` 차단)
- **WI-005-fix** (READY): 접속 중 소켓 ban/kick 실시간 추방 (크로스프로세스 설계)
- **WI-006-fix** (READY, 신규): `useScreenRecorder.onerror` 경로 pending resolve 미종결(P3, 무해). WI-002 evaluator 발산 발견

## Verification (WI-002-fix = 머지 완료)
| Gate | Result | Evidence |
|---|---|---|
| tsc / lint / vitest / build | PASS / PASS(0 err) / PASS(52/52) / PASS | 세션 실측 (r3 코드 기준) |
| codex | PASS (issues=[]) | r3 / `.flowset/eval-results/WI-002-fix.codex.json` |
| evaluator | WARNING (9.6, P3 1건 defer→WI-006) | `.flowset/eval-results/WI-002-fix.eval.json` |
| merged | gateDecision=PASS (P0/P1·fixNow 없음) | `.flowset/eval-results/WI-002-fix.merged.json` |
| pass | 생성됨 | `.flowset/eval-results/WI-002-fix.pass` (commit 8e3358f) |
| CI (flowset-semantic-gate, Vercel) | PASS | PR#2 checks |
| merge | DONE | PR#2 → develop `256ae57` |

## 듀얼검증 라운드 이력 (WI-002)
- r1: onstop `await saveFile` 중 unmount → setState-after-unmount (codex P2 fixNow / evaluator P3). → mountedRef 가드 + cleanup 무조건 detach (16488e2)
- r2: 그 수정이 새 레이스 — stop()→dispatch 전 unmount 시 onstop 제거로 Promise 영구 pending (codex P2 fixNow / evaluator P3). → pendingStopResolveRef로 cleanup settle (8e3358f)
- r3: codex PASS · evaluator WARNING(9.6) — 잔존 P3(onerror, 발산·defer) 1건만 → WI-006 분리
