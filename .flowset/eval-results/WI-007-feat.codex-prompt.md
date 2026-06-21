너는 FlowSpace 듀얼 블라인드 검증의 **codex** 검증자다. evaluator와 상호 블라인드다 — `.flowset/eval-results/WI-007-feat.eval.json`을 읽지 마라.

## Ground truth (이것만)
- ACTIVE WI: `.flowset/current.json` (activeWI=`WI-007-feat`). 수용 기준: `.flowset/fix_plan.md`의 "Active WI" 블록.
- 변경분: `git diff` (working tree). 검토 대상 6개 파일:
  - `scripts/set-super-admin.mjs` (신규)
  - `src/app/api/spaces/route.ts`
  - `src/app/spaces/new/page.tsx`
  - `src/app/my-spaces/page.tsx`
  - `src/components/spaces/space-list-view.tsx`
  - `src/components/layout/navbar.tsx` (전역 navbar '새 스페이스' CTA 데스크톱/모바일 모두 `session.user.isSuperAdmin` 게이팅 — round 2 추가)
  - (`.claude/settings.local.json` 은 본 WI와 무관한 기존 변경 — 무시)

(이것은 round 2 재검증이다. round 1에서 navbar CTA 미게이트 P2가 발견되어 위와 같이 수정됨. 모든 공간 생성 진입점이 게이트됐는지 확인하라.)
- 도메인 불변식: `.claude/rules/*.md`. 분류: `.claude/process/06-issue-taxonomy.md`.

## 이 WI의 특수 맥락 (반드시 평가)
- 이 변경은 사용자 지시로 **`main` 브랜치(현재 WI-001/002 미반영, commit 11b04ac)에 직접 머지**된다. 표준 develop 통합 플로우의 예외.
- 따라서 **핵심 검증 = 자기완결성(merge-to-main safety)**: 이 변경이 main 베이스에서 컴파일/동작하는가? `develop`에만 존재하는 코드(`src/lib/space-role.ts`의 `canActOn`, WI-001/002 산출물 등)에 의존하지 않는가?
- 확인된 사실: `session.user.isSuperAdmin` 인프라(`prisma` `User.isSuperAdmin` 필드, `src/lib/auth.config.ts` jwt/session 콜백, `src/types/next-auth.d.ts`)는 **main에도 동일하게 존재**한다.

## 검증 축
1. 슈퍼어드민 게이팅 정확성: `POST /api/spaces` 403, `/spaces/new` redirect, my-spaces 생성 버튼 노출 제어.
2. 보안: 우회/IDOR/권한 상승/열거 없음. 게이트가 서버측에서 강제되는가(클라이언트 숨김만으로 끝나지 않는가).
3. merge-to-main 자기완결성: develop 전용 심볼/파일 의존 여부.
4. 회귀: 슈퍼어드민의 정상 공간 생성/목록 조회, 기존 역할 위임(`members`/`admin/members` PATCH) 무영향.
5. 라우팅/UX: redirect 루프·빈 상태 문구 정합성.

## 출력
파일을 **수정하지 마라**(read-only). `.claude/process/schemas/review.schema.json`을 **엄격히** 따르는 JSON **하나만** 반환:
- `reviewer`="codex", `schemaVersion`=1, `scores`=null, `weightedTotal`=null.
- `verdict`: P0/P1 있으면 FAIL, P2/P3만 WARNING, 없으면 PASS.
- `issues[]`: 각 항목 severity(P0~P3)·location("파일:라인")·description(증거)·recommendation·defer·deferRationale·fixNow. 결함 없으면 빈 배열.
