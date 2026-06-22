# FlowSpace — 다음 WI 우선순위 + 설계 협의 (consult, 산문)

너는 FlowSpace(Next.js 15 + Phaser 3 메타버스, 별 호스트 socket.io[OCI 단일, Redis 없음] + Vercel)의 시니어 설계 협의자다. READY 큐가 비었고 BACKLOG 4건 중 무엇을 다음 1개 WI로 작업할지와 그 설계를 협의한다. **1회 반복 = 1개 WI** 원칙(여러 개 묶지 않음). 산문으로 답하라.

## 프로젝트 검증 흐름(맥락)
- 모든 WI: 분기 → 기계게이트(tsc/lint/vitest/build) → 듀얼 블라인드 검증(codex CLI + evaluator-agent) → `.pass` → develop PR 머지.
- 보안/경계/prod 영향 WI는 구현 전 설계 consult(지금 이것). 결함은 P0~P3 분류.
- develop은 통합 브랜치(라이브 미반영). main 승격은 별도 사용자 승인 게이트.

## BACKLOG 4건 (실측 기반 — 추측 아님)

### WI-017 (improve) — 소켓 토큰 획득 실패 폴백
`src/features/space/socket/internal/socket-client.ts` getSocketClient():
```ts
const res = await fetch("/api/socket/token");
if (!res.ok) throw new Error("Failed to get socket token");   // L41 — retry/fallback 전무
const { token } = await res.json();
socket = io(url, { auth: { token }, reconnection: true, reconnectionAttempts: ... });
```
- `/api/socket/token`이 !ok(401 미인증·500 AUTH_SECRET 미설정 등)면 즉시 throw → 호출부(use-socket 추정)로 전파, 메타버스 진입 전면 실패. socket.io의 reconnection은 일단 io() 생성 후에만 동작 — 토큰 획득 자체 실패는 그 전 단계라 재시도 없음.
- 표면: 클라이언트 UX. AUTH_SECRET 오설정/세션 만료 시 사용자가 빈 화면/에러만 봄(graceful 안내·재시도 없음).

### WI-018 (feat) — prod env fail-fast (소켓 서버 startup 검증)
`server/index.ts` 부팅 경로:
```ts
const PORT = parseInt(process.env.SOCKET_PORT || "3001", 10);
const httpServer = createServer(...);  // listen만, env 검증 없음
io.use(async (socket, next) => {  // 첫 연결 때 lazy 검증
  const user = await verifySocketToken(token);  // → getAuthSecret() throw 시 connection 거부
});
httpServer.listen(PORT, ...);
```
- `server/middleware/auth.ts` verifySocketToken → `src/lib/auth-secret.ts` getAuthSecret()는 AUTH_SECRET 미설정/32자 미만이면 throw(fail-closed). **그러나 이 검증은 첫 연결 시점 lazy** — AUTH_SECRET 누락 컨테이너는 "healthy"로 부팅되고 헬스체크(포트 200) 통과 후 **모든 연결을 조용히 거부**. 운영자는 "왜 아무도 못 들어오지"를 로그 추적해야 함.
- `server/handlers/enforce.ts:155` SOCKET_INTERNAL_SECRET도 per-request lazy("미설정 — enforce 비활성"). enforce는 의도적 graceful degrade(WI-005, 미설정=즉시추방만 미작동, DB 제재는 동작).
- 표면: 운영 안전. AUTH_SECRET은 이 프로젝트에서 반복적 "최대위험"(승격 시마다 probe). startup eager 검증으로 fail-fast(부팅 즉시 crash + 명확한 로그)하면 오설정 컨테이너가 "healthy"로 떠 트래픽 받는 것을 차단.

### WI-025 (perf) — parsePageNumber 큰 offset 상한
`src/lib/pagination.ts` parsePageNumber 주석 "상한 없음". 큰 page(예 1e9) → 큰 skip → 스케일 비효율. **소비처 page 파라미터 미사용(실표면 0)**. MAX_PAGE_NUMBER 정책 정한 뒤 처리 — 저우선.

### WI-026 (fix) — 저장 metadata public/internal 분리
`src/app/api/assets/generate/route.ts`·batch가 성공 경로에서 `metadata: JSON.parse(JSON.stringify(GeneratedAssetMetadata 전체))`를 DB 저장(prompt·workflow·comfyuiJobId 포함). **현재 응답은 `PUBLIC_METADATA_KEYS` allowlist(public-asset.ts)가 차단 → 현 누출 0.** 다만 향후 metadata에 민감 필드 추가 시 DB 저장면이 계속 확대(allowlist 드리프트 시 재노출). 저장 시점에 public/internal 분리 → 저장면 자체 축소. 저우선(심층방어).

## 협의 요청
1. **우선순위**: 다음 1개 WI로 무엇을 택할지 + 근거(가치·위험·실표면 기준). WI-017/018은 동일 실패모드(AUTH_SECRET 오설정→진입 장애)의 클라/서버 양면인데 묶지 말고 어느 쪽 먼저인지.
2. **선택 WI의 설계 권고**: 핵심 변경점, 경계(모듈/캡슐화), 회귀 위험, 테스트 전략. 특히
   - WI-018이라면: startup에서 AUTH_SECRET eager 검증(crash) vs SOCKET_INTERNAL_SECRET(graceful degrade라 warn만?) 구분, healthcheck와의 상호작용, 어떤 env를 hard-fail vs warn으로.
   - WI-017이라면: 토큰 획득 retry(지수백오프?) vs 명확한 에러 전파(UI 안내), socket.io reconnection과 중복 안 되게, 어디까지가 과설계인지.
3. **내가 놓칠 위험 1가지**.
