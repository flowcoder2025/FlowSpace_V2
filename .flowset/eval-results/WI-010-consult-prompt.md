# WI-010-perf 설계 협의 (consult)

FlowSpace (Next.js 15 + Prisma + Phaser). 한국어로 답해줘.

## 배경
WI-009에서 슈퍼어드민이 `GET /api/spaces`를 `filter` 없이/`?filter=all`로 호출하면 **모든 ACTIVE 스페이스**(`scope={}`)를 반환하도록 했다. 현재 이 엔드포인트는 **페이지네이션이 전혀 없다** — `findMany`로 전부 로드. 일반 사용자(본인 멤버십 스페이스)는 양 적지만 슈퍼어드민 전역은 스페이스 수가 늘면 무한정 커진다. WI-010-perf는 이 스케일 부채(P3)를 해소한다.

## 현재 코드 (`src/app/api/spaces/route.ts` GET 핵심)
```ts
const userId = session.user.id;
const isSuperAdmin = session.user.isSuperAdmin === true;
const filter = request.nextUrl.searchParams.get("filter"); // "owned"|"joined"|"all"|null
const memberScope = { members: { some: { userId } } };
let scope;
if (filter === "owned") scope = { ownerId: userId };
else if (filter === "joined") scope = memberScope;
else if (filter === null || filter === "all") scope = isSuperAdmin ? {} : memberScope;
else return 400 INVALID_FILTER;

const spaces = await prisma.space.findMany({
  where: { ...scope, status: "ACTIVE" },
  include: { template:{select:{key,name}}, _count:{select:{members}}, members:{where:{userId},select:{role},take:1} },
  orderBy: { updatedAt: "desc" },
});
return NextResponse.json({ spaces: result });
```

## 소비자
- 유일한 GET 소비자: `src/stores/space-store.ts` `fetchSpaces()` → `data.spaces` 배열만 읽음. `setFilter`가 fetch 트리거.
- UI: `src/components/spaces/space-list-view.tsx` (필터 탭 all/owned/joined + 그리드, 슈퍼어드민은 "새 스페이스" 버튼). "더 보기" UI 없음.

## 기존 코드베이스 페이지네이션 관례 (`src/app/api/spaces/[id]/messages/route.ts`)
```ts
const cursor = searchParams.get("cursor");
const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
const messages = await prisma.chatMessage.findMany({
  where, orderBy: { createdAt: "desc" }, take: limit + 1,
  ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  select: {...},
});
const hasMore = messages.length > limit;
const results = hasMore ? messages.slice(0, limit) : messages;
const nextCursor = hasMore ? results[results.length-1]?.id : null;
return { messages: results, nextCursor, hasMore };
```

## 내 설계안
1. **API**: 위 cursor 관례를 그대로 `GET /api/spaces`에 적용. `limit` default 50, max 100. `take: limit+1` → `hasMore`/`nextCursor`. 응답 `{ spaces, nextCursor, hasMore }` (기존 `spaces` 필드 유지 = 하위호환).
2. **정렬 안정성**: cursor 페이지네이션은 정렬키가 안정적이어야 한다. 현재 `orderBy: { updatedAt: "desc" }`인데 `updatedAt`은 (a) 유니크하지 않고 (b) 가변(스페이스 갱신 시 변동)이라 cursor가 행을 건너뛰거나 중복할 수 있다. → `orderBy: [{ updatedAt: "desc" }, { id: "desc" }]`로 id 타이브레이커 추가, `cursor: { id }`. (messages 라우트는 createdAt 불변이라 문제 없지만 spaces의 updatedAt은 가변.)
3. **모든 스코프에 일관 적용** (owned/joined/all/전역 전부). 분기 없이 단순.
4. **클라이언트**: `space-store`에 `nextCursor`/`hasMore`/`loadMore()` 추가. `fetchSpaces`는 1페이지 리셋, `loadMore`는 append. `setFilter`는 페이지네이션 리셋. `space-list-view`에 `hasMore` 시 "더 보기" 버튼. (이렇게 안 하면 슈퍼어드민이 limit 넘는 스페이스를 못 봐서 WI-009 기능 부분 회귀.)

## 질문
A. 정렬키: `updatedAt`(가변) 유지 + id 타이브레이커가 적절한가, 아니면 cursor 안정성을 위해 `createdAt`(불변)으로 바꾸는 게 나은가? 후자는 "최근 활동순" 의미를 잃는다. 트레이드오프 판단 부탁.
B. limit default 50이 적절한가? 전역 그리드 UI 고려.
C. 클라 UI(더 보기)까지 이번 WI 범위에 포함하는 게 맞나, 아니면 API만 하고 클라는 1페이지만(상한)으로 두는 게 P3 범위에 맞나? 후자면 슈퍼어드민 가시성 회귀가 생기는데 허용 가능한가?
D. 존재하지 않는/위조된 cursor id가 오면 Prisma는 빈 결과를 주는데(throw 아님), 추가 가드가 필요한가?
E. **내가 놓친 위험 1가지**를 반드시 지적해줘.

산문으로 간결히. 권고안 명확히.
