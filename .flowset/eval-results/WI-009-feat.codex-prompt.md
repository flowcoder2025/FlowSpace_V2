너는 FlowSpace(Next.js 15 + Prisma + NextAuth v5)의 독립 코드 검증자(codex)다. 아래 WI-009-feat 구현 diff를 적대적으로 검증하라. 다른 검증자(evaluator)의 산출물을 절대 참조하지 마라(블라인드).

## 출력 형식 (엄수)
마지막 agent message는 review.schema.json을 만족하는 JSON 하나만 출력한다. reviewer="codex", schemaVersion=1, scores=null, weightedTotal=null. verdict는 PASS|WARNING|FAIL. issues는 발견 결함을 P0~P3로 분류(없으면 빈 배열). 각 issue: severity, location, description, recommendation, defer(boolean), deferRationale(string|null), fixNow(boolean). P0/P1 또는 fixNow=true가 하나라도 있으면 verdict는 PASS가 될 수 없다.

## WI-009-feat 목표 (사용자 요청)
슈퍼어드민이 "내 스페이스" 화면에서 모든 ACTIVE 스페이스를 보고 관리(대시보드 진입)할 수 있어야 한다. 방식 = "내 스페이스에 전체 노출". 백엔드 인가(requireSpaceAdmin)는 이미 슈퍼어드민을 통과시키므로 목록/UI 진입점만 추가하는 작업이다.

## 수용 기준
1. GET /api/spaces: session.user.isSuperAdmin이면 "전체"(filter=all/null)에서 모든 ACTIVE 스페이스 반환. 일반 사용자 동작은 불변(전체=본인 멤버십, owned=ownerId, joined=멤버십).
2. 슈퍼어드민이 아니면 전역 노출 금지(권한 상승/IDOR 없어야 함).
3. SpaceCard '관리' 버튼이 슈퍼어드민에게 myRole과 무관하게 노출. 버튼 표시 근거는 서버 세션 권위(클라이언트 위조 불가). 클릭 시 /dashboard/spaces/<id> (백엔드 requireSpaceAdmin 재검증).
4. 민감정보 신규 노출 없어야 함(accessSecret 등).
5. 기계게이트 tsc/lint/vitest/build 모두 PASS여야 함(이미 PASS 확인됨).

## 커밋된 구현 diff (fb484d6)

### src/app/api/spaces/route.ts (GET 부분)
```ts
import { Prisma } from "@prisma/client";
// ...
const userId = session.user.id;
const isSuperAdmin = session.user.isSuperAdmin === true;
const filter = request.nextUrl.searchParams.get("filter"); // "owned" | "joined" | "all" | null

const memberScope: Prisma.SpaceWhereInput = {
  members: { some: { userId } },
};

let scope: Prisma.SpaceWhereInput;
if (filter === "owned") {
  scope = { ownerId: userId };
} else if (filter === "joined") {
  scope = memberScope;
} else if (filter === null || filter === "all") {
  // 슈퍼어드민의 "전체"만 전역(모든 ACTIVE), 일반 사용자는 본인 멤버십 스페이스
  scope = isSuperAdmin ? {} : memberScope;
} else {
  return NextResponse.json(
    { error: "Invalid filter", code: "INVALID_FILTER" },
    { status: 400 }
  );
}

const spaces = await prisma.space.findMany({
  where: { ...scope, status: "ACTIVE" },
  include: {
    template: { select: { key: true, name: true } },
    _count: { select: { members: true } },
    members: { where: { userId }, select: { role: true }, take: 1 },
  },
  orderBy: { updatedAt: "desc" },
});
// result에서 inviteCode 제거됨(이전엔 s.inviteCode 포함). 나머지 필드 동일.
```

### src/components/spaces/space-card.tsx
```ts
interface SpaceCardProps {
  space: { /* ...기존... */ myRole: string | null; };
  isSuperAdmin?: boolean; // 추가
}
export function SpaceCard({ space, isSuperAdmin = false }: SpaceCardProps) {
  const isAdmin = space.myRole === "OWNER" || space.myRole === "STAFF" || isSuperAdmin;
  // isAdmin이면 '관리' 버튼 → router.push(`/dashboard/spaces/${space.id}`)
}
```

### src/components/spaces/space-list-view.tsx
```tsx
// my-spaces/page.tsx(서버컴포넌트)가 session.user.isSuperAdmin을 SpaceListView prop로 전달(기존).
{spaces.map((space) => (
  <SpaceCard key={space.id} space={space} isSuperAdmin={isSuperAdmin} />
))}
```

### src/stores/space-store.ts
```ts
// SpaceItem 타입에서 inviteCode: string 제거(목록 UI가 미소비하던 죽은 필드, addSpace 호출처 없음).
```

## 검증 관점 (반드시 점검)
- 권한 상승/IDOR: 비-슈퍼어드민이 전역 목록을 얻을 경로가 있나? scope={} 가 슈퍼어드민에게만 도달하나?
- filter 입력 검증: 미허용 값 400 처리의 부작용(기존 클라이언트 회귀)?
- inviteCode 제거가 다른 소비처를 깨뜨리나?(join 흐름은 라우트 파라미터 사용, 목록 응답 아님)
- 슈퍼어드민 전역 반환의 페이지네이션 부재/성능, accessSecret 등 민감정보 노출 여부
- 클라이언트 prop(isSuperAdmin)이 버튼 표시에만 쓰이고 실제 인가는 서버에서 재검증되는가(버튼만 보이고 인가 우회는 불가한가)
- 내가 놓친 위험을 적극적으로 찾아라. 과대평가 금지, 실제 결함만.
