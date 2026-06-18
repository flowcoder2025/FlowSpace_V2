# HANDOFF

## Active WI
WI-001-fix — 인증/인가 우회 및 데이터 노출 결함 차단 (status: **VERIFY** — 구현·검증 완료, develop 머지 대기)

## Ground Truth
- Integration branch: `develop` @ `705d033` (main 동결, develop이 작업 메인)
- WI branch: `fix/WI-001-fix-auth-authz` @ `80a3adb` (**WI-001 구현 커밋 완료**)
- main: `11b04ac` **동결** (origin/main과 동일)
- **푸시 안 됨 — 전부 로컬.** push + PR(→develop) 시 CI(pr-checks 비강제) 활성화
- Changed files (WI-001): 12 소스(.ts) + 5 원장(.flowset). 신규 헬퍼 2개: `src/lib/auth-secret.ts`, `src/lib/space-role.ts`

## Done (이번 세션)
- WI-001 보안 8건 구현 (P0 2 / P1 6) — codex와 설계 협의 후 구현, 보완점 6건 반영
  - join 동기인가 / members IDOR / GET select allowlist / 멤버 PII 게이트 / guest PASSWORD / middleware exact / AUTH_SECRET fail-closed / 역할계층 canActOn
- 기계 게이트 실측: tsc PASS · lint PASS(warning 1 기존) · vitest 52/52 · build PASS
- 듀얼 블라인드 재검증: codex PASS(8건 CLOSED) · evaluator PASS(9.375) → `.pass` 생성
- 커밋: `80a3adb` (`fix: WI-001 ...`)

## PR (오픈됨)
- **#1**: https://github.com/flowcoder2025/FlowSpace_V2/pull/1 — `fix/WI-001-fix-auth-authz` → `develop`
- CI: flowset-semantic-gate ✅ PASS / Vercel preview 배포. develop·WI 브랜치 둘 다 origin에 푸시됨(develop은 이번에 신규 생성)

## Next (다음 세션 시작점)
1. **PR #1 머지 결정** (사용자 검토 후): develop 머지 → 브랜치 삭제
2. 머지 후 `current.json`/`fix_plan.md`에서 WI-001 status VERIFY→DONE 확정, 다음 ACTIVE 승격
3. **WI-002-fix** 착수: Phaser `MainScene.shutdown()` SHUTDOWN 이벤트 미연결(eventBridge 리스너 누수) + `useScreenRecorder` unmount cleanup
   - 시작 전 `.flowset/fix_plan.md` Queue 확인. 새 WI 브랜치는 develop에서 분기

## Open Issues
- WI-005-fix (READY, 신규): 접속 중 소켓 ban/kick 실시간 추방. codex가 WI-001 검증서 적출한 P2 — Next HTTP(3000)↔socket.io(3001) 메모리 비공유라 단순패치 불가. Redis pub-sub / 내부훅 / 액션별 DB재조회 중 설계 선택 필요. reconnect는 WI-001 join 게이트가 이미 차단

## Verification (WI-001-fix = 구현·검증 완료)
| Gate | Result | Evidence |
|---|---|---|
| tsc | PASS | 세션 실측 (exit 0) |
| lint | PASS | 세션 실측 (warning 1, 기존 LiveKitMediaContext) |
| vitest | PASS 52/52 | 세션 실측 |
| build | PASS | 세션 실측 (exit 0) |
| codex | PASS (8건 CLOSED) | thread 019edc1e / `.flowset/eval-results/WI-001-fix.codex.json` |
| evaluator | PASS (9.375) | `.flowset/eval-results/WI-001-fix.eval.json` |
| pass | **생성됨** | `.flowset/eval-results/WI-001-fix.pass` (sourceFingerprint 포함, P0/P1 0건) |
