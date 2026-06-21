# HANDOFF

## Active WI
(없음) — WI-004-fix **develop 머지 완료**(PR#7, merge `67531b4`, impl `bc334a7`). 다음 우선은 **WI-005-fix(소켓 ban/kick 실시간, P2)** → WI-006/010/011/012(P3 부채).

## ⚠️ 다음 세션 우선 — WI-005-fix (소켓 ban/kick 실시간 추방)
- READY, P2. 접속 중 dashboard 제재(ban/kick) 시 현재 소켓 연결 즉시 종료/room 제거. **Next HTTP ↔ socket.io 크로스프로세스 채널 설계 필요**(Redis pub-sub / 내부훅 / 액션별 DB 재조회 택1) — 경계 변경이므로 구현 전 codex consult 필수(process 02). reconnect는 WI-001 join 게이트가 이미 차단.
- 그다음: WI-006-fix(useScreenRecorder onerror, P3) → WI-010/011/012(P3 부채).
- **진행 방식(사용자 확정 2026-06-21)**: 모든 WI는 develop 정상 플로우 — `feature/WI-NNN` 분기 → 기계게이트(tsc/lint/vitest/build) → 듀얼검증(codex CLI + evaluator-agent) → `.pass` → **develop PR 머지**(프로세스 07상 사용자 승인 불요). 라이브 반영이 필요하면 그때 develop→main **승격**(process 07; 승인 필요 + main 푸시 작성자 = 인가 계정 `flowcoder25@gmail.com`).

## Done 추가 (이번 세션, 2026-06-22)
- **WI-004-fix**: `DELETE /api/assets/[id]` path traversal(CWE-22, P2) 차단. DB `filePath`/`thumbnailPath`를 검증 없이 unlink하던 것을 `resolveGeneratedAssetPath()`로 `public/assets/generated/` 경계 격리(백슬래시/null byte 거부 + POSIX URL 정규화 + prefix 검사 + `path.relative` 이중 검사). 경계 밖이면 unlink 스킵+warn, **DB row 삭제는 진행**(오염 row 정리). 헬퍼 `features/assets/internal/safe-path.ts`+배럴, route는 배럴 import(서버 라우트라 sharp/React-pull 무관). vitest 18케이스(53→71). 컨테인먼트 루트는 codex consult로 `public/`→`public/assets/generated/` 타이트화(전 write 경로 generated 귀결 실증→무회귀). 기계게이트 4/4 PASS + 듀얼검증(codex **PASS 0 issues**·evaluator WARNING 9.62, evaluator 16벡터 PoC 독립실행 전부 BLOCK·회귀0 실증, P3×3 전부 defer) + `.pass`(fingerprint `9fae5a70`). 설계 codex consult 1R + 검증 codex 1R PASS. write-side 중앙화는 WI-012 후속. **develop 머지 완료 (PR#7, merge `67531b4`, impl `bc334a7`)**.
- **WI-003-refactor**: 타 모듈 `internal/*` 직접 import 위반 정리(경계 캡슐화). 인앱 cross-module internal import **7건**을 배럴 routing으로 해소 — editor↔game(game 배럴 `TILE_INDEX`/`extractDefaultMapData`/`TilemapResult`, editor 배럴 `EditorSystem`; MainScene `await import` lazy 로드라 정적 순환 없음), socket→chat(chat 배럴 `MOVE_THROTTLE_MS`/`RECONNECTION_*`), stores/editor-store→editor 배럴. **재발 방지 이중 방어**: ESLint `no-restricted-imports`(`@/**/internal[/**]` alias 정밀·오탐0) + `src/__tests__/module-boundaries.test.ts`(import 경로 실해석으로 alias+상대경로 cross-module internal 정밀 차단, vitest 게이트 강제). 서버(별도 esbuild 번들 — 배럴 import 시 React 끌려와 빌드깨짐)·scripts dev툴의 순수 계약/internal import는 범위 밖 → **WI-012-refactor**(protocol 계약 모듈 분리)로 등록. 기계게이트 **5/5** PASS(tsc/lint/vitest 53·53/build/서버 esbuild 번들) + 듀얼검증(codex **4R 최종 PASS**·evaluator WARNING 9.5, P3×4 전부 defer) + `.pass`(fingerprint fc768c9d). 설계 codex consult 1R + 검증 codex 4R 수렴. 스펙: `.claude/specs/architecture/2026-06-22-module-boundary-encapsulation.md`. **develop 머지 완료 (PR#6, merge `edd2918`, feat `58c9025`)**.
- **WI-008-fix**(직전, 2026-06-21): WI-007 P3×2 해소. **PR#5 머지 완료**(`1de51a5`). (이전 HANDOFF가 '머지만 남음'으로 stale했음.)

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
