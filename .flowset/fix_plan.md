# FlowSpace Fix Plan

> WI 워크리스트. 상태값: `READY | ACTIVE | VERIFY | BLOCKED | DONE | DROPPED`. 한 번에 하나만 `ACTIVE`.
> WI ID/타입은 wi-global enum 준수: feat·fix·docs·style·refactor·test·chore·perf·ci·revert.
> 초기 시드 = 2026-06-19 듀얼 블라인드 검증(codex CLI + Claude) 확정 결함.

## Active WI
- (없음) — WI-008-fix **듀얼검증 PASS·`.pass` 생성**(commit `e19d8be`, develop PR 대기). 다음 세션 우선: **WI-003-refactor**(경계 위반) → WI-004-fix(assets DELETE 경로격리).

## Queue
| WI | Type | Status | Goal | Notes |
|---|---|---|---|---|
| WI-003-refactor | refactor | READY | 타 모듈 `internal/*` 직접 import 위반 정리 (editor↔game, server→socket/chat) | 경계 위반 |
| WI-004-fix | fix | READY | `api/assets/[id]` DELETE unlink 시 `public` 경로 격리(`../` 차단) | P2 |
| WI-005-fix | fix | READY | 접속 중 소켓 ban/kick 실시간 추방 (dashboard 제재 시 현재 연결 즉시 종료/room 제거). Next HTTP↔socket.io 크로스프로세스 채널(Redis pub-sub/내부훅/액션별 DB재조회 택1) 설계 필요 | WI-001 듀얼검증서 codex 신규 P2 분리. reconnect는 WI-001 join 게이트가 이미 차단 |
| WI-006-fix | fix | READY | `useScreenRecorder` `recorder.onerror` 경로에서 pending stopRecording resolve 미종결 → 'error' 이벤트 시 Promise 영구 pending | P3, WI-002 듀얼검증서 evaluator 신규(발산). 무해(자원 누수 없음·기능 무영향). onerror에서도 pendingStopResolveRef settle 또는 안전망 타임아웃 |
| WI-010-perf | perf | READY | 슈퍼어드민 전역 스페이스 목록 페이지네이션(`GET /api/spaces` scope={} 시 take/cursor 또는 상한) | P3, WI-009 evaluator defer. 기존 엔드포인트도 무페이지네이션 — 회귀 아님, 스케일 부채 |
| WI-011-test | test | READY | `GET /api/spaces` filter 분기 회귀 테스트(전역 vs 멤버십, 화이트리스트, INVALID_FILTER 400). API 라우트 테스트 하니스(auth/prisma mock) 신규 도입 필요 | P3, WI-009 evaluator defer. 현재 vitest는 chat 유틸 한정 |

## Done
- **WI-008-fix** (정리/일관성) — WI-007 듀얼검증 defer P3×2 해소. (1) `scripts/set-super-admin.mjs` 회수 인자 화이트리스트화: `argv[3] !== "false"` 파싱이 오타('flse'/'False'/'0')를 조용히 부여로 처리하던 문제 차단 → `flagArg`를 'true'/'false'만 명시 인정, 그 외/잉여 인자는 usage 출력 후 exit 1. `--list`/무인자 분기 최우선 유지 + 기본 부여(인자 없음→true) 계약 보존(codex consult 반영). (2) `POST /api/spaces` 403 응답에 `code: "SUPER_ADMIN_REQUIRED"` 병기(app.md invariant #4 정합). 기계게이트 4/4 PASS(tsc/lint/vitest 52·52/build) + 듀얼검증(codex PASS·evaluator WARNING 9.875, P3×3 전부 defer: 2건 해소검증기록·1건 범위밖 선재엣지) + `.pass`(fingerprint 6a288939). 설계 codex consult 1R. 변경 2파일(scripts/set-super-admin.mjs, src/app/api/spaces/route.ts). **develop PR 대기**(commit `e19d8be`).
- **WI-009-feat** (접근제어/UX) — 슈퍼어드민 전역 스페이스 뷰. `GET /api/spaces` filter 분기 명시화(owned/joined/all|null) + 슈퍼어드민 "전체"=모든 ACTIVE(`scope={}`, 일반 사용자 동작 불변) + 미허용 filter 400(`code:INVALID_FILTER`) + 목록 응답 `inviteCode` 제거(죽은 필드·전역 누출 차단). `SpaceCard`/`SpaceListView` `isSuperAdmin` prop → myRole 무관 '관리' 노출(서버 세션 권위, 클릭 후 `requireSpaceAdmin` 재검증). `space-store` 죽은 `inviteCode` 필드 제거. 기계게이트 4/4 PASS + 듀얼검증(codex PASS·evaluator WARNING 9.8, P3×2 defer→WI-010-perf/WI-011-test) + `.pass`(fingerprint 2dedbb42). 설계 codex consult 1R. **develop 머지 완료 (PR#4, merge `08fc2b9`, feat `fb484d6`)**.
- **WI-007-feat** (접근제어) — 스페이스 생성 슈퍼어드민 전용 제한 + 슈퍼어드민 부트스트랩 스크립트. 생성 진입점 전수 게이팅(navbar 데스크톱/모바일 + my-spaces toolbar/empty-state) + `POST /api/spaces` 403 + `/spaces/new` 서버 redirect. 기계게이트 4/4 PASS(**main 베이스 자기완결성 실증**) + 듀얼검증 2R(codex PASS·evaluator WARNING 9.85, P3 2건 defer→WI-008) + `.pass`. **타깃 base=`main`** (사용자 지시, 별도 작업): feat `49d272e` → **PR#3 → main `2a6e2ed`**. back-sync develop 완료(`d8495f9`). **라이브 프로덕션 배포 완료** `38459d5`(작성자 인가 계정 재트리거). 스펙: `.claude/specs/auth/2026-06-21-superadmin-space-creation.md`.
- **WI-002-fix** (안정성) — Phaser 씬 생명주기 cleanup 미연결 누수 + useScreenRecorder unmount 정리. 기계게이트 4/4 PASS + 듀얼검증 3라운드(codex PASS·evaluator WARNING 9.6, P3 1건 defer→WI-006) + `.pass` 생성. 구현: MainScene `create()`에서 SHUTDOWN+DESTROY once 연결 + 멱등 가드 + 반대편 리스너 해제; useScreenRecorder useEffect cleanup + mountedRef 가드 + pendingStopResolveRef. **develop 머지 완료 (PR#2, merge `256ae57`)**.
- **WI-001-fix** (보안) — 인증/인가 우회·데이터 노출 8건 차단. 기계게이트 4/4 PASS + 듀얼검증(codex PASS·evaluator PASS 9.375) + `.pass` 생성. 구현: join 동기인가, members IDOR, GET select allowlist, 멤버 PII 게이트, guest PASSWORD, middleware exact, AUTH_SECRET fail-closed, 역할계층 canActOn. **develop 머지 완료 (PR#1, merge `f8e7ba2`)**.
