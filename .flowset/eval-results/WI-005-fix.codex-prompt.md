당신은 독립적인 적대적 코드 검증자(codex)다. 아래 WI-005-fix 구현을 read-only로 검증하고, 결함을 P0~P3로 분류해 **출력 스키마에 맞는 JSON만** 반환하라. reviewer는 "codex", schemaVersion은 1, scores와 weightedTotal은 null. verdict는 P0/P1(fixNow) 있으면 FAIL, 경미한 결함만 있으면 WARNING, 무결하면 PASS.

## 변경 범위 (commit b941897)
접속 중 사용자를 dashboard에서 ban/kick/mute/unmute/changeRole 했을 때, 별 호스트의 socket.io 서버(OCI 단일 인스턴스, Redis 없음)의 살아있는 연결에 즉시 반영하는 크로스프로세스 채널 신설.

### 신규 파일
- `src/features/space/enforce/internal/contract.ts` — 순수 계약(Next·socket 공유). `EnforceAction`/`EnforceRole`/`EnforceRequest`, HMAC-SHA256(`{timestamp}.{rawBody}`) 서명 생성/검증(timing-safe), replay window(±30s), body size limit(4096), `parseEnforceRequest` 스키마 검증.
- `src/features/space/enforce/internal/dispatch.ts` — Next 측. DB 갱신 후 `dispatchEnforcement(req)`가 `SOCKET_INTERNAL_URL`/`SOCKET_INTERNAL_SECRET`으로 서명+fetch(await, 2s timeout). 미설정 시 프로덕션 loud error, 그 외 조용히 생략. 실패해도 throw 없이 `{enforced:false}`.
- `src/features/space/enforce/index.ts` — 배럴(dispatch + 타입만 노출).
- `src/features/space/enforce/internal/contract.test.ts` — 17 케이스.
- `server/handlers/enforce.ts` — socket 측. `POST /internal/enforce` 핸들러: 시크릿 존재→body(size limit)→서명/replay 검증→`parseEnforceRequest`→**DB postcondition 재확인**(ban이면 실제 BANNED인지, kick이면 row null인지 등)→`applyEnforcement`. applyEnforcement: 같은 spaceId room에서 userId의 모든 소켓(다중 탭) 찾아 ban/kick=`space:error`(BANNED/KICKED) emit + 주변 `member:kicked` 1회 + grace(250ms) 후 `disconnect(true)`; mute/unmute=`socket.data.restriction` 갱신 + member:muted/unmuted; role=`socket.data.role` 갱신.

### 수정 파일
- `server/index.ts` — `createServer(requestHandler)`로 변경(socket.io가 캡처해 non-socket.io 요청 위임). `let io` 선언 후 할당, 핸들러는 요청 시점 호출이라 io 바인딩됨. enforce 경로 아니면 404.
- `src/app/api/spaces/[id]/admin/members/route.ts` — 각 액션(ban/kick/mute/unmute/changeRole) DB 갱신 후 `target.userId` 있으면(게스트는 userId null→스킵) `dispatchEnforcement` await, 응답에 `realtimeEnforced` 병기. kick은 delete 후 early return 경로.
- `Dockerfile.socket`/`deploy-socket.yml` — contract.ts COPY/트리거 추가. `.env.example` — 새 env 2개.

## 컨텍스트 (회귀 판단 기준)
- reconnect(재접속)는 WI-001 join 게이트가 이미 차단(`join:space`에서 멤버십+BANNED 동기 검증). 이번 WI는 "이미 살아있는 연결"의 즉시 추방만 담당.
- socket 서버는 별도 esbuild 번들 — 배럴 import 시 React가 끌려와 빌드 깨짐(WI-003 교훈). 그래서 server는 순수 `contract.ts`만 상대 import/COPY. ESLint·module-boundaries 테스트는 src/만 검사(server/scripts 제외).
- socket.data.{userId,spaceId,role,restriction}은 인메모리 캐시(join 시 DB에서 채움). 기존 인게임 `admin:kick`/`admin:mute`는 nickname 기반 별도 경로(유지).
- 기존 기계게이트 전부 통과(tsc 0 / lint 0 / vitest 88·88 / next build 0 / 서버 esbuild 번들). 테스트 결함 지적은 불필요.

## 중점 검증 관점
1. **인증/보안 경계**: HMAC 서명 검증의 우회 가능성(timing-safe·길이불일치·비-hex·replay), 시크릿 미설정 fail-closed(socket=503 거부, Next=loud/skip), public 엔드포인트 노출 위험, body size limit.
2. **권한 회수 정확성**: changeRole 강등 시 socket.data.role 갱신이 실제로 인게임 admin 이벤트를 차단하는가(role 캐시 외 다른 admin 판정 경로 잔존?).
3. **DB postcondition 재확인의 견고성**: race(enforce가 DB write 직후 도착) / 멱등 / mute·unmute·ban·kick·role 각 분기의 정확성. `spaceId_userId` unique 가정.
4. **소켓 추방 정확성**: grace 후 disconnect가 leaveSpace(presence 정리)/player:left와 중복/누락 없이 동작하는가, 다중 탭, member:kicked 중복.
5. **serverless 정합**: Vercel await + timeout, best-effort 실패 시 사용자 표현(realtimeEnforced), DB는 반영됐는데 socket 실패 시 일관성.
6. **경계/캡슐화**: enforce 모듈 분리가 WI-003 규칙 위반 없는가, server의 contract.ts 직접 import 정당성, 배포 경로 누락(COPY/paths).
7. **내가 놓친 위험 1가지** 이상.

코드를 직접 읽고(특히 위 신규/수정 파일) 판정하라. P0/P1은 실제 악용·기능파괴 경로가 입증될 때만. 방어적 하드닝 여지는 P2/P3 + defer 가능.
