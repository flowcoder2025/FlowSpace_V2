# HANDOFF

## Active WI
(없음) — WI-009-feat **develop 머지 완료**(PR#4, merge `08fc2b9`). 다음 세션 우선은 **WI-008-fix(WI-007 P3×2)** → **WI-003-refactor(경계 위반)**.

## ⚠️ 다음 세션 우선 — WI-008-fix (WI-007 듀얼검증 P3×2 해소)
- READY. (1) `scripts/set-super-admin.mjs` 회수 인자 화이트리스트화 — `argv[3] !== "false"` 파싱이 오타('flse'/'0' 등)를 조용히 grant 처리. 미인식 입력 시 에러로. (2) `POST /api/spaces` 403 응답에 `code` 필드 병기(app.md invariant #4 정합). 둘 다 P3 무해, WI-007 evaluator(9.85) defer.
- 그다음 WI-003-refactor(`internal/*` 직접 import 위반: editor↔game, server→socket/chat).
- **진행 방식(사용자 확정 2026-06-21)**: 모든 WI는 develop 정상 플로우 — `feature/WI-NNN` 분기 → 기계게이트(tsc/lint/vitest/build) → 듀얼검증(codex CLI + evaluator-agent) → `.pass` → **develop PR 머지**(프로세스 07상 사용자 승인 불요). 라이브 반영이 필요하면 그때 develop→main **승격**(process 07; 승인 필요 + main 푸시 작성자 = 인가 계정 `flowcoder25@gmail.com`).

## main↔develop 정합 + 배포 상태 (2026-06-21)
- develop = WI-001 + WI-002 + WI-007 + **WI-009**(PR#4 `08fc2b9`) + 원장. develop ⊇ main.
- main `2a6e2ed`(PR#3, WI-007) + `38459d5`(빈 재배포 트리거). 라이브 프로덕션 = `38459d5` = **구버전 main + WI-007만**. **WI-001/002/009는 main 미반영**(승격 대상, 라이브에도 없음).
- 현재 체크아웃: `develop` (origin/develop 동기화 `08fc2b9`).

## ⚠️ Vercel 배포 함정 (재발 주의)
- Vercel 프로덕션 = `main` 브랜치 배포. 커밋 작성자가 Vercel 팀 인가 계정이 아니면 프로덕션 배포가 **실패**(`team-members-and-roles`). GitHub Actions 빌드는 성공이어도 별개.
- 이번 해결: 깃 작성자를 `flowcoder25 <flowcoder25@gmail.com>`(repo-scoped)로 변경 후 빈 커밋 푸시 → 배포 success.
- **이후 main 푸시도 인가 작성자 유지 필요.** 되돌리려면 `git config user.email <원래값>`. 근본 해결 = Vercel 팀에 커밋 작성자 추가.

## Done (이번 세션, 2026-06-21)
- **WI-009-feat**: 슈퍼어드민 전역 스페이스 뷰. `GET /api/spaces` filter 분기 명시화(owned/joined/all|null) + 슈퍼어드민 "전체"=모든 ACTIVE(`scope={}`, 일반 사용자 동작 불변) + 미허용 filter 400(`code:INVALID_FILTER`) + 목록 응답 `inviteCode` 제거(목록 UI 미소비 죽은 필드·전역 노출 시 전체 초대코드 누출 차단). `SpaceCard`/`SpaceListView` `isSuperAdmin` prop → myRole 무관 '관리' 노출(서버 세션 권위, 클릭 후 `requireSpaceAdmin` 재검증). 설계 codex consult 1R 반영. 기계게이트 4/4 PASS + 듀얼검증(codex PASS·evaluator 9.8, P3×2 defer→WI-010-perf/WI-011-test) + `.pass`. **develop 머지 (PR#4, merge `08fc2b9`, feat `fb484d6`)**.
- **WI-007-feat**: 스페이스 생성 슈퍼어드민 전용 제한 + `scripts/set-super-admin.mjs` 부트스트랩. 진입점 전수 게이팅(navbar 데스크톱/모바일 + my-spaces toolbar/empty-state) + POST 403 + /spaces/new redirect. 듀얼검증 codex PASS·evaluator 9.85(P3×2 defer→WI-008). main `2a6e2ed`(PR#3) → back-sync develop → 라이브 배포 `38459d5`. 스펙: `.claude/specs/auth/2026-06-21-superadmin-space-creation.md`.
- **kryou2922@gmail.com 슈퍼어드민 지정**(DB). 현재 슈퍼어드민: `admin@flowspace.dev`, `kryou2922@gmail.com`. (JWT라 변경 후 재로그인 필요)
- qa-agent/doc-agent 실행(정책 게이트). 스펙 문서 생성.

## Open Issues (Queue, 우선순위순)
- **WI-008-fix** (READY, 다음 우선): WI-007 P3×2 — `set-super-admin.mjs` 회수 인자 화이트리스트화, `POST /api/spaces` 403 응답 `code` 필드 일관화.
- **WI-003-refactor** (READY): 타 모듈 `internal/*` 직접 import 위반 정리(editor↔game, server→socket/chat).
- **WI-004-fix** (READY): `api/assets/[id]` DELETE 경로 격리(`../` 차단).
- **WI-005-fix** (READY): 접속 중 소켓 ban/kick 실시간 추방(크로스프로세스 설계).
- **WI-006-fix** (READY): `useScreenRecorder.onerror` pending resolve 미종결(P3 무해).
- **WI-010-perf** (READY, WI-009 defer): 슈퍼어드민 전역 스페이스 목록 페이지네이션(`GET /api/spaces` scope={} take/cursor/상한). 기존도 무페이지네이션 — 회귀 아님.
- **WI-011-test** (READY, WI-009 defer): `GET /api/spaces` filter 분기 회귀 테스트 + API 라우트 테스트 하니스(auth/prisma mock) 도입.

## Verification (WI-009-feat = develop 머지 완료)
| Gate | Result | Evidence |
|---|---|---|
| tsc / lint / vitest(52/52) / build | PASS | 세션 실측(feature 트리). CI는 develop PR 미트리거(main 전용) → 로컬 게이트 권위 |
| codex / evaluator | PASS / WARNING 9.8 (P3×2 defer→WI-010/011) | `.flowset/eval-results/WI-009-feat.*` |
| .pass | 생성됨 (fingerprint `2dedbb42`) | commit `fb484d6` |
| merge | DONE | PR#4 → develop `08fc2b9` |

## 직전 완료 (참고)
- WI-007-feat(스페이스 생성 슈퍼어드민 제한, PR#3 → main `2a6e2ed` + 라이브 `38459d5`) / WI-001-fix(보안 8건, PR#1) / WI-002-fix(Phaser 누수, PR#2). 상세는 `fix_plan.md` Done + `.flowset/eval-results/*`.
