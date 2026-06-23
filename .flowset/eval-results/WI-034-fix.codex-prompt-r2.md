너는 FlowSpace 코드 변경을 독립적·적대적으로 블라인드 검증하는 reviewer다. WI-034-fix **r2**를 read-only로 재검토하고 결함을 P0~P3로 분류해 **지정 JSON 스키마로만** 출력하라.

## WI-034-fix 목표
인-스페이스 페이지가 사용자 공간 role을 클라이언트로 전달하지 않던 선결 버그 수정. `page.tsx`가 `SpaceClient`에 role을 안 넘겨 `user.role`이 undefined → OWNER/STAFF도 에디터/관리 채팅명령/관리 UI 비활성. 인-스페이스 권한 SoT = `SpaceMember.role`(소켓 `server/handlers/room.ts:48`·`requireSpaceAdmin` 정합). superAdmin 특례 없음.

## r1 → r2 변경 (직전 라운드 fixNow 2건 해소됨 — 재검증 대상)
r1에서 지적된 2건을 이번 r2에서 수정했다. 실제로 해소됐는지, 새 결함이 없는지 확인하라:

1. **(이전 P2) BANNED 멤버가 role을 받던 발산** — `src/lib/space-role.ts` `resolveSpaceRoleDecision`에 `restriction: ChatRestrictionValue | null` 입력 추가. 멤버 행이 있고 `restriction === "BANNED"`면 role보다 **먼저** `{action:"redirect"}` 반환(소켓 join:space의 BANNED 거부와 정합). `page.tsx`는 `select: { role, restriction }`로 조회해 헬퍼에 전달, redirect 분기에서 `/my-spaces`로 종료. (근거: 맵 편집 HTTP 라우트 `map/tiles/route.ts:25`·`map/objects/route.ts:26`이 `role:{in:[OWNER,STAFF]}`만 보고 restriction 미검사라, BANNED admin에게 role을 주면 에디터로 맵 편집이 가능했음.) MUTED는 입장 허용(use) 유지.

2. **(이전 P3) findUnique→create 비원자성(P2002 race)** — `page.tsx`의 `create`를 `upsert({ where: spaceId_userId, update: {}, create: {...}, select:{role} })`로 교체. owner self-heal·PUBLIC participant 양쪽 경로 모두 멱등·원자적. 충돌 시 기존 행 role 반환.

## 검증 파일 (커밋 22aa279, base develop)
- `src/lib/space-role.ts` — `resolveSpaceRoleDecision`(+restriction 입력·BANNED 분기), `SpaceRoleDecision` 타입.
- `src/app/space/[id]/page.tsx` — 멤버십 통합 1쿼리(role+restriction) → 헬퍼 결정 → redirect/upsert → `SpaceClient user.role` 주입.
- `src/lib/space-role.test.ts` — 헬퍼 19 테스트(전 분기 + BANNED 전 role redirect + MUTED use + 강등 엣지 + superAdmin 비특례).
- `src/app/space/[id]/page.test.tsx` — page 6 테스트(mock auth/prisma/redirect/space-client): 기존멤버 use·MUTED use·PUBLIC upsert PARTICIPANT(create 미사용·upsert update:{} 멱등 단언)·owner self-heal upsert OWNER·BANNED OWNER redirect·PRIVATE 비멤버 redirect.

## 실측 컨텍스트
- 스페이스 생성(route.ts:137-143)이 생성자 `SpaceMember{role:OWNER}` 동시 생성.
- 소켓 room.ts:48-68: 멤버 없으면 NOT_A_MEMBER, BANNED 거부.
- 클라 `user.role`은 UI 노출·채팅명령 파싱만 제어 — 실 enforcement는 서버 `socket.data.role`(room.ts:83, DB 검증값) 및 HTTP 라우트 자체 가드.
- page.tsx는 `src/app/` 경로라 prisma 직접 사용 허용.

## 검토 관점 (적대적)
r1 fixNow 2건의 실질 해소 여부, BANNED 분기의 정확성(role보다 선행·MUTED 비차단), upsert 멱등/원자성·role clobber 가능성(update:{}가 기존 role 보존하는지), superAdmin/강등 엣지 정합, 무회귀, 보안(권한 상승·서버 가드 우회), 테스트 변이 검출력(false-pass), 범위. 실제 파일을 읽어 확인하라. 기계게이트(tsc0/lint0err/vitest441/build0) 통과 실측. 출력은 스키마 JSON만.
