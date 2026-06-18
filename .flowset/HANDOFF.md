# HANDOFF

## Active WI
WI-001-fix — 인증/인가 우회 및 데이터 노출 결함 차단 (status: ACTIVE, **구현 미착수**)

## Ground Truth
- Integration branch: `develop` @ `705d033` (main 동결, develop이 작업 메인)
- WI branch: `fix/WI-001-fix-auth-authz` (develop에서 분기, 구현 대기)
- main: `11b04ac` **동결** (origin/main과 동일)
- **푸시 안 됨 — 전부 로컬.** push + PR 시 CI(pr-checks 비강제) 활성화
- Changed files (이 WI): 없음 — 프로세스 스캐폴딩 단계, 소스 미변경

## Done (이번 세션)
- 듀얼 블라인드 검증(codex CLI + Claude) → 보안 결함 13건 확정 (P0 2 / P1 6 / P2 5)
- 게이트 그라운드 트루스 실측: tsc PASS · lint PASS · vitest 52/52 · build PASS
- 프로세스 스캐폴딩: `.flowset` 원장 + `.claude/process/00~07` + `review.schema.json` + `evaluator-agent`
- 경량 Stop 게이트 교체: prompt 훅 2개 제거 → `flowset_stop_gate.ps1` (deterministic)
- CI 의미게이트 추가: `pr-checks.yml` (.pass 검사, 초기 비강제)
- 브랜치 모델 확립: main 동결 / develop 통합 / wi/* 작업 / 승격
- 메모리 저장: codex-cli-verification · powershell-ps1-utf8 · flowspace-dev-process

## Next (다음 세션 시작점)
1. `git checkout fix/WI-001-fix-auth-authz`
2. 이 파일 + `.flowset/fix_plan.md` + `.flowset/eval-results/WI-001-fix.merged.json` 읽기
3. 보안 수용 기준 8항목 구현 — **P0 2건**(socket `join:space` 무인가, members PATCH cross-space IDOR) → **P1 6건**(GET accessSecret/email 노출, guest PASSWORD 우회, middleware `startsWith("/")` no-op, AUTH_SECRET fail-open, 역할 계층) 순
4. 기계게이트 + 듀얼검증(codex+evaluator) → `.merged.json`에 P0/P1·fixNow 없음 → `.pass` 생성 (`-EmitFingerprint`로 sourceFingerprint 포함)
5. `develop`로 PR 머지 → WI-002-fix(Phaser shutdown 누수) 진행

## Open Issues
- WI-001-fix 구현 미착수 (수용 기준 8항목 — `fix_plan.md`)

## Verification (WI-001-fix 현재 = 구현 전 결함 상태)
| Gate | Result | Evidence |
|---|---|---|
| tsc | PASS | 세션 실측 (fresh .next 후 exit 0) |
| lint | PASS | 세션 실측 (warning 1) |
| vitest | PASS 52/52 | 세션 실측 |
| build | PASS | 세션 실측 (exit 0) |
| codex | DONE (FAIL verdict, 8건) | `.flowset/eval-results/WI-001-fix.codex.json` |
| evaluator | DONE (FAIL verdict, 3건) | `.flowset/eval-results/WI-001-fix.eval.json` |
| pass | BLOCKED | P0/P1 미해결 → `.pass` 생성 금지 (구현 후 재검증 필요) |
