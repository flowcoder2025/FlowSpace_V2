# WI-022 설계 협의 (consult, r1)

당신은 시니어 백엔드 리뷰어다. 아래 변경의 **설계**를 협의한다(코드 작성 아님). 산문으로 답하라. 마지막에 **"내가 놓칠 위험 1가지"**를 반드시 포함하라.

## 배경
FlowSpace(Next.js 15 + Prisma). `GET /api/assets`(에셋 목록)의 **입력 검증 부채**를 강건화하는 WI-022다. 이 라우트의 응답 정형화(lean DTO)는 직전 WI-021에서 완료됐고, 그 듀얼검증에서 발굴된 선재 입력검증 부채를 codex consult 권고대로 별 WI로 분리한 것이다.

## 현재 코드 (`src/app/api/assets/route.ts` GET)
```ts
const type = searchParams.get("type");
const status = searchParams.get("status");
const shared = searchParams.get("shared");
const page = parseInt(searchParams.get("page") || "1", 10);
const limit = parseInt(searchParams.get("limit") || "20", 10);

const where: Record<string, unknown> = {};
if (shared === "true") { where.isShared = true; }
else { where.userId = session.user.id; }
if (type) { where.type = type.toUpperCase(); }      // ← enum 무검증 주입
if (status) { where.status = status.toUpperCase(); } // ← enum 무검증 주입

const [assets, total] = await Promise.all([
  prisma.generatedAsset.findMany({
    where, orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,   // ← page NaN/0/음수 → 음수 skip → Prisma throw → 500
    take: limit,                // ← limit 무상한/NaN
    select: { id,type,name,status,filePath,thumbnailPath,createdAt,updatedAt },
  }),
  prisma.generatedAsset.count({ where }),
]);
return NextResponse.json({ assets: assets.map(toPublicAssetListItem),
  pagination: { page, limit, total, totalPages: Math.ceil(total/limit) } });
```

## 확정 사실 (실측)
1. **페이지네이션은 offset 방식**(`skip`/`take` + `pagination:{page,limit,total,totalPages}`). spaces 라우트의 cursor 방식과 다름. 응답 계약 `pagination` 객체를 소비처가 사용할 수 있어 cursor 전환은 범위 밖(계약 깨짐).
2. **소비처 2곳(소스 실측)**:
   - `asset-loader.ts:124` → `fetch("/api/assets?status=completed&limit=100")` — **status 소문자 `completed`**
   - `asset-palette.tsx:38` → `fetch("/api/assets?status=COMPLETED&limit=100")` — status 대문자
   - **둘 다 `limit=100`**, page/type 미사용. ⇒ enum 검증은 반드시 `.toUpperCase()` **후** 수행해야 소문자 `completed`가 무회귀로 통과한다. 둘 다 limit=100이라 MAX cap(100) 영향 없음.
3. **enum 정의**: `AssetType {CHARACTER,TILESET,OBJECT,MAP}`, `AssetStatus {PENDING,PROCESSING,COMPLETED,FAILED}`. `@prisma/client`가 이를 런타임 객체로 export 확인(`Object.values(AssetType)` 작동).
4. **공용 헬퍼** `src/lib/pagination.ts`: `parsePageLimit(raw)` 존재(`DEFAULT_PAGE_LIMIT=50`, `MAX_PAGE_LIMIT=100`; null/비정수/0이하→50, 초과→100 cap). 단 **하드코딩 default 50** — assets는 현재 default 20.
5. **WI-009 선례 패턴**: 잘못된 filter는 `{ error, code: "INVALID_FILTER" }` + 400. app.md 불변식 #4 = 에러 형식 `{error, code?}`.

## 제안 설계
**A) enum 검증**: `type`/`status`를 `.toUpperCase()` 한 값을 `Object.values(AssetType)`/`Object.values(AssetStatus)` allowlist로 검증(하드코딩 배열 회피, enum 추가 시 자동 동기화). 불일치 시 `{error:"Invalid asset filter", code:"INVALID_FILTER"}` + 400(WI-009 정합). 검증 통과 값을 `where.type`/`where.status`에 주입. 빈 `type`/`status`(null) → 필터 미적용(현행 유지).

**B) limit 강건화**: `parsePageLimit`에 **optional `defaultLimit` 파라미터** 추가(`parsePageLimit(raw, defaultLimit = DEFAULT_PAGE_LIMIT)`). assets는 `parsePageLimit(raw, 20)` 호출 → **default 20 보존**(limit 생략 호출의 무회귀) + MAX 100 cap(실제 결함 해소). spaces는 인자 없이 호출 → 50 유지(무영향).
   - 대안 B': 그냥 `parsePageLimit(raw)` 사용 → default 20→50 변경 수용. 두 소비처는 limit=100이라 무관하나 limit 생략 외부 호출의 페이지 크기 변동.

**C) page 강건화**: 신규 `parsePageNumber(raw)`를 pagination.ts에 추가 — NaN/0/음수 → 1로 클램프(offset이라 상한 없음). 음수 skip(→500) 방지. (현 pagination.ts 독스트링은 "cursor 기반"이라 offset page 헬퍼 추가가 모듈 스코프를 약간 넓힘.)

**D) 검증/응답 순서**: auth(401) → enum 검증(400) → limit/page 정규화 → 쿼리. enum 400을 쿼리 전에.

## 협의 질문
1. **B vs B'**: default 20 보존(B, optional param)이 옳은가, 아니면 자매 라우트 일관성 위해 50 통일(B')이 옳은가? offset 라우트에서 default 페이지 크기 변경의 실질 위험은?
2. **C**: `parsePageNumber`를 pagination.ts에 추가 vs route 인라인 클램프 — 어디가 맞나? offset page 강건화가 WI-022 스코프에 포함되는 게 타당한가(backlog는 limit만 명시)?
3. **A**: `Object.values(enum)` 동적 allowlist vs 명시 상수 배열 — 보안/유지보수 트레이드오프? uppercase-후-검증이 대소문자 우회나 의도치 않은 통과를 만들 여지는?
4. **enum 검증을 400으로 막는 것** vs **조용히 무시(필터 누락)** — 어느 쪽이 옳은가? 400이 기존 클라이언트를 깨뜨릴 위험은(두 소비처는 유효값 전송 확인됨)?
5. 내가 놓칠 위험 1가지.
