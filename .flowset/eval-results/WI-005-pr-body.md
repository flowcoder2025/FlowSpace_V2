## WI-005-fix — 접속 중 소켓 ban/kick 실시간 추방 (Next↔socket 크로스프로세스 enforce 채널)

### 문제 (P2)
dashboard 관리 제재(`PATCH /api/spaces/[id]/admin/members`: ban/kick/mute/unmute/changeRole)가 **DB만 갱신**하고, 별 호스트의 socket.io 서버(OCI 단일 인스턴스, Redis 없음)의 **살아있는 연결엔 무영향**이었다.
- **ban**: 재접속 전까지 채팅/이동 지속(인메모리 `socket.data.restriction`이 NONE 캐시).
- **kick**: `SpaceMember` row 삭제돼도 접속 중 소켓이 room에 잔존.
- **changeRole 강등**: 인메모리 `socket.data.role`이 admin으로 남아 **권한 회수 실패**(설계 codex consult가 지목한 최대 위험 — 단순 UX 지연이 아닌 보안 결함).
- reconnect는 WI-001 join 게이트가 이미 차단 → 이번 WI는 "이미 살아있는 연결"의 즉시 추방 담당.

### 설계 (codex consult 1R 반영)
크로스프로세스 채널로 **옵션 B**(socket httpServer 내부 인증 webhook) 채택. Redis는 단일 인스턴스에 과함(멀티 인스턴스 전환 시 WI-012), 폴링은 즉시성 위배.

- **socket 서버**: `createServer(requestHandler)`로 `POST /internal/enforce` 처리(socket.io가 non-socket.io 요청 위임). 다층 방어:
  - `SOCKET_INTERNAL_SECRET` **HMAC-SHA256(`{timestamp}.{body}`)** 서명(timing-safe, 비-hex/길이불일치/홀수 선제거; 시크릿 없으면 503 fail-closed) + **replay window ±30s** + **byte size limit** + 스키마 검증.
  - **DB postcondition 재확인**(ban=BANNED/kick=row null/mute=MUTED/unmute=NONE/role=role) 후에만 소켓 조작 → 시크릿 유출·Next 버그가 임의 추방으로 확대되는 것 차단(409).
  - ban/kick: 타겟에 `space:error`(BANNED/KICKED) emit → **`detachSocketFromSpace`로 동기 권한 회수**(자기 id 제외 모든 room[공간+파티] 이탈 + `socket.data` 무효화 → 전 핸들러가 `socket.data.spaceId` 가드라 grace 동안 잔존권한 0) → grace(250ms) 후 물리 `disconnect(true)`(패킷 flush 보장). 주변엔 `member:kicked` + `player:left` **사용자 단위 1회**.
  - mute/unmute: `socket.data.restriction` 캐시 갱신. role: `socket.data.role` 캐시 갱신(권한 즉시 회수).
- **Next PATCH**: DB 갱신 후 `dispatchEnforcement` **await**(serverless fire-and-forget 금지, 2s timeout, throw 없이 `realtimeEnforced` 플래그). URL/SECRET 미설정 시 프로덕션 loud error·그 외 생략(재접속은 join 게이트가 차단).
- **leave 경로 하드닝**: `leave:space`가 클라 spaceId 무시·`socket.data.spaceId`만 사용(communication invariant #3), `leaveSpace`가 `socket.data` 무효화 → 정상 퇴장 후 stale 인가 차단.

### 경계 / 배포
- enforce **독립 feature 모듈**(`src/features/space/enforce/`): 순수 계약 `contract.ts`(Next·socket 공유) + Next측 `dispatch.ts` + 배럴. route는 `@/features/space/enforce` 배럴 경유(WI-003 준수), server는 별도 esbuild 번들이라 배럴 우회해 `contract.ts`만 상대 import/COPY.
- `Dockerfile.socket` COPY + `deploy-socket.yml` paths + `.env.example`(`SOCKET_INTERNAL_SECRET`은 **AUTH_SECRET과 분리** — blast radius).

### 검증
| Gate | Result |
|---|---|
| tsc / lint / vitest(88·88, +17 enforce 계약) / next build / 서버 esbuild 번들 | **5/5 PASS** |
| codex (블라인드, 3R) | **r3 PASS 0 issues** (r1 FAIL P1 grace-window → r2 FAIL P1×2 party잔존+leave경로 → r3 수렴) |
| evaluator (블라인드) | WARNING **9.62** (P0/P1/P2 없음, P3×3 전부 defer) |
| .pass | 생성 (fingerprint `aa917d91`) |

P3 defer: rate-limit→WI-012(인프라) / replay nonce→멱등설계상 무해 / 소켓측 통합테스트→WI-011.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
