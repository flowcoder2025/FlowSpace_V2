# 설계 협의 (consult) — WI-005-fix: 접속 중 소켓 ban/kick 실시간 추방 (Next HTTP ↔ socket.io 크로스프로세스)

당신은 시니어 분산시스템/보안 리뷰어다. 아래 WI-005-fix 설계안을 검토하고, **내가 놓친 위험 1가지 이상**을 반드시 지적하라. 산문으로 간결히. 파일 수정은 하지 말고 설계 판단만.

## 배경 / 현재 아키텍처
FlowSpace = Next.js 15 풀스택(Vercel 배포) + 별도 socket.io 서버(OCI Docker, 단일 인스턴스).
- **Next.js (Vercel)**: dashboard 관리 API `PATCH /api/spaces/[id]/admin/members`. 액션 `mute|unmute|kick|ban|changeRole`. **DB만 갱신**(`SpaceMember.restriction`/`role` 또는 kick 시 row delete). socket 서버와 연결 없음.
- **socket.io 서버 (OCI, 별 호스트)**: `server/index.ts`가 `http.createServer()`에 socket.io 부착. 단일 프로세스, **Redis 없음**(in-memory adapter). 인증은 AUTH_SECRET 기반 HS256 JWT(`/api/socket/token`에서 발급 → handshake.auth.token → `verifySocketToken`).
- 소켓 상태는 in-memory: `socket.data.{userId,spaceId,role,restriction,memberId}`, `spacePlayersMap: Map<spaceId, Map<userId, PlayerData>>`.
- **join 게이트(WI-001)**: `join:space`에서 동기 인가 — 공간 ACTIVE + 멤버십 + `restriction==="BANNED"` 차단. 즉 **재접속(reconnect)은 이미 차단됨**.

## 문제 (P2)
dashboard에서 접속 중인 사용자를 ban/kick 해도 **DB만 바뀌고 현재 살아있는 소켓 연결엔 무영향**:
- **ban**: 다음 join까지 계속 채팅/이동 가능(restriction 인메모리 캐시가 NONE으로 남음).
- **kick**: `SpaceMember` row는 삭제되지만 접속 중 소켓은 room에 남아 계속 동작.
참고: socket 서버엔 이미 인게임 채팅 명령용 `admin:kick`/`admin:mute` 이벤트 핸들러가 있으나(nickname 기반), 이는 **소켓 내부에서만** 동작하고 dashboard(HTTP) 경로와는 분리돼 있다.

## 내 설계안 (옵션 비교 후 택1)

### 채택: 옵션 B — socket 서버에 인증된 내부 HTTP 엔드포인트(webhook)
1. **socket 서버**: 기존 `httpServer`(socket.io가 부착된 동일 http 서버)에 `request` 핸들러를 추가해 `POST /internal/enforce` 처리. socket.io는 `/socket.io` path만 가로채므로 그 외 path는 우리가 처리.
   - 인증: 헤더 `x-internal-secret`를 `SOCKET_INTERNAL_SECRET` env와 **timing-safe 비교**(`crypto.timingSafeEqual`). 불일치/미설정 → 401/403.
   - body: `{ spaceId, userId, action: "ban"|"kick"|"mute"|"unmute"|"role", role? }`.
   - 처리(spaceId room에서 userId 소켓 enumerate):
     - `ban`/`kick`: 타겟 소켓에 `space:error`(code `BANNED`/`KICKED`) emit → room에 `member:kicked` emit → `socket.leave(spaceId)` + `socket.disconnect(true)`. `spacePlayersMap`에서 제거 + `player:left` emit(또는 disconnect 핸들러의 leaveSpace에 위임).
     - `mute`: `socket.data.restriction="MUTED"` + `member:muted` emit.
     - `unmute`: `socket.data.restriction="NONE"` + `member:unmuted` emit.
     - `role`: `socket.data.role` 갱신(인메모리 캐시 일관성).
   - 타겟 소켓이 없으면(오프라인) no-op 200.
2. **Next.js PATCH 핸들러**: DB 갱신 성공 후 `SOCKET_INTERNAL_URL`(예: `http://socket-internal:3001`)이 설정돼 있으면 `fetch(POST /internal/enforce, { x-internal-secret })` 호출. **짧은 timeout(예: AbortSignal 2s)**. 실패해도 DB는 이미 반영 → graceful degrade(재접속 시 join 게이트가 차단). env 미설정이면 호출 스킵(로컬/단일프로세스 dev는 무영향).

### 기각: 옵션 A(Redis pub-sub) — 단일 socket 인스턴스에 Redis 인프라+의존성 도입은 과함(멀티 인스턴스 fan-out 필요 시점에 정당). 옵션 C(socket가 DB 주기 폴링) — P2 "즉시" 위배 + 상시 부하.

## 협의 질문
1. **크로스프로세스 채널 선택**: 현재 인프라(단일 socket 인스턴스, Redis 없음, Vercel↔OCI 공용 인터넷)에서 옵션 B(내부 HTTP webhook)가 맞나? Redis로 가야 할 임계 신호가 있나?
2. **내부 엔드포인트 보안**: socket.io와 동일 httpServer/포트에 internal route를 올리면 OCI가 인터넷에 노출된 만큼 `/internal/enforce`도 public이 된다. `SOCKET_INTERNAL_SECRET` timing-safe 비교 + body 검증으로 충분한가, 아니면 별도 포트/localhost 바인딩/네트워크 ACL이 필요한가? (Vercel은 고정 egress IP가 없어 IP allowlist는 비현실적이라 공유 시크릿으로 기운다 — 맞나?)
3. **Vercel serverless의 fire-and-forget**: serverless 함수는 응답 반환 후 in-flight fetch가 중단될 수 있다. enforce 호출을 응답 전에 `await`(짧은 timeout)로 완료 보장해야 하나? enforce 실패 시 사용자에겐 어떻게(202로 "DB는 반영, 실시간 추방은 best-effort")?
4. **시크릿 운용**: `SOCKET_INTERNAL_SECRET`을 AUTH_SECRET과 **분리**(권장)할지 재사용할지. socket 서버는 이미 AUTH_SECRET 보유 — 재사용 시 키 분리 원칙 위배 vs 배포 단순화 트레이드오프.
4b. **인증 방향**: dashboard PATCH는 이미 `canActOn` 역할계층으로 인가됨. enforce 엔드포인트는 "이미 인가된 액션의 전달 채널"이라 시크릿만으로 충분한가, 아니면 enforce 내부에서도 재인가(DB 재조회)해야 하나?
5. **이벤트 계약**: 기존 `member:kicked`/`member:muted`/`member:unmuted`(types.ts) 재사용으로 충분한가? ban 전용 이벤트(`member:banned`)나 강제 추방용 클라이언트 신호(`space:error` code `BANNED`)를 추가해야 클라이언트가 깔끔히 처리하나? (클라이언트는 현재 `space:error`를 socketError로 표시하고, `member:kicked`는 콜백만 있음)
6. **멱등/경합**: 같은 사용자가 다중 탭(여러 소켓)일 때 room의 모든 매칭 소켓 처리 필요. ban 직후 reconnect 시도는 join 게이트가 막지만, enforce와 reconnect 사이 races는? guest 멤버(socket token은 session.user.id 기반, guest는 별도)는 이번 범위에서 제외해도 회귀 아닌가?
7. **스코프**: 이번 WI는 enforce 채널 + ban/kick 실시간 추방까지. mute/unmute/role 실시간 동기화도 같은 채널로 묶는 게 맞나, 아니면 ban/kick만 닫고 mute는 별도 WI? (mute는 현재 인게임 admin:mute로만 즉시 반영되고 dashboard mute는 재접속까지 지연 — 같은 결함군)
8. **내가 놓친 위험 1가지** (필수).
