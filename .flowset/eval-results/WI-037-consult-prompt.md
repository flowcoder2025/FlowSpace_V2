# WI-037 설계 협의 — 설정 화면 스페이스 삭제 UI

당신은 FlowSpace(Next.js 15 App Router + Phaser 3 메타버스)의 설계 협의 파트너다. 구현은 Claude가 한다. 아래 설계를 검토하고 **결정/대안/내가 놓칠 위험 1가지**를 한국어로 답하라. 코드를 바꾸지 말고 read-only 분석만.

## 목표 (사용자 기능 요청 큐 5/8)
스페이스 **삭제(soft delete = ARCHIVED) UI**. 설정 화면에 삭제 진입점 + 확인 모달("삭제 시 접속자 추방·복구 불가") + `DELETE /api/spaces/[id]` 호출 + 성공 후 라우팅/목록 갱신. **OWNER/superAdmin만 노출**.

## 실측 (핸드오프 가정 검증 완료 — 반드시 반영)

### 1. 백엔드는 이미 완성 (WI-036). 순수 UI WI.
`DELETE /api/spaces/[id]` (`src/app/api/spaces/[id]/route.ts:145`):
- 인증: 401 미인증 / 404 없음 / **403 (OWNER 아니고 superAdmin 아니면)** — 게이트는 `space.ownerId === session.user.id || session.user.isSuperAdmin`. **STAFF는 삭제 불가(403)**.
- soft delete: `updateMany({where:{id, status:{not:"ARCHIVED"}}, data:{status:"ARCHIVED", deletedAt, deletedBy}})` — 최초 행위자 보존(재삭제·동시요청 멱등).
- 실시간 추방: `dispatchEnforcement({spaceId, action:"archive", actorName})` — 접속자 전원 추방(소켓 서버가 postcondition=status===ARCHIVED 재확인).
- 성공 응답: 200 `{message:"Space archived", realtimeEnforced:boolean}`. **이미 archived여도 200(멱등)**.

### 2. 설정 페이지 = 권한 경계 불일치 (핵심)
`src/app/dashboard/spaces/[id]/settings/page.tsx` (server component):
- `await requireSpaceAdmin(id)` 가드 — **OWNER/STAFF/superAdmin 통과**(`src/lib/admin-guard.ts`: superAdmin→`{role:"OWNER", isSuperAdmin:true}` 반환, 실멤버→`{role:"OWNER"|"STAFF", isSuperAdmin:false}`).
- `prisma.space.findUnique` select에 현재 `{name, description, maxUsers, accessType, primaryColor, loadingMessage}` — **ownerId 미포함**.
- `<SpaceSettingsForm spaceId initialValues={...}/>` (client) 렌더.
- **즉, 설정 페이지는 STAFF도 진입 가능하나 삭제는 OWNER/superAdmin만** → 삭제 UI는 STAFF에게 노출하면 안 됨(클릭 시 403).

### 3. 목록 페이지 / 라우팅 타겟
- 정규 목록 = `/my-spaces` (`src/app/my-spaces/page.tsx` → `<SpaceListView isSuperAdmin/>`).
- `SpaceListView`(`src/components/spaces/space-list-view.tsx`)는 마운트 시 `useEffect(()=>fetchSpaces())` 1회.
- `useSpaceStore`(`src/stores/space-store.ts`, zustand 모듈 싱글턴): `fetchSpaces()`가 `GET /api/spaces`(서버에서 **status=ACTIVE만** 반환) → archived 스페이스는 자연 제외. `removeSpace(id)`/`addSpace` 액션 존재. `_reqId` 토큰으로 stale 응답 무시.
- 카드 `src/components/spaces/space-card.tsx`: 클릭→`/space/${id}` 입장, OWNER/STAFF/superAdmin이면 "관리" 버튼→`/dashboard/spaces/${id}`. **삭제 버튼 없음**.

### 4. 기존 파괴적 액션 패턴
- `src/components/space/member-actions-menu.tsx`: kick/ban은 **인라인 확인**(pendingConfirm state, 별도 모달 컴포넌트 아님). 재사용 가능한 범용 Confirm/Modal 컴포넌트는 코드베이스에 **없음**(avatar-editor-modal은 특수목적).
- copy 상수: `DASHBOARD_COPY.SETTINGS`(`src/constants/dashboard-copy.ts:215`) — WI-033이 dashboard scope로 한글화. 하드코딩 금지(CLAUDE.md) → 신규 copy는 여기에.

## 내 설계 제안

### A. 컴포넌트 구조 / 배치
- 신규 client 컴포넌트 `DeleteSpaceSection`(`src/components/dashboard/delete-space-section.tsx`). 설정 페이지에서 `SpaceSettingsForm` 아래 **별도 "위험 구역" 카드**로 렌더. SpaceSettingsForm(편집)과 분리(관심사 분리).
- 삭제 진입점은 **설정 페이지에만**. 카드(space-card)에는 추가 안 함(목록 카드의 삭제 버튼은 오클릭 위험 + 카드는 입장/관리 진입 전용). → 스코프 최소.

### B. 권한 게이팅
- 설정 페이지 server component에서 `requireSpaceAdmin` 컨텍스트 + findUnique select에 `ownerId` 추가 → `canDelete = ctx.isSuperAdmin || space.ownerId === ctx.userId` 계산(**DELETE API 게이트의 정확한 미러**). `canDelete` prop으로 전달. STAFF면 위험 구역 전체 미렌더.
- 서버 DELETE가 hard gate(재검증) — 클라 게이팅은 best-effort UX.

### C. 확인 UX
- **이름 타이핑 확인 모달**: 삭제 버튼 클릭 → 모달(role=dialog, aria-modal) → 경고문("삭제 시 접속 중인 사용자가 모두 추방되며, 복구할 수 없습니다") + 스페이스 이름 입력 필드. 입력값 === 스페이스 이름일 때만 "삭제" 버튼 활성(되돌릴 수 없는 파괴적 액션의 표준 가드).
- 대안: member-actions-menu식 경량 인라인 확인(타이핑 없이 확인/취소 2버튼).

### D. 삭제 플로우 / 에러
- 확인 → `fetch DELETE /api/spaces/${id}` → 200이면 `router.push("/my-spaces")`. SpaceListView 마운트 시 fetchSpaces 재실행으로 목록 갱신(archived 자연 제외) + 선택적으로 `useSpaceStore.getState().removeSpace(id)` 낙관적 제거.
- 에러: 403/404/네트워크 → 모달 내 에러 표시, 모달 유지. 이미 archived(200 멱등) → 성공 취급, redirect.

## 협의 질문
1. **배치/스코프**: DeleteSpaceSection을 설정 페이지에만(내 안) vs space-card에도 삭제 버튼? WI 노트는 "settings/page.tsx·카드에 삭제 버튼 부재"라 둘 다 가능하나, 나는 카드 삭제는 오클릭 위험으로 설정 페이지 전용을 제안. 동의?
2. **게이팅**: `canDelete = isSuperAdmin || space.ownerId === userId`(findUnique에 ownerId 추가)가 DELETE API 게이트의 정확한 미러인가? `requireSpaceAdmin`의 `role==="OWNER"` 출력을 쓰면(superAdmin도 role:"OWNER") ownerId 미러와 어긋날 엣지(예: OWNER 멤버행은 있으나 space.ownerId는 다른 사용자)가 있는가? ownerId 직접 비교가 옳은가?
3. **확인 UX**: 이름 타이핑 확인(C안) vs 경량 인라인 확인 — 되돌릴 수 없고 접속자 전원 추방되는 파괴적 액션에 타이핑 확인이 적정한가, 과한가?
4. **라우팅/스토어**: `/my-spaces` redirect + 마운트 refetch로 목록 갱신 충분한가? zustand 싱글턴 stale 위험(redirect 후 SpaceListView 재마운트가 fetchSpaces 재실행) — `removeSpace(id)` 낙관적 제거를 추가해야 하나, 불필요한가? **삭제 후 사용자가 대시보드에 머무르면**(redirect 직전/실패 시) `/dashboard/spaces/[id]/*` 레이아웃의 `requireSpaceAdmin`은 archived 스페이스에도 통과(멤버행 잔존)해 archived 스페이스 대시보드 서브페이지를 계속 볼 수 있는데, 이건 WI-037 범위인가(redirect-away로 충분) 아니면 별도 후속(대시보드 가드가 archived 거부)인가?
5. **멱등**: 이미 archived인 스페이스에 DELETE 시 200 — 성공 취급+redirect가 맞나?
6. **내가 놓칠 위험 1가지** — 보안/권한/동시성/UX 관점에서 가장 위험한 한 가지.
