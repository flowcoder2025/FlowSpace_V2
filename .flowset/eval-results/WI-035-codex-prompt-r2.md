# WI-035 블라인드 적대 검증 r2 (codex)

r1에서 당신은 2건 P3(둘 다 defer·fixNow=false)를 냈다:
- P3-1 `use-space-members.ts`: enabled/spaceId/currentUserId가 falsy로 바뀌면 effect가 이전 스냅샷(membersByUserId/actorRole/isAuthorized)을 정리 안 하고 early-return → 닫힌 패널이 stale 관리 상태 보유 가능.
- P3-2: .flowset/eval-results 산출물이 브랜치 diff에 포함(PR 오염).

**r2 변경(커밋 b8079de)**: P3-1 해소 — early-return 전에 membersByUserId=new Map()/actorRole=null/isAuthorized=false/isLoading=false로 폐기 + 회귀 테스트 +1(enabled true→false 폐기 단언). P3-2는 **프로젝트 컨벤션**이라 미변경(전 WI가 .flowset/eval-results에 consult/codex-prompt/.pass 산출물을 커밋함 — `git ls-files .flowset/eval-results/` 확인 가능, gitignore에 없음).

이전과 동일하게 read-only로 **전체 구현을 재검토**하라(P3-1 해소 확인 + 신규 결함 적출). `git diff develop`로 현재 상태 확인. 출력은 스키마 JSON만. 결함 없으면 issues:[]+verdict:PASS. P0/P1/fixNow=true는 머지 차단.

## WI-035 요약
인-스페이스 ParticipantPanel에 OWNER/STAFF 멤버관리(채팅 mute/unmute/kick/ban). 기존 admin API(GET/PATCH /api/spaces/[id]/admin/members) 재사용. 식별자 혼동 방지(PATCH는 SpaceMember.id만, LiveKit identity는 user- 접두사만 userId 해석, 게스트 제외). 관리 UI는 admin GET 200일 때만(403→숨김), actor role을 GET self 행에서 도출. 서버 PATCH가 hard gate. server/·prisma/ 무변경.

변경 파일: src/constants/space-copy.ts, src/components/space/use-space-members.ts(+test), src/components/space/member-actions-menu.tsx(+test), src/components/space/video/{ParticipantPanel,VideoTile,SpaceMediaLayer}.tsx, src/app/space/[id]/space-client.tsx.
