# 설계 협의(적대적) — V1(flow_metaverse) 폐기 + V2(FlowSpace) 도메인 컷오버

당신은 FlowSpace 인프라 컷오버의 **독립 적대 검토자**다. read-only. 아래 계획의 결함·누락·위험을 적대적으로 지적하라. "괜찮다"는 동의보다 **깨질 시나리오**를 찾는 게 임무다. 산문으로.

## 목표 (사용자 지시)
기존 V1 프로젝트(`flow_metaverse`)의 **DB·Vercel을 전부 폐기**하고, **도메인 `space.flow-coder.com`을 그대로 유지한 채 V2(FlowSpace)를 그 도메인에 올린다.** 현재 V1·V2가 섞여 있어 정리 필요.

## Ground truth (내가 실측)
- **V1**: Vercel 프로젝트 `flowspace`(prj_9YZUV...) + Supabase 프로젝트 ref **`dqmnlygfulhxhatyoiql`** + 도메인 **`space.flow-coder.com`**(현재 V1 서빙, HTTP 200, 마지막 배포 136일 전) + 구 소켓 도메인 `space-socket.flow-coder.com`. 로컬 `C:\Team-jane\flow_metaverse`.
- **V2**: Vercel 프로젝트 `flowspace-v2`(prj_W2Rn...) + Supabase ref **`fqhcnudechuchaazwrzg`** + `flowspace-v2.vercel.app` + OCI 소켓. 로컬 `C:\Team-jane\FlowSpace`. **방금 WI-001~016 승격된 라이브.**
- **DB 분리 확인**: V1/V2 Supabase 프로젝트 ref가 다름(username `postgres.{ref}`) → 같은 건 지역 pooler 호스트뿐, **다른 DB**. V1 DB 폐기해도 V2 데이터 무관.
- **V2 현재 env**: `AUTH_URL=https://flowspace-v2.vercel.app`, `NEXT_PUBLIC_SOCKET_URL=https://socket-v2.144.24.72.143.nip.io`(빌드타임 인라인), `AUTH_SECRET`(44자, 변경 안 함), 자체 Google OAuth 클라이언트(FlowSpace2).
- **Google OAuth(V2 클라이언트)**: 이미 `https://space.flow-coder.com` JS origin + `https://space.flow-coder.com/api/auth/callback/google` 리디렉션 등록 완료.
- **DNS(Cloudflare)**: `space.flow-coder.com` CNAME→vercel-dns(V1 타깃). `space-socket`/`space-livekit` A→144.24.72.143(OCI), Proxied. zone 소유 jerome87hyunil.
- **OCI**: Caddy(Cloudflare Full Strict + origin cert `*.flow-coder.com`)가 space-livekit/v2-socket(DNS無)/socket-v2.nip.io 프록시. docker-compose **v1**(recreate `KeyError:ContainerConfig` 버그 → rm+up 우회).
- 인증: NextAuth v5(JWT), 소켓 토큰 `/api/socket/token`(AUTH_SECRET 서명)→OCI 검증.

## 이미 실행(가역적)
1. OCI Caddy에 `space-socket.flow-coder.com`→:3002 라우트 추가(caddy 재시작, 핸드셰이크 응답 확인).
2. OCI `.env` CORS_ORIGINS에 `https://space.flow-coder.com` 추가(소켓 재생성, 로그 확인).

## 남은 계획 (비판해 달라)
1. **V2 Vercel env 변경**: `NEXT_PUBLIC_SOCKET_URL=https://space-socket.flow-coder.com`, `AUTH_URL=https://space.flow-coder.com`.
2. **웹 도메인 이동**: `space.flow-coder.com`을 Vercel `flowspace`(V1)에서 제거 → `flowspace-v2`(V2)에 추가.
3. **V2 재배포**: 빌드타임 `NEXT_PUBLIC_SOCKET_URL` 반영 + AUTH_URL 적용.
4. **검증**: space.flow-coder.com 로그인(Google OAuth)·소켓 연결·메타버스 진입.
5. **V1 폐기**: Vercel `flowspace` 프로젝트 삭제 + Supabase `dqmnlygfulhxhatyoiql` 삭제.

## 묻는 것 (적대적으로)
A. **시퀀싱/무중단**: env변경·도메인이동·재배포 순서를 어떻게 해야 로그인·소켓 끊김 창을 최소화하나? AUTH_URL(런타임)을 도메인이동 前 바꾸면 flowspace-v2.vercel.app 로그인이 깨지나? 도메인이동 後 재배포까지의 창에서 space.flow-coder.com이 옛 env(AUTH_URL=vercel.app)로 서빙되면 무슨 일이?
B. **NextAuth v5 세션/쿠키**: AUTH_URL 변경 시 기존 세션 무효화되나(AUTH_SECRET 불변)? trustHost 필요? 쿠키 도메인(flowspace-v2.vercel.app↔space.flow-coder.com)·CSRF·`__Secure-`/`__Host-` 프리픽스 함정? 도메인 바뀌면 사용자 재로그인 불가피한가?
C. **Vercel 도메인 이동**: 같은 팀 내 프로젝트 간 도메인 재배정 시 함정? Cloudflare CNAME이 V1 vercel-dns 타깃을 가리키는데 V2로 옮기면 그 CNAME을 바꿔야 하나(아니면 Vercel이 도메인 단위로 라우팅)? Cloudflare Proxied(orange) 상태가 Vercel 도메인 검증/SSL에 문제되나?
D. **V1 폐기 안전성**: DB는 분리 확인됐다. 그래도 삭제 前 백업해야 하나? V1↔V2가 공유할 수 있는 것(Supabase Storage 버킷, OAuth 클라이언트, 동일 env 키, 외부 webhook, cron)은? Vercel 프로젝트 삭제와 Supabase 프로젝트 삭제의 비가역성·복구 가능성? 136일 미사용이 폐기 안전 근거로 충분한가?
E. **롤백**: 각 단계(env/도메인/재배포/삭제) 실패 시 롤백 절차. 특히 도메인 이동 실패 시 V1으로 즉시 복귀 가능?
F. **내가 놓친 위험 1가지.**

각 항목 간결하게. 합의/반대 명확히.
