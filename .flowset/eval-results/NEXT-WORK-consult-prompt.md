# 설계 협의 — 다음 작업 우선순위 + 스코프 (FlowSpace, develop 브랜치)

당신은 FlowSpace(Next.js 15 + Phaser 3 메타버스)의 독립 설계 파트너입니다. 메인 구현자는 Claude이고, 당신은 설계 협의(consult)와 검증에 등장합니다. **이 라운드는 설계 협의 — 코드를 바꾸지 말고, 우선순위 결정·스코프·위험만 판단하세요.**

## 상황
READY 큐가 비었습니다. develop은 WI-001~022까지 머지 완료(보안/안정성/경계/성능 다수). 이제 BACKLOG 3건 중 무엇을 다음 WI로 할지, 그리고 그 스코프를 정해야 합니다. 라이브 반영(main 승격)은 별도 사용자 승인 게이트이며, 지금은 develop 정상 플로우(분기→기계게이트→듀얼 블라인드 검증→.pass→develop PR 머지) 작업입니다.

## BACKLOG 후보 (실측 코드 첨부)

### 후보 A — WI-023: 500 에러 details 정보 노출 + offset 상한 (원래 "선택/저우선"으로 등록됨)
원래 등록 시 전제: "`assets/route.ts:124`의 500 폴백 `details:error.message`를 spaces/messages 라우트와 정렬(=그것들은 안전하다 가정)".

**그러나 실측 결과 이 전제가 틀렸습니다.** 전수 grep:
```
details: error instanceof Error ? error.message : undefined
→ 26개 API 라우트 파일, 37곳에서 발견
```
대상에 `spaces/route.ts`(2), `spaces/[id]/route.ts`(3), `spaces/[id]/messages/route.ts`(1), `spaces/[id]/members/route.ts`(3), `spaces/[id]/admin/*`(stats/announce/logs/analytics/members/messages/media 등), `spaces/join/[inviteCode]`(2), `spaces/[id]/map/*`, `assets/*`(generate/batch/[id]/목록), `workflows`, `guest`, `auth/register` 전부 포함. 즉 거의 전 API 표면이 500 시 내부 에러 메시지(Prisma 에러는 DB 스키마/컬럼/제약명, 파일 경로 등 포함 가능)를 클라이언트에 그대로 반환합니다. **CWE-209(정보 노출).**
예외(details 미노출): `livekit/webhook`, `livekit/token`, `socket/token`.

현재 assets 목록 500 핸들러:
```ts
} catch (error) {
  return NextResponse.json(
    { error: "Failed to fetch assets",
      details: error instanceof Error ? error.message : undefined },
    { status: 500 }
  );
}
```
추가 곁가지: `parsePageNumber`는 page 상한이 없음(큰 page → 큰 offset skip). 단 현재 소비처는 page 파라미터를 보내지 않아 실표면 0.

### 후보 B — WI-017: 소켓 토큰 획득 실패 폴백 (UX 방어, 승격 차단 아님)
`src/features/space/socket/internal/socket-client.ts`:
```ts
const res = await fetch("/api/socket/token");
if (!res.ok) throw new Error("Failed to get socket token");
const { token } = await res.json();
```
`/api/socket/token`이 !ok면 즉시 throw. retry/백오프/오프라인 폴백 없음. 토큰 엔드포인트 일시 장애(네트워크 순단, 콜드스타트 타임아웃) 시 메타버스 진입이 전면 실패. 단 AUTH_SECRET 영구 오설정 같은 비-일시 장애는 retry로 안 풀림(throw가 맞을 수 있음). socket.io 자체 reconnection은 토큰 획득 **이후** 단계에만 적용됨(토큰 fetch는 그 앞).

### 후보 C — WI-018: prod env fail-fast (운영 안전망, 승격 차단 아님)
`src/features/space/enforce/internal/dispatch.ts`: `SOCKET_INTERNAL_URL/SECRET` 미설정 시 production이면 console.error 후 `{enforced:false}`로 graceful degrade(throw 안 함). `server/handlers/enforce.ts`: 시크릿 없으면 요청당 503. 둘 다 "조용히 degrade" — startup에 검증해 fail-fast 하자는 제안. 단 현재 graceful degrade는 의도된 동작(실시간 제재는 선택 기능, 미설정 시 DB만 반영). fail-fast로 바꾸면 미설정 환경에서 소켓 서버/배포가 기동 거부 → 양날의 검.

## 결정 요청
1. **다음 WI 1건**: A / B / C 중 무엇을 먼저? 근거(보안 영향 × 실표면 × 위험 × 무회귀성).
2. **선택한 WI의 스코프**:
   - A를 택하면: 26파일 37곳 일괄(중앙 에러 헬퍼 도입)이 옳은가, assets만 좁게가 옳은가? 중앙 헬퍼 설계(server-side 로깅 유지 + client에 generic 메시지, `{error, code?}` app.md 불변식 #4 준수, dev에서는 details 유지할지)? Prisma 에러/`NextResponse.json` 기존 계약(테스트가 못박은 응답 키)과의 회귀 위험은? offset 상한도 같이? 별도?
   - B를 택하면: 토큰 fetch retry 정책(횟수/백오프), 비-일시 장애 구분, 기존 reconnection 상수 재사용 여부, throw 계약을 깨는지(호출부 영향).
   - C를 택하면: fail-fast 위치(어디서 검증), prod-only 게이팅, graceful degrade 의도와의 충돌 해소.
3. **내가 놓치고 있는 위험 1가지** (반드시 1개 이상).

간결하고 단정적으로. "검토 필요"가 아니라 결정과 근거로.
