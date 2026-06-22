# 블라인드 적대 검증 — WI-020-fix: 미들웨어 public 정적에셋 회귀 해소

당신은 독립 블라인드 검증자(codex). read-only. 아래 구현을 **적대적으로** 검증하고 `--output-schema`에 맞춰 JSON만 출력하라. evaluator(Claude)의 산출물은 참조 금지(상호 블라인드).

## WI 목표
미들웨어가 미인증 시 public 정적자산 `/Logo.png`을 `/login`으로 307 리다이렉트해 로그인 페이지 로고가 깨지던 회귀(WI-001 strict화 부작용) 해소. **deny-by-default 인증 경계는 보존**하면서 public 자산만 통과.

## 변경 (git diff develop..HEAD)
- `src/lib/route-access.ts` (신규, 순수): `isPublicRequest(pathname)` + `PUBLIC_FILES = Set(["/Logo.png"])`. 확장자 전체 통과 대신 **명시 allowlist**(직전 codex 설계 협의 권고 — `/api/spaces/foo.png` 등 확장자 우회 표면 회피).
- `src/middleware.ts`: 인라인 분류 로직을 `isPublicRequest()` 호출로 대체(동작 동일 + Logo.png 통과 추가). matcher 무변경.
- `src/lib/route-access.test.ts` (신규): 회귀 테스트 9 — /Logo.png 통과, /logo.png·/Logo.png/secret 비공개, 확장자 우회(/space/foo.png·/api/spaces/foo.png·/api/assets/foo.png) 여전히 비공개, 보호 라우트·공개 prefix exact 경계 보존.

## 검증 관점 (적대적)
1. **인증 우회 재개방 여부**: allowlist 방식이 보호 라우트/API를 노출하나? `/api/spaces/foo.png` 등 확장자 경로가 미들웨어를 우회하나(테스트가 이를 잠그나)? `/Logo.png/secret`·대소문자·인코딩 우회?
2. **회귀 실제 해소**: 미인증 `/Logo.png` 통과가 보장되나? Next Image 최적화 경로 정상화 논리 타당?
3. **deny-by-default 보존**: 보호 라우트·`/api/*`·공개 prefix exact 매칭(`/login-anything` 비공개)이 유지되나?
4. **테스트 충분성**: codex 설계 협의가 요구한 4종(미인증 /Logo.png 200 / 보호 페이지 확장자 리다이렉트 / API 확장자 차단 / 일반 보호 차단) 커버하나? 변이검증 가능?
5. **순수 함수 추출**: route-access가 NextAuth/Node 무의존이라 미들웨어 런타임 영향 없나?

## 출력
`review.schema.json`(oneOf-free 변형) 준수. verdict=PASS|WARNING|FAIL. P0/P1·fixNow는 진짜 차단 결함만. scores/weightedTotal=null.
