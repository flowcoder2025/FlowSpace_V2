# 설계 협의 (consult r1) — READY 큐 소진, 다음 WI 선정 + 설계

너는 FlowSpace(Next.js 15 + Phaser 메타버스, develop 브랜치) 코드베이스를 read-only로 보는 시니어 설계 검토자다.
산문으로 답하라. 마지막에 "내가(요청자가) 놓칠 위험 1가지"를 반드시 포함하라.

## 상황
- READY 큐 소진. WI-031(대시보드 CSV)까지 전부 develop 머지 완료. develop→main 승격은 **사용자 승인 게이트**(자동 아님).
- 남은 BACKLOG 4건은 전부 저우선·**오늘 실누출/실버그 표면 0**으로 등록돼 있음. 나는 4건을 read-only로 실측했고 아래는 그 사실(file:line은 네가 직접 확인 가능).
- 나는 이 중 하나를 정상 플로우(분기 → 기계게이트 tsc/lint/vitest/build → 듀얼 블라인드 검증[codex+evaluator, 변이검증] → .pass → develop PR)로 처리하려 한다.

## 실측 사실 (4건)

### WI-025 (perf) — parsePageNumber page 상한 부재
- `src/lib/pagination.ts:43-47` parsePageNumber: 1 미만 클램프하나 상한 없음(`return n`). 독스트링 line 38 "상한 없음", 테스트 `pagination.test.ts:86-88`이 `"100000"→100000` 무상한을 계약으로 못박음.
- offset(skip) 페이지네이션 라우트는 `/api/assets` GET **단 하나**(`route.ts:50,78` `skip:(page-1)*limit`). 나머지 페이지네이션(spaces/messages/admin/*)은 전부 cursor(buildCursorPage).
- 클라 소비처 2곳(asset-palette.tsx:38, game-loader.ts:124) 모두 page 미전송. 소스 전역 `set("page")` 0건. 음수 skip(→500)은 WI-022가 이미 차단.
- 남은 위험: 인증 사용자가 수동으로 `?page=100000000` 던질 때 OFFSET 풀스캔 1회(이론적 DoS).

### WI-026 (fix) — 저장 metadata public/internal 분리 (at-rest 위생)
- generate `route.ts:91` / batch `route.ts:80-83`가 `GeneratedAssetMetadata` 전체를 DB metadata(Json)에 통째 저장. 그 타입(`types.ts:74-95`)엔 prompt/workflow/comfyuiJobId 민감 3필드 포함.
- 응답 누출은 0: 유일 노출 경로 `GET /api/assets/[id]`가 `PUBLIC_METADATA_KEYS`(10키) allowlist로 정규화, owner-gated, 테스트 lock(`[id]/route.test.ts:154-156`). 목록은 metadata 미반환.
- 소비처: frameWidth/frameHeight만 읽힘(sprite-generator). prompt/workflow/comfyuiJobId 읽는 런타임 소비처 0.
- 위험: batch `{...metadata, batchId}`에서 batchId 보존 필수(batch GET 폴링 `metadata.path:[batchId]`). 과거 행 at-rest는 백필해야 완결(선택).

### WI-028 (feat) — Vercel↔OCI AUTH_SECRET 불일치 배포 후 probe
- 서명(`api/socket/token/route.ts:17,32`)·검증(`server/middleware/auth.ts:14,15`)·부팅검증(`socket-startup.ts:43`) 모두 동일 `getAuthSecret()`(`auth-secret.ts:18-29`, env AUTH_SECRET, len≥32). **코드는 단일 소스, 차이는 런타임 env 저장소 2개(Vercel env vs OCI `.env`)뿐.**
- WI-018 부팅검증은 존재·길이만 봄(값 일치 검증 불가). 배포 헬스체크(deploy-socket.yml:44, compose:17)는 engine.io 핸드셰이크 200만 — **인증 미들웨어 이전 단계라 키 틀려도 200**(silent 실패 정확히 가능).
- 실표면 0: 라이브 동일 키 반복 실증(fix_plan.md:38, PR#29). 트리거는 미래 운영 이벤트(로테이션 한쪽만/오타/신규환경 키 누락).
- 두 갈래: (A) 소켓 self-probe(자기 키로 자기 토큰 검증 → **항상 통과 = false-pass**, cross-service 불일치 구조적 미검출), (B) 진짜 cross-service round-trip(Vercel 라우트는 auth() 세션 가드 뒤 → 비인증 토큰 발급 **새 공개표면** 필요 = 보안 리뷰 대상). CI 런너엔 AUTH_SECRET 실값 부재(더미만).

### WI-032 (fix) — 어드민 로그 SpaceEvent payload 금지 키 가드
- payload write site 정확히 5곳(livekit/webhook:147,166 / admin/announce:59 / admin/members:158,198 / admin/messages:53). 전부 operational 메타데이터만(action/messageId/targetMemberId/targetName/senderName/trackType/trackSource/participantName). email/inviteCode/accessSecret/prompt 넣는 site 0.
- read/render 3경로: API `admin/logs/route.ts:62-75`(명시 select 없음 → payload 포함 raw 반환), 화면 `event-log-table.tsx:54`(`JSON.stringify(log.payload)`), CSV `csv-export.ts:74 stringifyPayload`(키 필터 0). logs API는 OWNER/STAFF/superAdmin 인가 게이트.
- 실표면 0(현 payload 깨끗). 예방 가드레일. WI-014/019/021/024와 동형(DB Json → allowlist 미적용 시 누출). 권고안: 렌더 시점(읽기 3경로 공유) + key allowlist 순수 함수, vitest 격리.
- 위험: allowlist 채택 시 현존 8키 전수 등재(누락 시 Details 빈값 회귀), payload 타입 3파일 중복선언(drift), client-safe lib 배치, CSV 인젝션 중화 이전 단계 끼우기.

## 내 잠정 판단(반박/수정 환영)
1. **WI-028은 코드-WI로 부적합** — cross-service 키 불일치는 단위테스트 재현 불가(배포/운영 이벤트), 테스트 가능한 self-probe(A)는 false-pass라 오히려 해롭다(WI-006/011 false-pass 교훈). 운영 runbook + deploy-socket.yml 인증 round-trip 1단계가 본질. BACKLOG 유지.
2. **WI-032가 코드-WI 최선 후보** — small·low-risk·순수함수 테스트, 프로젝트가 WI-014/019/021/024에서 반복 확립한 deny-by-default 레일과 정확히 동형(DB Json 컬럼이 응답/화면/CSV 3경로로 자동 노출되는 패턴을 payload에도 차단). 실누출 0이지만 일관된 하드닝.
3. WI-025/026은 cheap하나 순수 defense-in-depth·표면 0, 단독 사이클 ROI 낮음.

## 질문
1. 4건(또는 "지금은 코드 WI 대신 승격/사용자 확인이 옳다")의 **우선순위**를 정하라. 내 판단(WI-032 최선, WI-028 부적합)에 동의/반박?
2. 선정 1건의 **설계**를 검토·구체화하라. (WI-032라면: 렌더 시점 vs 작성 시점, allowlist vs denylist, 가드 배치 위치, 응답 매핑을 logs route에 넣을 때 buildCursorPage 응답 계약 정합, 타입 단일화 범위.)
3. 내가 놓칠 위험 1가지.
