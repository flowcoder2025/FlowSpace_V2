# HANDOFF

## Active WI
(없음) — WI-011-test **듀얼검증 PASS·.pass 생성, develop PR 대기**(commit `baa2f0c`). 다음 우선은 **WI-012-refactor / WI-013-perf (전부 P3)**.

## ⚠️ 다음 세션 우선 — 남은 P3 부채
- 큐(READY, 전부 P3): WI-012-refactor(protocol 순수계약 모듈 분리 + 소켓상수 물리이동 + enforce·assets write-side 중앙화 + **messages 라우트 cursor 로직을 WI-010 신규 `src/lib/pagination.ts` 공용 헬퍼로 통일**(WI-010 evaluator P3 흡수) + **useScreenRecorder stopRecording close `.catch` 비대칭 통일**(WI-006 evaluator P3 선재 흡수) + **POST /api/spaces 전체 커버리지·하니스 미사용 경로 소비**(WI-011 evaluator P3 흡수 — 신규 `src/__tests__/helpers/api-route.ts` 재사용)) / **WI-013-perf**(`GET /api/spaces` 핫 쿼리용 Space 복합 인덱스 `status`+`updatedAt desc`+`id desc` 마이그레이션 — WI-010 듀얼검증 codex r3+evaluator 공통 defer, DB 마이그레이션 승인+프로덕션 EXPLAIN 검증 필요).
- **진행 방식(사용자 확정 2026-06-21)**: 모든 WI는 develop 정상 플로우 — `feature/WI-NNN` 분기 → 기계게이트(tsc/lint/vitest/build) → 듀얼검증(codex CLI + evaluator-agent) → `.pass` → **develop PR 머지**(프로세스 07상 사용자 승인 불요). 경계 변경 WI는 구현 전 codex consult 필수(process 02). 라이브 반영이 필요하면 그때 develop→main **승격**(process 07; 승인 필요 + main 푸시 작성자 = 인가 계정 `flowcoder25@gmail.com`).

## Done 추가 (이번 세션, 2026-06-22)
- **WI-011-test**: `GET /api/spaces` filter 분기 회귀 + 재사용 API 라우트 테스트 하니스 + `useScreenRecorder` unmount 경로 테스트(WI-006 evaluator P3 흡수). **테스트 전용 — 소스(.ts) 무수정**(route.ts/useScreenRecorder.ts 불변, 양 검증자 `git diff HEAD -- src/` 빈결과 확인). 신규 하니스 `src/__tests__/helpers/api-route.ts`(순수 빌더 — `vi.mock` 프리앰블은 파일로컬 호이스팅이라 빌더만 공용화, 설계 codex consult 합의). route.test.ts 17케이스(filter→scope owned/joined/null·all×일반/슈퍼어드민 권한격리, INVALID_FILTER 400+prisma 미접근, status:ACTIVE 상시, 페이지네이션 take/cursor/skip, cursor에도 scope 보존, 응답 exact-key-set allowlist, POST superAdmin 가드). useScreenRecorder unmount 3케이스(stopping중 언마운트 settle[WI-006 흡수, 변이검증]/언마운트후 stopRecording 즉시resolve/saveFile await중 언마운트 mountedRef 가드[고유 delay setTimeout 식별로 변이검증 가능하게]). vitest 108→128(+20). 기계게이트 4/4. **듀얼검증 codex r1 WARNING P3x3 → r2 PASS 0 issues** · **evaluator r1 9.3 → r2 9.625**(잔여 P3x3 전부 defer=WI-012). 두 검증자 r1에서 'mountedRef 가드 smoke false-pass' 동일 수렴 발견 → 선제 강화(superAdmin scope·exact-key allowlist 포함 3건). 설계 codex consult 1R. + `.pass`(fingerprint `cfdd572c`). **develop PR 대기 (commit `baa2f0c`)**.

## Done 추가 (이번 세션, 2026-06-22)
- **WI-010-perf**: `GET /api/spaces`가 페이지네이션 없이 전체 ACTIVE 스페이스를 로드하던 스케일 부채(P3, WI-009 슈퍼어드민 전역 `scope={}`) 해소. cursor 페이지네이션(`parsePageLimit` 기본 50·최대 100 + `cursor`, `take:limit+1` → `buildCursorPage` → `{spaces,nextCursor,hasMore}`, 기존 spaces 유지=하위호환) + `orderBy [updatedAt desc, id desc]`(id 타이브레이커) + 모든 스코프 일관. 클라: `space-store` `loadMore`+`_reqId` 토큰(stale 응답 무시) + `space-list-view` "더 보기"(전역 가시성 회귀 방지). 신규 순수 헬퍼 `src/lib/pagination.ts`(+테스트). vitest 92→108. 기계게이트 4/4. **듀얼검증 codex 3R 수렴**(r1 FAIL P2/fixNow `isLoadingMore` 고착 → 수정 `529108e` / r2 WARNING P3 역방향 누수 → 선제 해소 `ed73930` / r3 WARNING P3×1 defer) · evaluator WARNING 9.7(최종 HEAD 재검증, P3×4 defer, 변이검증 5종 검출, 보안 sound) + `.pass`(`2ef1dd0b`). 설계 codex consult 1R(경쟁상태 위험 E 지목). **두 검증자 r1 동일 실결함 독립 발견**. 남은 P3→WI-013-perf(인덱스)/WI-012(cursor검증·messages DRY). **develop 머지 완료 (PR#10, merge `47022a6`, impl `ed73930`)**.

## Done 추가 (이번 세션, 2026-06-22)
- **WI-006-fix**: `useScreenRecorder`의 `recorder.onerror`가 handleError+idle+stopTimer만 하고 `stopRecording()`이 보관한 `pendingStopResolveRef`를 settle하지 않아, 'error' 이벤트 후 `onstop` 미발화 시 `stopRecording()` Promise가 영구 pending이던 P3 결함 해소. `onerror`를 정상 abort로 강화: `onstop=null`(중복 저장 차단)+`audioContext close`+`chunks 폐기`+`mediaRecorderRef===recorder`시 null+`pendingStopResolveRef` settle. resolve 시맨틱은 기존 onstop의 `result.status==="error"` 경로와 일관(오류는 error 상태/onError로 전달, `Promise<void>` 계약 유지). 신규 vitest 4(88→92). 기계게이트 4/4 PASS. 듀얼검증 codex **r1 PASS 0 issues**·evaluator WARNING 9.5(P3×3 defer) + `.pass`(`19ecaf43`). 설계 codex consult 1R(settle-in-onerror가 안전망 타임아웃보다 우수 — saveFile 진행 중 premature resolve 회피). evaluator 뮤테이션 테스트로 결함 검출 실증(pre-fix 복원 시 test1·3 5초 타임아웃 FAIL). **develop PR 대기**(commit `5c9fa16`).

## Done 추가 (이번 세션, 2026-06-22)
- **WI-005-fix**: 접속 중 dashboard 제재(ban/kick/mute/unmute/changeRole)가 DB만 갱신하고 별 호스트 socket.io(OCI 단일 인스턴스, Redis 없음)의 살아있는 연결엔 무영향이던 P2 해소. ban=재접속까지 채팅/이동 지속, kick=row 삭제돼도 소켓 잔존, **changeRole 강등 시 인메모리 role이 admin으로 남아 권한 회수 실패**(codex consult 최대 위험 지목)가 근본. 크로스프로세스 채널 = socket httpServer 내부 `POST /internal/enforce` webhook. 다층 방어: `SOCKET_INTERNAL_SECRET` HMAC-SHA256(`{ts}.{body}`) 서명(비-hex/길이불일치/홀수 선제거 후 timingSafeEqual, 시크릿 없으면 503) + replay ±30s + byte size limit + 스키마 검증 + **DB postcondition 재확인**(ban=BANNED/kick=row null/mute=MUTED/unmute=NONE/role=role) 후 소켓 조작(시크릿 유출→임의추방 확대 차단, 409). ban/kick은 **detachSocketFromSpace로 동기 권한 회수**(자기 id 제외 모든 room[공간+파티] 이탈 + socket.data[spaceId/partyId/role/restriction/memberId] 무효화 → 전 핸들러 spaceId 가드라 grace 동안 잔존권한 0) 후 grace(250ms) 물리 disconnect, 주변엔 member:kicked + player:left 사용자 단위 1회(removeUserPresence). leave:space도 클라 인자 무시(invariant #3)·leaveSpace가 socket.data 무효화하도록 하드닝. Next PATCH는 dispatchEnforcement await(serverless fire-and-forget 금지, 2s timeout, throw 없이 realtimeEnforced). 경계: enforce 독립 feature 모듈(순수 contract.ts + Next측 dispatch.ts), server는 배럴 우회 contract.ts만 상대 import/COPY. SOCKET_INTERNAL_SECRET은 AUTH_SECRET과 분리. 신규 vitest 17(71→88). 기계게이트 5/5 PASS(tsc 0/lint 0/vitest 88·88/next build 0/서버 esbuild 번들) + 듀얼검증(codex **3R 수렴**: r1 FAIL P1 grace-window → r2 FAIL P1×2 party잔존+leave경로 → r3 **PASS 0 issues** · evaluator WARNING 9.62, P3×3 전부 defer) + `.pass`(fingerprint `aa917d91`). 설계 codex consult 1R + 검증 codex 3R. 핵심 패턴: **별 호스트(Vercel↔OCC) 크로스프로세스 추방 = HMAC 서명 내부 webhook + DB postcondition 재확인**(시크릿 유출 방어). **즉시 추방의 권한 회수는 disconnect만으로 불충분 — grace 동안 socket.data 캐시가 살아있어 동기 detach 필요**(모든 핸들러가 socket.data.spaceId 가드). **운영**: OCI `.env`에 `SOCKET_INTERNAL_SECRET`(AUTH_SECRET과 다른 값) + Vercel에 `SOCKET_INTERNAL_URL`(공개 socket 도메인)·`SOCKET_INTERNAL_SECRET` 설정 필요(미설정 시 DB만 반영). **develop 머지 완료 (PR#8, merge `a3de864`, impl `e8e714c`)**.
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
