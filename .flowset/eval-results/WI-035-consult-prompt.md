# WI-035 설계 협의 — 인-스페이스 참가자 패널 멤버관리 UI

당신은 FlowSpace(Next.js 15 + Phaser 3 메타버스)의 설계 협의 파트너다. 구현은 Claude가 한다. 아래 설계를 검토하고 **결정/대안/내가 놓칠 위험 1가지**를 한국어로 답하라. 코드를 바꾸지 말고 read-only 분석만.

## 목표 (사용자 기능 요청 큐 3/8)
인-스페이스 참가자 패널에서 OWNER/STAFF가 다른 멤버를 **채팅 음소거(mute)/해제(unmute)/강퇴(kick)/차단(ban)** 할 수 있는 UI. role(canActOn)로 게이팅. **음성 강제 음소거는 별도(WI-038/039)**, **귓속말은 이미 구현됨(WI-040 발견성만)**.

## 실측 정정 (핸드오프 가정이 틀렸음 — 반드시 반영)
1. **`src/components/space/player-list.tsx`는 죽은 코드** — 어디서도 import/렌더 안 됨(grep 확인). 핸드오프는 이걸 in-space 패널로 가정했으나 실제 in-space 참가자 패널은 **`src/components/space/video/ParticipantPanel.tsx`** (`SpaceMediaLayer` 경유 렌더, LiveKit 미디어 결합).
2. `ParticipantPanel`은 두 종류 행을 보여줌: (a) **미디어 참가자** = `VideoTile`(비디오/화면공유), (b) **미디어 없는 플레이어** = 아바타+닉네임 리스트. 둘 다 `players: {userId, nickname}[]`(socket) + `participantTracks`(LiveKit) 기반.
3. **in-space `players`(socket `PlayerData`)는 `{userId, nickname, avatar, position, direction}`만** — **role도 SpaceMember.id도 없음**.
4. **admin PATCH API는 `memberId`(=`SpaceMember.id`)를 요구**(userId 아님). `src/app/api/spaces/[id]/admin/members/route.ts`:
   - `PATCH {memberId, action: "changeRole"|"mute"|"unmute"|"kick"|"ban", role?}` — 서버에서 `canActOn(actorRole, target.role, isSuperAdmin)` 강제 + `spaceEventLog` 감사 + `dispatchEnforcement`(살아있는 소켓 실시간 반영: kick=disconnect, mute/ban=restriction, role=인메모리 갱신). OWNER 대상 변경은 superAdmin만.
   - `GET` — `SpaceMember[]` 반환(`{id, role, restriction, displayName, userId, createdAt, user{id,name,email,image}, guestSession{id,nickname}}`). **OWNER/STAFF/superAdmin만 허용(아니면 403)**.
5. `canActOn(actorRole, targetRole, isSuperAdmin)` = `src/lib/space-role.ts`(순수, `@prisma/client`에서 type만 import → 클라 import 안전). 규칙: actor가 target보다 **엄격히 상위** role일 때만(동급/상위 제재 불가), superAdmin은 항상 허용.
6. 대시보드 `src/components/dashboard/member-table.tsx`가 기존 소비처 — `fetch PATCH {memberId, action, role}` 후 `onRefresh()`. select 드롭다운 UI. 에러는 `alert()`.
7. WI-034가 `SpaceClient.user.role`(OWNER|STAFF|PARTICIPANT, **superAdmin 비반영**)을 주입함. 단 prop은 **세션 중 role 변경 시 stale**(enforce가 `socket.data.role`만 갱신, 클라 prop 미갱신).
8. socket bridge에 이미 `onMemberMuted/onMemberUnmuted/onMemberKicked({memberId, nickname, ...By})` 콜백 존재 — 현재 chat에 system 메시지로만 표시(`space-client.tsx`).

## 내 설계 제안

### A. 권한/식별 매핑 (핵심)
- 관리 UI는 **`GET /api/spaces/[id]/admin/members`로 멤버 목록을 fetch**해 `Map<userId, {memberId, role, restriction}>` 구성. in-space 참가자(userId)와 join.
- **actor의 권위 role은 stale prop(`user.role`) 대신 fetch한 멤버 목록의 self 행(userId===me)에서 도출** → GET 자체가 OWNER/STAFF/superAdmin만 200(아니면 403) → 권한 없으면 관리 UI 미표시(자연 게이트). 이로써 WI-034 stale-prop 우려를 관리 표면에서 우회. 서버 PATCH가 재검증하므로 클라 게이팅은 best-effort UX, 서버가 hard gate.
- fetch 트리거: 패널 열 때 + 액션 후 refetch(member-table `onRefresh` 패턴). PARTICIPANT(또는 비인가)는 fetch 시도 시 403 → 관리 UI 없음.

### B. 컴포넌트 구조
- 재사용 `MemberActionsMenu`(신규, `src/components/space/`) — props `{spaceId, targetUserId, targetNickname, targetMember:{memberId,role,restriction}|null, actorRole, isSuperAdmin?, onActionDone}`. canActOn 통과 + target 존재 시에만 케밥 메뉴(음소거/해제/강퇴/차단). PATCH 호출(member-table 동형). 본인/매칭 멤버 없음(게스트 등)·canActOn 불가 시 메뉴 미표시.
- `ParticipantPanel`에 멤버맵+actorRole 주입. **미디어 없는 플레이어 행**엔 메뉴 인라인. **VideoTile**엔 `actionsSlot` 렌더프롭으로 메뉴 주입(VideoTile 침습 최소화).
- 데이터 페치는 `SpaceMediaLayer` 또는 신규 훅(`useSpaceMembers(spaceId, enabled)`)에서. enabled = actor가 관리 가능할 때만(초기엔 stale prop으로 추정 후 GET 403이면 비활성).

### C. 액션 범위
- mute/unmute/kick/ban (restriction 계열 4종). **changeRole은 in-space 제외**(대시보드 전담, UX 무거움). 귓속말은 WI-040.
- kick/ban은 파괴적 → 경량 확인(인라인 confirm). 에러는 member-table처럼 표시(단 in-space는 `alert` 대신 chat system 메시지 또는 토스트 고려).

### D. 경계/하드코딩
- canActOn은 `@/lib/space-role` 재사용. 액션 라벨 문자열은 CLAUDE.md 하드코딩 금지 → 신규 in-space 상수 vs `DASHBOARD_COPY.MEMBERS.actions` 재사용(WI-033이 copy를 dashboard scope로 엄격 고정함). 새 서버 라우트/스키마/소켓 이벤트 변경 없음(기존 HTTP API만 소비).

## 협의 질문
1. **컴포넌트 타깃**: ParticipantPanel(실 패널)에 통합 vs 죽은 player-list.tsx 부활? VideoTile에 렌더프롭 vs 미디어 참가자는 메뉴 생략하고 비-미디어 리스트만? 침습/스코프 최소 안은?
2. **게스트 처리**: in-space player.userId ↔ admin member(게스트는 userId=null·guestSession 보유)는 userId로 매칭 불가. 게스트 참가자 관리를 1차 범위에 넣을지, 등록 사용자만 1차로 하고 게스트는 후속으로 명시할지?
3. **actor role 도출**: stale prop 대신 admin GET self 행에서 도출(위 A) — 이게 옳은가? 아니면 WI-034 stale-prop을 socket role-sync 이벤트로 푸는 게 이 WI 범위인가(나는 범위 밖으로 봄 — 서버가 hard gate)?
4. **액션 범위**: mute/unmute/kick/ban이 적정한가? ban과 kick 둘 다 노출이 운영자 혼란? changeRole 제외가 맞나?
5. **copy 상수**: 신규 in-space 상수 vs DASHBOARD_COPY 재사용?
6. **새로고침/실시간**: 액션 후 refetch로 충분한가? 다른 운영자의 동시 제재 반영(socket onMemberMuted/Kicked로 멤버맵 무효화)을 1차에 넣을지?
7. **내가 놓칠 위험 1가지** — 보안/동시성/경계 관점에서 가장 위험한 한 가지.
