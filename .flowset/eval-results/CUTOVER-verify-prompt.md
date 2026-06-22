# 적대 검증 — V1→V2 도메인 컷오버 실행 결과 (process 03)

당신은 독립 적대 검증자다. read-only. 아래 **실행 완료된 컷오버**가 올바른지, 깨진 곳/놓친 것/잔여 위험이 무엇인지 적대적으로 검증하라. "됐다"보다 **아직 깨질 수 있는 것**을 찾는 게 임무. 산문.

## 실행한 것 (사용자 지시 + 직전 너의 설계 협의 반영)
순서: **env 변경 → V2 재배포 → 도메인 이동**(네가 권고한 순서).
1. OCI Caddy: `space-socket.flow-coder.com`을 `v2-socket` 블록에 추가(같은 origin cert/websocket/3002 프록시). caddy 재시작(inode 함정 우회)으로 반영. 외부 핸드셰이크 `0{"sid":...}` 응답 확인.
2. OCI `.env` CORS_ORIGINS = `https://flowspace-v2.vercel.app,https://flowspace-v2-yh-devs-projects.vercel.app,https://space.flow-coder.com`. 소켓 컨테이너 재생성(rm+up), 로그에 3 origin 확인.
3. V2 Vercel env(production): `NEXT_PUBLIC_SOCKET_URL=https://space-socket.flow-coder.com`, `AUTH_URL=https://space.flow-coder.com`.
4. V2 **재배포**(`vercel redeploy <prod-url>`) → 새 production deployment alias=flowspace-v2.vercel.app.
5. 도메인 이동: Vercel REST API로 `space.flow-coder.com`을 V1(flowspace) DELETE → V2(flowspace-v2) POST. API 200, V2 프로젝트 domains=[space.flow-coder.com, flowspace-v2.vercel.app].

## 검증된 사실
- `space.flow-coder.com` HTTP 200, `<title>FlowSpace…</title>` = flowspace-v2.vercel.app와 동일 = **V2 서빙 확정**.
- Google OAuth(V2 클라 FlowSpace2): `https://space.flow-coder.com` JS origin + `/api/auth/callback/google` 리디렉션 등록됨(사용자 스크린샷 확인).
- `space-socket.flow-coder.com/socket.io/` 핸드셰이크 응답(Cloudflare Proxied 경유).
- AUTH_SECRET 불변(44자).
- V1(flowspace)은 도메인 제거됨(quarantine, 미삭제). Supabase V1(`dqmnlygfulhxhatyoiql`) 미삭제. V2 DB(`fqhcnudechuchaazwrzg`) 분리.

## 미확정/우려
- **재배포 env 반영**: `vercel redeploy`가 새 `NEXT_PUBLIC_SOCKET_URL`(빌드타임)을 실제 인라인했는지 미확인(socket-client는 space 라우트 lazy-load라 로그인 페이지 청크엔 없음, neither space-socket nor nip.io). redeploy가 빌드 캐시로 옛 env를 쓸 가능성?
- **전체 e2e 미실행**: space.flow-coder.com에서 Google 로그인 → 소켓 연결(space-socket) → 메타버스 진입은 사용자 자격증명 필요라 미검증.

## 묻는 것 (적대적)
A. `vercel redeploy`의 빌드타임 env 반영 동작 — 새 `NEXT_PUBLIC_*`을 보장 인라인하나, 아니면 캐시 위험? 확실히 하려면 무엇을(예: 강제 재빌드/소스 재배포)? 인라인 확인을 코드 없이 검증할 방법(예: 어느 청크/매니페스트)?
B. 컷오버 직후 깨질 수 있는 것 — 기존 로그인 세션(쿠키 도메인), CSRF/state, Cloudflare Proxied 소켓 WebSocket upgrade(웹 origin=space.flow-coder.com → socket=space-socket.flow-coder.com)에서 실패 가능 지점?
C. 내가 "검증 완료"로 선언하기 전 **반드시 통과시켜야 할 e2e 체크리스트**(사용자가 브라우저로 할 것)?
D. V1 quarantine 상태 점검 — 도메인만 제거하면 충분한가, V1이 아직 띄우는 트래픽/충돌(예: 같은 Google OAuth 클라 공유, webhook)?
E. 롤백 — 지금 시점에서 space.flow-coder.com을 V1으로 즉시 되돌리는 정확한 절차.
F. 놓친 위험 1가지.

간결하게.
