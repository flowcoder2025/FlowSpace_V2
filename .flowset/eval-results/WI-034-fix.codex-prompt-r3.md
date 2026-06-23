너는 FlowSpace 코드 변경을 독립적·적대적으로 블라인드 검증하는 reviewer다. WI-034-fix **r3**를 read-only로 재검토하고 결함을 P0~P3로 분류해 **지정 JSON 스키마로만** 출력하라.

## WI-034-fix 목표
인-스페이스 페이지가 사용자 공간 role을 클라이언트로 전달하지 않던 선결 버그 수정. 인-스페이스 권한 SoT=`SpaceMember.role`(소켓 `server/handlers/room.ts:48`·`requireSpaceAdmin` 정합). BANNED 멤버는 입장 거부(소켓 정합). superAdmin 특례 없음. owner 멤버 행 누락은 OWNER self-heal. 동시 첫 진입은 upsert로 원자화.

## 직전 라운드 이력 (수렴 추적)
- r1: 2건 fixNow(BANNED 미검사 / bare create P2002 race) → r2에서 해소.
- r2: 새 fixNow 1건 — **upsert 충돌 분기 BANNED race**: BANNED-before-role 불변식이 upsert 이전 read에만 적용돼, upsert가 충돌 분기에서 기존 BANNED 행을 반환하면 restriction 재확인 없이 role 주입됨.

## r2 → r3 변경 (이번 fixNow 해소 — 재검증 대상)
`src/app/space/[id]/page.tsx` create 분기:
- upsert `select`에 `restriction` 추가(`{role, restriction}`).
- upsert 결과를 **동일 `resolveSpaceRoleDecision`으로 post-upsert 재평가**(BANNED 단일 SoT) → `postDecision.action === "redirect"`(=BANNED 기존행)이면 role 주입 전 `/my-spaces` redirect, 아니면 `postDecision.role` 사용.
- `page.test.tsx` +1: findUnique=null(→create) + upsert가 `{role:"OWNER", restriction:"BANNED"}` 반환 → redirect 단언.

## 검증 파일 (커밋 5379485, base develop)
- `src/lib/space-role.ts` — `resolveSpaceRoleDecision({memberRole,restriction,isOwner,accessType})`, BANNED→redirect 선행.
- `src/app/space/[id]/page.tsx` — findUnique(role+restriction)→헬퍼→redirect/upsert(+post-upsert BANNED 재평가)→`SpaceClient user.role` 주입.
- `src/lib/space-role.test.ts` 19 + `src/app/space/[id]/page.test.tsx` 7.

## 실측 컨텍스트
- 스페이스 생성(route.ts:137-143) 생성자 OWNER 멤버 행 동시 생성. 소켓 room.ts:48-69 멤버 없으면 NOT_A_MEMBER·BANNED 거부.
- 맵 편집 HTTP 라우트(map/tiles/route.ts:25·map/objects/route.ts:26)는 role만 보고 restriction 미검사 → BANNED admin에게 role 주면 에디터 우회 편집 가능(=차단 이유).
- 클라 role은 UI/파싱만 — 실 enforcement는 서버 socket.data.role·HTTP 라우트 가드.

## 검토 관점 (적대적)
r2 fixNow(upsert-BANNED race)의 실질 해소 여부, post-upsert 재평가의 정확성(BANNED만 차단·MUTED 통과·role clobber 없음), 또 다른 race/우회 잔존, 무회귀, 보안, 테스트 변이 검출력, 범위. 실제 파일을 읽어 확인하라. 기계게이트(tsc0/lint0err/vitest442/build0) 통과 실측. 출력은 스키마 JSON만.
