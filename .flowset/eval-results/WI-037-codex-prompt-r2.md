블라인드 코드 검증 (r2) — WI-037-feat: 설정 화면 스페이스 삭제 UI

당신은 독립 적대 검증자입니다. r1에서 당신이 fixNow=true로 지목한 P3(빈 이름 스페이스에서 빈 입력이 즉시 일치해 삭제 무타이핑 활성)를 해소한 r2 HEAD를 read-only로 재검증하세요. 출력 스키마에 맞춰 JSON으로만 답하세요(verdict PASS|WARNING|FAIL, issues P0~P3 + defer/deferRationale/fixNow). 다른 검증자 산출물 미참조.

## r2 변경 (HEAD = `git show HEAD`)
- `src/components/dashboard/delete-space-section.tsx`: `canConfirm`에 `spaceName.length > 0` 선행 가드 추가 → 빈 이름 스페이스에서 빈 입력("")이 일치해도 삭제 비활성.
- 회귀 테스트 +1: 빈 이름 → 버튼 비활성·DELETE 미발생.

## r1 잔여(검토)
- focus-trap/focus-restore 미보강(당신이 r1에서 fixNow=false로 분류). 기존 코드베이스 모달(`src/components/space/avatar-editor-modal.tsx`)은 role=dialog·aria·ESC조차 없음 — 본 모달이 이미 상위 a11y. Radix Dialog(@radix-ui/react-dialog 의존성 존재)로의 전환은 hand-rolled 모달 패턴과 불일치 → 코드베이스 전역 a11y 후속으로 분리 판단. 동의 여부 평가.

## 전체 변경 범위 (base = develop `3b17f10`)
- `src/components/dashboard/delete-space-section.tsx` (신규) — 위험 구역 + 이름 타이핑 확인 모달 → DELETE /api/spaces/[id] → router.replace("/my-spaces"). 에러 모달 유지. ESC·중복제출 방지·진행 중 닫기 차단.
- `src/app/dashboard/spaces/[id]/settings/page.tsx` — findUnique select ownerId 추가 + `canDelete = isSuperAdmin || ownerId===userId` 게이팅(STAFF 미노출).
- `src/constants/dashboard-copy.ts` — dangerZone 카피.
- 테스트: delete-space-section.test.tsx(17), settings/page.test.tsx(6).

## 실측 지시
- `git show HEAD` + `git diff 3b17f10..HEAD`. `npx tsc --noEmit`(0) / `npx vitest run`(501 기대).

## 점검
- 빈 이름 가드가 정확히 닫혔는가(length>0 선행). 다른 엣지(공백-only 이름 등) 잔존?
- 잔여 결함이 없으면 issues=[] + verdict=PASS. 남은 건 defer 가능 P3인지 판정.
