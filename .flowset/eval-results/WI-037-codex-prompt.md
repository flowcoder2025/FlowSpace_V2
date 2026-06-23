블라인드 코드 검증 — WI-037-feat: 설정 화면 스페이스 삭제 UI

당신은 독립 적대 검증자입니다. 아래 변경을 read-only로 직접 실측해 결함을 찾아내고, 출력 스키마에 맞춰 JSON으로만 답하세요(verdict PASS|WARNING|FAIL, issues P0~P3 + defer/deferRationale/fixNow). 다른 검증자의 산출물을 참조하지 마세요.

## 목표
설정 화면에서 OWNER/superAdmin이 스페이스를 삭제(soft delete=ARCHIVED)할 수 있는 **순수 UI** 추가. 백엔드(`DELETE /api/spaces/[id]`)는 WI-036에서 이미 완성됨(이 WI는 백엔드 무변경).

## 변경 범위 (HEAD 커밋 = `git show HEAD`, base = develop `3b17f10`)

### 변경/신규 파일
- `src/components/dashboard/delete-space-section.tsx` (신규) — 위험 구역 카드 + 이름 타이핑 확인 모달. 모달(role=dialog, aria-modal)에서 입력값이 스페이스 이름과 **정확히 일치**할 때만 삭제 활성. 확인 시 `fetch DELETE /api/spaces/[id]` → 200이면 `router.replace("/my-spaces")`. 에러(non-ok/throw)는 모달 내 표시·유지. ESC 닫기. 삭제 진행 중 닫기/중복제출 차단.
- `src/app/dashboard/spaces/[id]/settings/page.tsx` (수정) — `requireSpaceAdmin` 컨텍스트 캡처 + findUnique select에 `ownerId` 추가 + `canDelete = ctx.isSuperAdmin || space.ownerId === ctx.userId` 계산 → canDelete일 때만 `<DeleteSpaceSection>` 렌더.
- `src/constants/dashboard-copy.ts` (수정) — `DASHBOARD_COPY.SETTINGS.dangerZone` 한글 카피 블록 추가.
- 테스트(신규): `delete-space-section.test.tsx`(16), `settings/page.test.tsx`(6).

### 설계 의도(검증 기준)
1. **권한 게이팅 정합성**: 설정 페이지는 `requireSpaceAdmin`(OWNER/STAFF/superAdmin 통과)이나 삭제는 OWNER/superAdmin만 가능(`DELETE /api/spaces/[id]`: `space.ownerId===userId || isSuperAdmin`, STAFF는 403). 삭제 UI는 이 DELETE 게이트를 **정확히 미러**해야 함 → `ctx.role==="OWNER"`(superAdmin도 OWNER 반환)가 아니라 **`ownerId` 직접 비교**가 옳음. STAFF·비소유자에게 미노출.
2. **서버가 hard gate**: 클라 게이팅/이름확인은 best-effort UX. 서버 DELETE가 재검증.
3. **파괴적 액션 가드**: 이름 정확 일치 시에만 삭제 활성(되돌릴 수 없음·접속자 전원 추방).
4. **성공/멱등/에러 처리**: 200(이미 archived 멱등 200 포함)→redirect. non-ok→서버 에러메시지(또는 기본)·모달 유지·redirect 안 함. 중복 제출 방지.
5. **하드코딩 금지**: 사용자 노출 문자열은 DASHBOARD_COPY 상수.
6. **백엔드/스키마 무변경**: server/·prisma/ 무관(Vercel 전용).

## 능동 실측 지시
- `git show HEAD` / 각 파일 직접 read. base 대비 diff: `git diff 3b17f10..HEAD`.
- 기계게이트 직접 재현 권장: `npx tsc --noEmit`(0 기대) / `npx vitest run`(500 기대, 478→500). 빌드는 `npm run build`(0 기대, 무거움).
- `DELETE /api/spaces/[id]` 계약 확인: `src/app/api/spaces/[id]/route.ts`(WI-036, 응답 `{message, realtimeEnforced}` 200·401·404·403).
- `requireSpaceAdmin` 출력 형태: `src/lib/admin-guard.ts`(`{userId, spaceId, role, isSuperAdmin}`, superAdmin→role:"OWNER").
- `/my-spaces` 목록 갱신 경로: `src/app/my-spaces/page.tsx` → `SpaceListView`(마운트 시 `fetchSpaces`) → `GET /api/spaces`(status=ACTIVE만).

## 적대적 점검 포인트(놓치기 쉬운 결함)
- `canDelete` 미러가 DELETE API 게이트와 정확히 일치하는가. role 기반이면 어떤 엣지에서 어긋나는가(superAdmin·데이터 드리프트 OWNER 멤버 vs ownerId).
- 이름 일치 비교(`confirmInput === spaceName`)의 trim/공백/특수문자/빈 이름 엣지. 가짜 활성/오삭제 가능성.
- 삭제 진행 중 중복 클릭·모달 재오픈으로 DELETE가 2회 발생하는가. router.replace 후 isDeleting 미리셋이 의도적인가(중복 제출 방지) 아니면 버그인가.
- non-ok 응답 파싱(`res.json().catch`) 견고성. 에러 메시지에 민감정보 노출?
- redirect 타겟(`/my-spaces`)이 옳은가. 삭제 후 zustand 스토어 stale로 archived 스페이스가 목록에 남는가(SpaceListView 재마운트 refetch로 해소되는가).
- 모달 접근성(role/aria/포커스/ESC/백드롭 클릭)·진행 중 닫기 차단이 일관적인가.
- 설정 페이지가 STAFF에게 삭제 UI를 노출하지 않는가(클릭 시 403 회피).
- DELETE 호출에 인증/CSRF 등 누락? (동일 출처 fetch·NextAuth 세션 쿠키 기반 — 기존 PATCH와 동일 패턴인가.)
- 테스트가 false-pass인가(게이트 무력화해도 통과하는 약한 오라클?). ownerId-미러 테스트가 role 기반 변이를 잡는가.

각 이슈는 severity/location/description/recommendation/defer/fixNow를 채우세요. 결함이 없으면 issues=[] + verdict=PASS.
