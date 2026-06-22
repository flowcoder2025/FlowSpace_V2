# 블라인드 적대 검증 — WI-022-fix

너는 독립 검증자다. FlowSpace(Next.js 15 + Phaser)의 WI-022 구현을 read-only로 적대적으로 검증하고 **review.schema.json(oneOf-free 변형)** 형식 JSON으로만 답하라(`-o` 출력이 권위). `scores`/`weightedTotal`은 `null`로 둔다. 다른 검증자(evaluator) 산출물을 절대 참조하지 마라.

## 변경 범위 (base=develop, head=HEAD)
`git diff develop...HEAD` 로 확인. 코드 변경:
- `src/app/api/assets/route.ts` (GET 목록 핸들러 — enum 검증 + page/limit 정규화)
- `src/lib/pagination.ts` (parsePageLimit에 optional defaultLimit 추가 + 신규 parsePageNumber)
- `src/lib/pagination.test.ts` (헬퍼 테스트 추가)
- `src/app/api/assets/route.test.ts` (라우트 입력 검증 테스트 추가)

## WI-022 목표 (입력 검증 강건화 — robustness/위생)
`GET /api/assets`(목록)의 선재 입력 검증 부채 해소. WI-021 듀얼검증에서 발굴, codex consult가 '별 WI 분리' 권고. 누출이 아니라 입력 강건화다(WI-021에서 응답 누출은 이미 정형화 완료).

**변경 전 결함**:
1. `type`/`status`를 `type.toUpperCase()`로 enum 무검증 직접 주입 → 잘못된 값은 Prisma enum 불일치로 throw → 500(불명확). 오타(`status=compelted`)도 500.
2. `limit = parseInt(... || "20")` 무상한 → `limit=100000`이면 `take:100000`(전량 로드 스케일 위험). NaN 미정규화.
3. `page = parseInt(... || "1")` 무가드 → `page=0/-5` → `skip:(page-1)*limit` 음수 → Prisma throw → 500. `page=abc` → NaN skip.

**설계(codex consult r1 반영)**:
- enum: `type`/`status`를 `trim().toUpperCase()` 후 `Object.values(AssetType)`/`Object.values(AssetStatus)`(Prisma 런타임 enum, 하드코딩 배열 회피) allowlist로 검증. 불일치 → 400 `{error:"Invalid asset filter", code:"INVALID_FILTER"}`(WI-009 패턴 정합). 조용히 무시 안 함(오타→전체목록 응답이 더 위험). null/빈값 → 필터 미적용(현행 유지).
- limit: `parsePageLimit(raw, 20)` — **optional defaultLimit param 추가**해 assets default 20 보존(회귀 회피, codex가 B' 50통일 대신 B 권고) + MAX 100 cap.
- page: 신규 `parsePageNumber(raw)` — NaN/0/음수 → 1 클램프(음수 skip→500 방지). offset이라 상한 없음.
- 검증 순서: auth(401) → enum 검증(400) → page/limit 정규화 → 쿼리(enum 400을 쿼리 전).

## 실측 소비처 (목록 `GET /api/assets`)
1. `src/features/space/game/internal/asset-loader.ts:124` → `fetch("/api/assets?status=completed&limit=100")` — **status 소문자 `completed`**. ⇒ enum 검증은 `.toUpperCase()` 후라 소문자도 통과(무회귀). limit=100이라 cap 무관.
2. `src/components/space/editor/asset-palette.tsx:38` → `fetch("/api/assets?status=COMPLETED&limit=100")` — 대문자. 둘 다 page/type 미사용.

## 검증 관점 (적대적으로)
1. **무회귀**: 두 라이브 소비처(소문자 `completed`+limit=100 / 대문자 `COMPLETED`+limit=100)가 깨지지 않나? `.toUpperCase()` 후 검증이라 소문자 통과 맞나? limit=100이 cap(100)에 정확히 통과(절상 아님)하나? default 20 보존이 limit 생략 외부 호출에 맞나?
2. **검증 엄밀성**: enum allowlist에 우회 경로가 있나(대소문자/공백/유니코드 정규화 빈틈)? `Object.values(enum)` 동적 allowlist가 의도치 않은 값을 통과시키나? `parsePageNumber`/`parsePageLimit`이 음수 skip·과대 take를 실제로 막나? page 상한 부재로 큰 offset 위험이 남나(이번 스코프 밖이면 defer 타당한가)?
3. **검증 순서/일관성**: enum 400이 쿼리 전에 나오나? type·status 둘 중 하나만 잘못돼도 400인가? `where`에 주입되는 값이 검증된 정규화 값인가(raw 아님)? count와 findMany의 where 정합 유지되나?
4. **헬퍼 계약**: `parsePageLimit` optional param 추가가 기존 무인자 호출부(spaces 라우트 cursor)를 깨지 않나(default 50 유지)? 기존 테스트 계약(`"12.9"→12` 소수절삭) 보존되나? `parsePageNumber`가 자매 헬퍼와 일관(parseInt 시맨틱)인가?
5. **테스트 품질**: 입력 검증 테스트가 실결함을 잡나(변이검증 가능)? 400 경로에서 prisma 미접근 단언이 있나? 소문자 무회귀·trim·cap·page 클램프를 커버하나? false-pass 없나?
6. **경계/스코프**: 변경이 입력 검증에 국한되나(응답 DTO·누출은 WI-021 완료라 무변경)? `@prisma/client` 런타임 enum import가 라우트(`src/app/api/`, prisma 직접 허용)에 적절한가?

## 출력
- `verdict`: PASS | WARNING | FAIL
- `issues[]`: severity(P0~P3)/location/description/recommendation/defer/deferRationale/fixNow
- 실결함이면 `fixNow:true`. P3 위생/심층방어·이번 스코프 밖 선재부채는 defer 가능. **무회귀를 깨거나 검증 우회를 허용하는 경로가 있으면 반드시 적출하라.**
