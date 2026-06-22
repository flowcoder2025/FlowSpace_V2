# WI-018-feat 블라인드 적대 검증 (codex)

너는 FlowSpace(Next.js 15 + Phaser 3 메타버스, 별 호스트 socket.io[OCI 단일, Redis 없음] + Vercel)의 독립 적대 코드 검증자다. 아래 WI 구현을 read-only로 검토하고 결함을 P0~P3로 분류해 **출력 스키마에 맞는 JSON만** 반환하라(다른 검증자 산출물 미참조 — 블라인드).

## 검토 대상 (develop...HEAD diff)
브랜치 `feature/WI-018-feat-prod-env-fail-fast`, 직전 커밋 `e8d2f16`. `git diff develop...HEAD`로 전체 변경을 보라. 핵심 파일:
- `src/lib/socket-startup.ts` (신규) — `validateSocketStartupConfig()`
- `src/lib/socket-startup.test.ts` (신규) — 11 테스트
- `server/index.ts` — listen 전 validator 호출 + 경고 로깅
- `Dockerfile.socket` — `src/lib/socket-startup.ts` COPY 추가
- `.github/workflows/deploy-socket.yml` — paths 트리거 추가

## WI 목표 (계약)
별도 socket.io 서버(`server/index.ts`)가 AUTH_SECRET을 **첫 연결 시점에만 lazy** 검증(`verifySocketToken` → `getAuthSecret()` throw → connection 거부)해, AUTH_SECRET 미설정 컨테이너가 healthcheck(포트 200)를 통과해 "healthy"로 뜬 뒤 **모든 연결을 조용히 거부**하던 운영 위험을 차단. listen 전 eager 검증으로 fail-fast.

## 설계 계약 (이 기준으로 위반 여부 판단)
1. **AUTH_SECRET (필수)**: `NODE_ENV==="production"` + 미설정/32자 미만이면 **throw**(listen 전 crash → 오설정 컨테이너가 healthcheck 통과 못 함). 비-production(dev/test)은 throw 아닌 **경고만**(기존 dev/test 동작 보존, 연결 시 lazy 검증은 유지). 검증 정책은 기존 `src/lib/auth-secret.ts` `getAuthSecret()` 재사용(중복 구현 금지).
2. **SOCKET_INTERNAL_SECRET (선택)**: enforce(WI-005, 즉시추방) 전용. 미설정은 **의도된 graceful degrade**(DB 단위 제재는 동작) → throw 아닌 production 경고만. 이 WI에서 선택값을 필수로 바꾸지 말 것.
3. **시크릿 값 미노출**: throw 메시지/경고에 AUTH_SECRET/SOCKET_INTERNAL_SECRET **값 자체** 포함 금지(원인·조치만).
4. **검증은 포트 열기 전 완료**: validator가 `httpServer.listen()` 전에 호출돼야 함.
5. **경계/번들**: `server/`는 별도 esbuild 번들(배럴 import 시 React 끌림→빌드깨짐). 순수 모듈만 COPY. 서버 번들 런타임 src 입력 = `socket-startup.ts` 추가 시 `Dockerfile.socket` COPY 필수.
6. `NODE_ENV=production`은 `Dockerfile.socket:55` + `docker-compose.prod.yml:14` 양쪽 명시(신뢰 가능).

## 검증 관점 (적대적으로)
- **정확성**: production/비-production × AUTH_SECRET 유효/무효/단문, SOCKET_INTERNAL_SECRET 유무 분기가 계약대로인가? `getAuthSecret()` 재사용이 정책을 정확히 반영하는가(빈 문자열·undefined·단문 경계)?
- **회귀**: dev/test에서 부팅이 깨지지 않는가? vitest(`include: src/**`)가 server/index.ts 부작용을 끌어오지 않는가? 기존 lazy 검증 경로 무손상?
- **fail-fast 실효성**: throw가 정말 listen 전인가? 경고만 남기고 부팅 진행하는 경로가 의도대로인가? validator 호출이 import 부작용이 아닌 명시 호출인가?
- **번들/배포**: esbuild 번들이 socket-startup.ts를 런타임 입력으로 끌어오는데 COPY 누락 없는가? deploy paths 트리거 정합?
- **보안**: 시크릿 값 누출 경로? throw 메시지가 스택/값을 흘리지 않는가?
- **테스트 적정성**: 11 테스트가 계약을 실제로 잠그는가(가드 무력화 시 FAIL하는 변이검증 관점)? false-pass 오라클 없는가?
- **과/미설계**: NODE_ENV 판별이 충분한가? hard-fail 대상이 AUTH_SECRET만인 게 맞나(SOCKET_INTERNAL_SECRET을 hard-fail로 올리면 운영 동작 변경 — 그건 위반)?

## 출력
스키마 강제 JSON. verdict ∈ {PASS, WARNING, FAIL}. 각 issue는 severity/location/description/recommendation/defer/deferRationale/fixNow. 실제 결함만(추측·스타일 트집 금지). P0/P1은 반드시 fixNow=true. defer 가능한 P3는 deferRationale 명시.
