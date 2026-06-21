# FlowSpace Fix Plan

> WI 워크리스트. 상태값: `READY | ACTIVE | VERIFY | BLOCKED | DONE | DROPPED`. 한 번에 하나만 `ACTIVE`.
> WI ID/타입은 wi-global enum 준수: feat·fix·docs·style·refactor·test·chore·perf·ci·revert.
> 초기 시드 = 2026-06-19 듀얼 블라인드 검증(codex CLI + Claude) 확정 결함.

## Active WI
- (없음) — WI-007-feat **main 머지 + 라이브 배포 완료**. 다음 세션 최우선: **WI-009-feat(슈퍼어드민 전역 스페이스 뷰, 사용자 요청)**.

## Queue
| WI | Type | Status | Goal | Notes |
|---|---|---|---|---|
| WI-009-feat | feat | READY | **슈퍼어드민 전역 스페이스 뷰** — `GET /api/spaces`가 슈퍼어드민에게 전체 ACTIVE 반환 + `space-card` '관리' 버튼 슈퍼어드민 노출(myRole 무관) | **사용자 요청·최우선**. "내 스페이스에 전체 노출" 방식. 백엔드 인가는 이미 슈퍼어드민 통과 — UI/목록만 추가. 상세 HANDOFF |
| WI-003-refactor | refactor | READY | 타 모듈 `internal/*` 직접 import 위반 정리 (editor↔game, server→socket/chat) | 경계 위반 |
| WI-008-fix | fix | READY | WI-007 듀얼검증 P3×2 해소: (1) `set-super-admin.mjs` 회수 인자 화이트리스트화(미인식 입력 에러), (2) `POST /api/spaces` 403 응답 `code` 필드 일관화 | P3, WI-007 evaluator(9.85) defer |
| WI-004-fix | fix | READY | `api/assets/[id]` DELETE unlink 시 `public` 경로 격리(`../` 차단) | P2 |
| WI-005-fix | fix | READY | 접속 중 소켓 ban/kick 실시간 추방 (dashboard 제재 시 현재 연결 즉시 종료/room 제거). Next HTTP↔socket.io 크로스프로세스 채널(Redis pub-sub/내부훅/액션별 DB재조회 택1) 설계 필요 | WI-001 듀얼검증서 codex 신규 P2 분리. reconnect는 WI-001 join 게이트가 이미 차단 |
| WI-006-fix | fix | READY | `useScreenRecorder` `recorder.onerror` 경로에서 pending stopRecording resolve 미종결 → 'error' 이벤트 시 Promise 영구 pending | P3, WI-002 듀얼검증서 evaluator 신규(발산). 무해(자원 누수 없음·기능 무영향). onerror에서도 pendingStopResolveRef settle 또는 안전망 타임아웃 |

## Done
- **WI-007-feat** (접근제어) — 스페이스 생성 슈퍼어드민 전용 제한 + 슈퍼어드민 부트스트랩 스크립트. 생성 진입점 전수 게이팅(navbar 데스크톱/모바일 + my-spaces toolbar/empty-state) + `POST /api/spaces` 403 + `/spaces/new` 서버 redirect. 기계게이트 4/4 PASS(**main 베이스 자기완결성 실증**) + 듀얼검증 2R(codex PASS·evaluator WARNING 9.85, P3 2건 defer→WI-008) + `.pass`. **타깃 base=`main`** (사용자 지시, 별도 작업): feat `49d272e` → **PR#3 → main `2a6e2ed`**. back-sync develop 완료(`d8495f9`). **라이브 프로덕션 배포 완료** `38459d5`(작성자 인가 계정 재트리거). 스펙: `.claude/specs/auth/2026-06-21-superadmin-space-creation.md`.
- **WI-002-fix** (안정성) — Phaser 씬 생명주기 cleanup 미연결 누수 + useScreenRecorder unmount 정리. 기계게이트 4/4 PASS + 듀얼검증 3라운드(codex PASS·evaluator WARNING 9.6, P3 1건 defer→WI-006) + `.pass` 생성. 구현: MainScene `create()`에서 SHUTDOWN+DESTROY once 연결 + 멱등 가드 + 반대편 리스너 해제; useScreenRecorder useEffect cleanup + mountedRef 가드 + pendingStopResolveRef. **develop 머지 완료 (PR#2, merge `256ae57`)**.
- **WI-001-fix** (보안) — 인증/인가 우회·데이터 노출 8건 차단. 기계게이트 4/4 PASS + 듀얼검증(codex PASS·evaluator PASS 9.375) + `.pass` 생성. 구현: join 동기인가, members IDOR, GET select allowlist, 멤버 PII 게이트, guest PASSWORD, middleware exact, AUTH_SECRET fail-closed, 역할계층 canActOn. **develop 머지 완료 (PR#1, merge `f8e7ba2`)**.
