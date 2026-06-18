# HANDOFF

## Active WI
(없음) — WI-001-fix develop 머지 완료. 다음 세션은 **WI-002-fix**부터.

## Ground Truth
- Integration branch: `develop` @ `f8e7ba2` (PR#1 머지 커밋) — origin/develop 동기화됨
- main: `11b04ac` **동결** (origin/main과 동일, develop 미반영)
- WI 브랜치 `fix/WI-001-fix-auth-authz`: 머지 후 **로컬+원격 삭제됨**
- 현재 체크아웃: `develop`

## Done (이번 세션)
- **WI-001-fix 완료 + develop 머지** (PR#1 → `f8e7ba2`): 보안 8건(P0 2/P1 6)
  - join 동기인가 / members IDOR / GET select allowlist / 멤버 PII 게이트 / guest PASSWORD / middleware exact / AUTH_SECRET fail-closed / 역할계층 canActOn
  - 신규 헬퍼: `src/lib/auth-secret.ts`, `src/lib/space-role.ts`
  - 기계 게이트 4/4 PASS · 듀얼검증 codex PASS·evaluator PASS(9.375) · `.pass` 생성
  - codex와 설계 2회 협의(착수 전 보완 6건 + 구현 후 재검증)
- 통합 브랜치 `develop` 원격 신규 생성·푸시 (이전엔 origin에 main만 존재)

## Next (다음 세션 시작점)
1. `git checkout develop && git pull` 확인 (이미 develop @ f8e7ba2)
2. **WI-002-fix** 착수: develop에서 `fix/WI-002-fix-...` 분기
   - Phaser `MainScene.shutdown()` SHUTDOWN 이벤트 미연결 → eventBridge 리스너 누수 + `useScreenRecorder` unmount cleanup
   - `.flowset/current.json` activeWI=WI-002-fix / status=ACTIVE 설정, `fix_plan.md` Active WI 블록 채우기
3. 구현 → 기계게이트 → 듀얼검증(codex+evaluator) → `.pass` → develop PR (WI-001과 동일 플로우)

## Open Issues (Queue)
- **WI-002-fix** (READY): Phaser shutdown 리스너 누수 + useScreenRecorder cleanup — 다음 우선
- **WI-003-refactor** (READY): 타 모듈 `internal/*` 직접 import 위반 정리
- **WI-004-fix** (READY): `api/assets/[id]` DELETE 경로 격리(`../` 차단)
- **WI-005-fix** (READY, 신규): 접속 중 소켓 ban/kick 실시간 추방. Next HTTP(3000)↔socket.io(3001) 메모리 비공유 → Redis pub-sub/내부훅/액션별 DB재조회 중 설계 선택. reconnect는 WI-001 join 게이트가 이미 차단. (codex WI-001 검증서 신규 P2)

## Verification (WI-001-fix = 머지 완료)
| Gate | Result | Evidence |
|---|---|---|
| tsc / lint / vitest / build | PASS / PASS / PASS(52/52) / PASS | 세션 실측 |
| codex | PASS (8건 CLOSED) | thread 019edc1e / `.flowset/eval-results/WI-001-fix.codex.json` |
| evaluator | PASS (9.375) | `.flowset/eval-results/WI-001-fix.eval.json` |
| pass | 생성됨 | `.flowset/eval-results/WI-001-fix.pass` |
| merge | DONE | PR#1 → develop `f8e7ba2` |
