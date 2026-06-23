# WI-035 블라인드 적대 검증 (codex)

당신은 FlowSpace(Next.js 15 + Phaser 3)의 **독립 적대 검증자(codex)**다. 아래 WI 구현을 read-only로 검토하고 결함을 P0~P3로 분류해 **출력 스키마에 맞는 JSON만** 반환하라. 다른 검증자 산출물을 참조하지 말 것.

## WI-035 목표
인-스페이스 참가자 패널에서 OWNER/STAFF가 다른 멤버를 **채팅 음소거(mute)/해제(unmute)/강퇴(kick)/차단(ban)** 하는 UI. 기존 dashboard HTTP admin API(`GET`/`PATCH /api/spaces/[id]/admin/members`) 재사용 — 신규 라우트/스키마/소켓 변경 없음. 음성 강제 음소거(WI-038/039)·귓속말(WI-040)·changeRole(대시보드 전담)·게스트 관리는 범위 밖.

## 변경 파일 (브랜치 feature/WI-035-feat-participant-member-actions, base=develop)
- 신규 `src/constants/space-copy.ts` — in-space 카피(dashboard-copy와 분리)
- 신규 `src/components/space/use-space-members.ts` — `useSpaceMembers` 훅 + `managedUserIdFromIdentity`
- 신규 `src/components/space/member-actions-menu.tsx` — `MemberActionsMenu`
- 수정 `src/components/space/video/ParticipantPanel.tsx` — 훅 호출 + 메뉴 배선(미디어 타일 actionsSlot + 비-미디어 행)
- 수정 `src/components/space/video/VideoTile.tsx` — `actionsSlot?: ReactNode`(좌상단)
- 수정 `src/components/space/video/SpaceMediaLayer.tsx` / `src/app/space/[id]/space-client.tsx` — `spaceId` 전달
- 테스트 `use-space-members.test.tsx`(10) · `member-actions-menu.test.tsx`(11)

## 설계 컨텍스트(검증 시 사실로 간주)
- 인-스페이스 참가자 패널 = `ParticipantPanel`(LiveKit 미디어 결합). `player-list.tsx`는 죽은 코드라 미사용.
- in-space 참가자: socket `players`는 `{userId,nickname}`, 미디어 참가자는 LiveKit identity `user-{userId}`/`guest-{guestSessionId}`/`dev-anon-*`.
- admin `PATCH`는 `memberId`(=SpaceMember.id) 요구. canActOn(actor>target) 서버 강제 + 감사 + dispatchEnforcement(실시간). admin `GET`은 OWNER/STAFF/superAdmin만 200(아니면 403), members에 `{id,role,restriction,userId,...}`.
- `canActOn(actor,target,isSuperAdmin=false)`(`src/lib/space-role.ts`): actor가 target보다 **엄격히 상위**일 때만.

## 핵심 설계 결정(검증 포인트)
1. **권한 게이트**: 관리 UI는 admin GET 성공 시에만 표시(403→숨김). actor role을 stale prop(`user.role`) 대신 GET 응답의 self 행에서 도출. 서버 PATCH가 hard gate.
2. **식별자 혼동 방지(설계협의 #1 위험)**: PATCH 대상은 **오직 SpaceMember.id**. 매핑 키는 SpaceMember.userId(등록 사용자만, 게스트 userId=null 제외). LiveKit identity는 `user-` 접두사만 userId로 해석(`managedUserIdFromIdentity`).
3. **클라 게이팅**: `MemberActionsMenu`는 member 매핑 없음/actorRole 없음/본인/canActOn 불가 시 렌더 안 함.

## 검증 관점(적대적으로)
- 보안: 식별자 혼동으로 잘못된 대상 제재 가능성? PATCH에 userId/identity가 새는가? 클라 게이팅 우회로 서버가 못 막는 케이스? GET 403 처리 누락? 권한 상승?
- 동시성/생명주기: 훅의 fetch race(언마운트 후 setState, enabled 토글, 빠른 refetch), stale 스냅샷으로 잘못된 게이팅?
- 정합성: canActOn 단일 SoT 일관? mute/unmute 토글 조건? 확인(kick/ban) 플로우?
- 경계/하드코딩: 모듈 경계(internal 직접 import) 위반? 하드코딩 카피? server/·prisma/ 무영향?
- 무회귀: ParticipantPanel/VideoTile 기존 동작 보존? 비인가 사용자(PARTICIPANT)에게 영향?

각 이슈에 `severity, location(파일:라인), description, recommendation, defer, deferRationale, fixNow`를 채워라. 결함 없으면 `issues:[]` + `verdict:"PASS"`. P0/P1 또는 fixNow=true는 머지 차단 사유다. **JSON만 출력.**
