너는 FlowSpace(Next.js 15 + Phaser 3 메타버스) 코드 변경을 **독립적·적대적으로 블라인드 검증**하는 reviewer다. 아래 WI-034-fix 변경을 read-only로 검토하고, 결함을 P0~P3로 분류해 **지정된 JSON 스키마로만** 출력하라. 다른 reviewer의 산출물은 참조하지 않는다.

## WI-034-fix 목표
인-스페이스 페이지가 사용자의 공간 role을 클라이언트로 전달하지 않던 선결 버그 수정. `src/app/space/[id]/page.tsx`가 `SpaceClient`에 `{id,nickname,avatar}`만 넘겨 `user.role`이 세션 내내 undefined → OWNER/STAFF도 에디터 진입(`canEdit`)·관리 채팅명령 파싱(use-chat `isAdmin` → @mute/@kick)·ChatPanel 관리 UI가 비활성. WI-035(인-스페이스 멤버관리 UI) 선결.

## 설계 결정 (codex consult 1R 반영됨)
- **인-스페이스 권한 SoT = `SpaceMember.role`** — 소켓 `join:space`(`server/handlers/room.ts:48`)와 `requireSpaceAdmin`(`src/lib/admin-guard.ts`)이 같은 값을 권위로 쓴다. `space.ownerId`로 OWNER를 파생하지 않는다(클라/소켓 발산 회피).
- **합성 OWNER 폴백 금지** — owner인데 멤버 행이 없으면 OWNER 행을 self-heal create(소켓이 비멤버를 NOT_A_MEMBER로 거부하므로 합성 OWNER는 발산).
- **superAdmin 인-스페이스 특례 없음** — `join:space`에 특례가 없다. requireSpaceAdmin의 superAdmin→OWNER는 HTTP 대시보드 가드 한정.

## 변경 파일 (커밋 c75e351, base develop)
1. `src/lib/space-role.ts` — 신규 순수 헬퍼 `resolveSpaceRoleDecision({memberRole,isOwner,accessType})` → `{action:"use"|"create"|"redirect", role?}` + `SpaceRoleDecision` 타입. `import type SpaceAccessType` 추가.
2. `src/app/space/[id]/page.tsx` — 비오너만 검사하던 멤버십 블록을 전원 1쿼리(`findUnique select:{role}`)로 통합 → `resolveSpaceRoleDecision`로 결정 → redirect/create 분기 → `role`을 `SpaceClient user.role`에 주입.
3. `src/lib/space-role.test.ts` — 신규 테스트 15(헬퍼 전 분기 + 강등 엣지 + superAdmin 비특례 + 기존 canActOn/isSpaceRole 가드).

## 실측 컨텍스트
- 스페이스 생성(`POST /api/spaces` route.ts:137-143): 생성자에게 `SpaceMember{role:"OWNER"}` 동시 생성 → 정상 오너는 OWNER 멤버 행 보유.
- 소켓 `room.ts:48-68`: 멤버 행 없으면 `NOT_A_MEMBER` 거부, BANNED 차단, superAdmin 특례 없음.
- `SpaceClient.user.role?: "OWNER"|"STAFF"|"PARTICIPANT"` 이미 선언·3곳 사용(canEdit L80, useChat L135, ChatPanel L456). 소켓에서 prop 갱신 경로 없음.
- `page.tsx`는 `src/app/` 경로라 prisma 직접 사용 허용(data-ownership 규칙).

## 검토 관점 (적대적)
1. role 결정 로직의 정확성 — 모든 분기(use/create owner self-heal/create participant/redirect)와 엣지(오너 강등 STAFF, 기존 멤버 PRIVATE, BANNED 등).
2. 소켓/requireSpaceAdmin과의 권한 정합성·발산 가능성.
3. self-heal create의 안전성(중복 생성·race·권한 상승 가능성).
4. 무회귀 — 기존 멤버십 자동생성/redirect 동작 보존 여부.
5. 보안 — 권한 상승, superAdmin 특례 누락/오용, 클라가 받은 role로 서버 가드 우회 가능성(서버는 별도 검증하는가).
6. 테스트가 변이를 잡는가(false-pass 여부).
7. 범위 — page prop 외 불필요한 변경 여부.

검증 시 실제 파일을 읽어 확인하라. 기계게이트(tsc0/lint0err/vitest431/build0)는 이미 통과. 출력은 스키마 JSON만.
