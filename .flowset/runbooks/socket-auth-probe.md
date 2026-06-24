# Runbook — Vercel↔OCI 소켓 AUTH_SECRET 정합 synthetic probe (WI-028)

## 무엇을 검증하나
별 OCI socket.io 서버는 클라가 `GET /api/socket/token`(Vercel)에서 발급받은 JWT로 핸드셰이크한다.
- 발급(서명): `src/app/api/socket/token/route.ts` — `auth()` 세션 → `getAuthSecret()`(=`AUTH_SECRET`)로 HS256 jose `SignJWT`(payload `{userId, name}`, exp 1h).
- 검증: OCI 소켓 서버 미들웨어(`server/middleware/auth.ts`)가 **동일 `AUTH_SECRET`**으로 검증.

**WI-018 eager 검증의 사각**: 부팅 검증은 AUTH_SECRET "존재·길이 충분"만 본다 — **Vercel이 서명하는 키 ↔ OCI가 검증하는 키가 서로 다른 값**이면 컨테이너는 healthy로 뜨고(healthcheck 통과) **모든 토큰 검증이 조용히 실패**한다(silent degrade). 이 probe는 그 불일치를 배포 후 능동 탐지한다.

## 왜 코드(단위 테스트/로컬 스크립트)로 안 만드나 — WI-028 DROP 근거 (codex 협의)
불일치 탐지의 본질은 **교차 환경 검증**이다. 로컬 `AUTH_SECRET`으로 토큰을 서명해 OCI에 붙는 스크립트는 "**내 로컬 secret ↔ OCI secret**"만 보장할 뿐, 정작 사고 원인인 "**Vercel이 실제로 배포한 secret ↔ OCI secret**" 불일치는 못 잡는다(로컬 secret ≠ Vercel 배포 secret일 수 있음). Vercel의 실제 서명 키를 시험하는 유일한 방법은 **Vercel `/api/socket/token`이 발급한 토큰**(Vercel 배포 secret으로 서명됨)을 받아 OCI에 검증시키는 것 — 이는 Vercel 세션 인증이 필요한 수동 운영 절차다. 따라서 거짓 안전망이 되는 로컬 probe는 만들지 않고, 아래 수동 절차를 정식 deliverable로 둔다. **정기 자동 실행(CI/cron)이 필요해지면 별도 WI로 승격**한다.

## 수동 probe 절차 (배포 후 / AUTH_SECRET 회전·Vercel env 변경·OCI 재배포 시)
1. **prod 로그인**: 브라우저로 `https://space.flow-coder.com` 로그인 → 세션 쿠키 확보(DevTools → Application → Cookies, NextAuth 세션 쿠키).
2. **Vercel이 서명한 토큰 발급**(Vercel 실제 secret 사용):
   ```bash
   curl -s -H "Cookie: <세션 쿠키 전체>" https://space.flow-coder.com/api/socket/token
   # → {"token":"<JWT>"}  (401이면 쿠키 만료 — 1번 재시도)
   ```
3. **OCI 소켓 서버에 그 토큰으로 핸드셰이크** (라이브 도메인 `space-socket.flow-coder.com`):
   ```bash
   # 임시 Node 스니펫(레포 socket.io-client 사용). TOKEN=2번 결과.
   node -e '
     const { io } = require("socket.io-client");
     const s = io("https://space-socket.flow-coder.com", { auth: { token: process.env.TOKEN }, transports:["websocket"], timeout: 8000 });
     s.on("connect", () => { console.log("PROBE_OK connect", s.id); s.close(); process.exit(0); });
     s.on("connect_error", (e) => { console.error("PROBE_FAIL", e.message); process.exit(1); });
     setTimeout(() => { console.error("PROBE_TIMEOUT"); process.exit(2); }, 9000);
   '
   ```
4. **판정**:
   - `PROBE_OK connect` → Vercel 서명 ↔ OCI 검증 **정합**(키 일치). 정상.
   - `PROBE_FAIL`(인증 오류) → **Vercel↔OCI AUTH_SECRET 불일치 강력 의심** → 양쪽 env의 `AUTH_SECRET` sha256 대조(Vercel `vercel env pull` vs OCI `.env`)·일치시킨 뒤 재배포.
   - `PROBE_TIMEOUT`/네트워크 오류 → 도메인/방화벽/컨테이너 상태 점검(AUTH 무관).

## 참고
- 시크릿 sha256 대조 선례: 메모리 `moderation-broken-rootcause-pending`(Session 2 — Vercel↔OCI 시크릿 sha256 일치 실측), `v1-v2-domain-cutover`.
- OCI 배포·도메인 함정: 메모리 `promotion-2026-06-22`(자동배포 키·docker-compose v1·소켓 도메인).
- 이 절차는 라이브 승격 직후 스모크의 일부로 수행 권장(기존 "socket auth probe connect" 스모크의 명문화).
