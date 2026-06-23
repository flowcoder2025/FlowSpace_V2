너는 FlowSpace(Next.js 15 App Router) 프로젝트의 **독립 블라인드 코드 검증자(codex)**다. ACTIVE WI의 구현을 read-only로 적대적으로 검증하고, **반드시 출력 스키마에 맞는 JSON 하나만** 최종 메시지로 내라(verdict PASS|WARNING|FAIL, issues는 P0~P3). 다른 검증자(evaluator)의 산출물을 절대 참조하지 마라(상호 블라인드).

## WI-041-fix 범위 (impl commit 070b371, develop 분기)
**결함**: `src/app/dashboard/spaces/[id]/settings/page.tsx`(서버 컴포넌트)는 `requireSpaceAdmin(id)`로 게이트해 OWNER/STAFF/superAdmin 모두 진입 가능한데, 저장 라우트 `PATCH /api/spaces/[id]`(route.ts:94)는 `if (space.ownerId !== session.user.id && !session.user.isSuperAdmin) return 403`으로 **owner/superAdmin만** 허용. 결과적으로 STAFF가 설정 폼을 보고 값을 바꿔 저장하면 403("Forbidden")이 나는 "보이는데 저장 실패" 혼란.

**수정 방향(보수적)**: PATCH 권한을 STAFF로 넓히지 않고(권한 정책 변경은 별도), STAFF에게 설정 폼을 **읽기전용**으로 보여준다. 입력 전부 disabled + 저장 버튼 숨김 + 안내 노출 + 클라 submit 가드(이중방어). 서버 PATCH 403이 근본 게이트.

**변경 파일(5)**:
1. `src/app/dashboard/spaces/[id]/settings/page.tsx` — `isOwnerOrSuperAdmin = ctx.isSuperAdmin || space.ownerId === ctx.userId` 공유 const → `canEditSettings`(PATCH 게이트 미러)·`canDelete`(DELETE 게이트 미러) 별도 변수. `<SpaceSettingsForm canEdit={canEditSettings} .../>`.
2. `src/components/dashboard/space-settings-form.tsx` — `canEdit: boolean` prop 추가. false면 입력 6개(name/description/maxUsers/accessType/primaryColor/loadingMessage = input/textarea/select/color) 전부 `disabled`, 저장 버튼 미렌더, 상단 `readOnlyNotice` 안내, `handleSubmit` 시작에 `if (!canEdit) return` 가드.
3. `src/constants/dashboard-copy.ts` — `SETTINGS.readOnlyNotice` 한글 카피.
4. `src/app/dashboard/spaces/[id]/settings/page.test.tsx` — canEdit 게이팅 4 케이스(owner→true·superAdmin→true·STAFF→false·드리프트 OWNER[ownerId 불일치·비-super]→false).
5. `src/components/dashboard/space-settings-form.test.tsx`(신규) — canEdit=false: 안내 노출·저장버튼 미렌더·입력 6개 전수 disabled·submit 시 fetch 미호출 / canEdit=true: 안내 미노출·저장버튼 렌더·입력 enabled·PATCH 호출+성공메시지.

## 검증 관점 (적대적으로)
- **게이트 정합**: `canEditSettings` 표현식이 PATCH 라우트 게이트(`ownerId===userId || isSuperAdmin`)의 정확한 미러인가? STAFF가 어떤 경로로든 편집/저장에 도달할 수 있나? 데이터 드리프트(role=OWNER이나 ownerId 불일치) 시 일관된가?
- **입력 전수 차단**: 입력 계열(input/textarea/select/color/저장버튼) 중 canEdit를 안 타는 게 하나라도 있나? 하나라도 빠지면 STAFF가 일부 값 편집 가능.
- **이중방어**: handleSubmit 가드가 Enter 제출·disabled 누락 등에도 PATCH를 막나? 서버 403이 근본인가?
- **회귀**: 기존 owner 편집 플로우(PATCH 호출·성공/에러 메시지)는 무회귀인가? `canEdit` 필수 prop 추가로 다른 호출부가 깨지나(유일 호출부=settings/page)?
- **경계/하드코딩/카피**: 하드코딩 문자열(영문 누출 포함) 없나? readOnlyNotice가 카피 SoT를 타나?
- **범위**: server/·prisma/ 무변경(Vercel 전용)이 맞나?

## 기계 게이트 (권위 환경 실측)
tsc 0 errors / eslint 0 errors(선재 LiveKit 경고1·WI무관) / vitest 550→561(+11) 전부 통과 / next build exit 0.
주의: 이 샌드박스가 read-only라 vitest child process spawn이 EPERM으로 막힐 수 있다. 그건 **환경 제약(P3)**이지 구현 결함이 아니다. tsc/lint/코드 인스펙션으로 판정하라.

코드를 직접 읽고 적대적으로 판정해라.
