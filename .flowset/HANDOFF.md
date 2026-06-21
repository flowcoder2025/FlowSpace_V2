# HANDOFF

## Active WI
(없음) — WI-007-feat **main 머지 + 라이브 배포 완료**. 다음 세션 최우선은 **WI-009-feat(슈퍼어드민 전역 스페이스 뷰, 사용자 요청)**.

## ⚠️ 다음 세션 최우선 — 슈퍼어드민 전역 스페이스 뷰 (WI-009-feat, 사용자 대기 중)
- **사용자 요청**: 슈퍼어드민이 *모든* 스페이스를 보고 관리할 수 있어야 함. 방식 = **"내 스페이스에 전체 노출"**(사용자 선택).
- 현재 한계(코드 확인): `GET /api/spaces`가 "내가 멤버인 스페이스"만 반환(`members: { some: { userId } }`) → 슈퍼어드민도 멤버 아닌 스페이스는 목록에 없음. `src/components/spaces/space-card.tsx`의 `isAdmin = myRole==="OWNER"|"STAFF"` → 슈퍼어드민 관리버튼 미표시.
- **백엔드 인가는 이미 통과**: `requireSpaceAdmin()`이 슈퍼어드민을 항상 통과 → `/dashboard/spaces/<id>` 직접 URL 접근은 됨. UI 진입점/목록만 없음.
- 구현 방향: (1) `GET /api/spaces` — `session.user.isSuperAdmin`이면 전체 ACTIVE 스페이스 반환(+ 응답에 슈퍼어드민 표식), (2) `space-card` — 슈퍼어드민이면 myRole 무관 '관리' 노출. (3) my-spaces 페이지는 이미 `isSuperAdmin` prop 보유.
- **진행 방식(사용자 확정 2026-06-21)**: WI-007의 main-직접 머지는 일회성 예외였음. **이후 작업(WI-009 포함)은 develop 정상 플로우** — `feature/WI-NNN` 분기 → 기계게이트 → 듀얼검증 → `.pass` → **develop PR 머지**. 라이브 반영이 필요해지면 그때 develop→main **승격**(process 07; 승격 시 main 푸시 작성자 = 인가 계정 `flowcoder25@gmail.com` 주의).

## main↔develop 정합 + 배포 상태 (2026-06-21)
- **WI-007이 main + develop 양쪽 반영** + **라이브 프로덕션 배포 완료**.
- main `2a6e2ed`(PR#3, WI-007) + `38459d5`(빈 재배포 트리거 커밋). 라이브 프로덕션 = `38459d5` = **구버전 main + WI-007**. **WI-001/002는 여전히 main 미반영**(승격 대상, 라이브에도 없음).
- develop = WI-001/002 + WI-007(back-sync `d8495f9`) + 원장. develop ⊇ main(WI-007 공통).
- 현재 체크아웃: `develop` (origin/develop 동기화).

## ⚠️ Vercel 배포 함정 (재발 주의)
- Vercel 프로덕션 = `main` 브랜치 배포. 커밋 작성자가 Vercel 팀 인가 계정이 아니면 프로덕션 배포가 **실패**(`team-members-and-roles`). GitHub Actions 빌드는 성공이어도 별개.
- 이번 해결: 깃 작성자를 `flowcoder25 <flowcoder25@gmail.com>`(repo-scoped)로 변경 후 빈 커밋 푸시 → 배포 success.
- **이후 main 푸시도 인가 작성자 유지 필요.** 되돌리려면 `git config user.email <원래값>`. 근본 해결 = Vercel 팀에 커밋 작성자 추가.

## Done (이번 세션, 2026-06-21)
- **WI-007-feat**: 스페이스 생성 슈퍼어드민 전용 제한 + `scripts/set-super-admin.mjs` 부트스트랩. 진입점 전수 게이팅(navbar 데스크톱/모바일 + my-spaces toolbar/empty-state) + POST 403 + /spaces/new redirect. 듀얼검증 codex PASS·evaluator 9.85(P3×2 defer→WI-008). main `2a6e2ed`(PR#3) → back-sync develop → 라이브 배포 `38459d5`. 스펙: `.claude/specs/auth/2026-06-21-superadmin-space-creation.md`.
- **kryou2922@gmail.com 슈퍼어드민 지정**(DB). 현재 슈퍼어드민: `admin@flowspace.dev`, `kryou2922@gmail.com`. (JWT라 변경 후 재로그인 필요)
- qa-agent/doc-agent 실행(정책 게이트). 스펙 문서 생성.

## Open Issues (Queue, 우선순위순)
- **WI-009-feat** (READY, 사용자 요청·최우선): 슈퍼어드민 전역 스페이스 뷰 + 관리버튼 (위 상세).
- **WI-008-fix** (READY): WI-007 P3×2 — `set-super-admin.mjs` 회수 인자 화이트리스트화, `POST /api/spaces` 403 응답 `code` 필드 일관화.
- **WI-003-refactor** (READY): 타 모듈 `internal/*` 직접 import 위반 정리(editor↔game, server→socket/chat).
- **WI-004-fix** (READY): `api/assets/[id]` DELETE 경로 격리(`../` 차단).
- **WI-005-fix** (READY): 접속 중 소켓 ban/kick 실시간 추방(크로스프로세스 설계).
- **WI-006-fix** (READY): `useScreenRecorder.onerror` pending resolve 미종결(P3 무해).

## Verification (WI-007-feat = 머지+배포 완료)
| Gate | Result | Evidence |
|---|---|---|
| tsc / lint / vitest / build | PASS (main 베이스 자기완결성 실증) | 세션 실측 + CI PR#3 green |
| codex / evaluator | PASS / WARNING 9.85 (P3×2 defer→WI-008) | `.flowset/eval-results/WI-007-feat.*` |
| .pass | 생성됨 | commit `49d272e` |
| merge | DONE | PR#3 → main `2a6e2ed` |
| Vercel 프로덕션 배포 | success | `38459d5` (작성자 인가 계정으로 재트리거) |

## 직전 완료 (참고)
- WI-001-fix(보안 8건, PR#1) / WI-002-fix(Phaser 누수, PR#2) — develop 머지 완료. 상세는 `fix_plan.md` Done + `.flowset/eval-results/WI-00{1,2}-fix.*`.
