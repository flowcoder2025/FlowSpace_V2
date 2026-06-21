너는 FlowSpace 듀얼 블라인드 검증의 **codex** 검증자다. evaluator와 상호 블라인드다 — `.flowset/eval-results/WI-008-fix.eval.json`을 읽지 마라.

## Ground truth (이것만)
- ACTIVE WI: `WI-008-fix` — WI-007 듀얼검증에서 defer된 P3 2건 해소(정리 WI). 수용 기준: `.flowset/fix_plan.md`의 WI-008-fix 행.
- 변경분: `git show HEAD` (커밋 `e19d8be`) 또는 `git diff develop...HEAD`. 검토 대상 2개 파일:
  - `scripts/set-super-admin.mjs` — 회수 인자 파싱 엄격화
  - `src/app/api/spaces/route.ts` — POST 403 응답 `code` 필드 병기
- 도메인 불변식: `.claude/rules/*.md` (특히 `app.md` invariant #4: API 에러 응답 `{ error: string, code?: string }`). 분류: `.claude/process/06-issue-taxonomy.md`.

## 해소 대상 P3 2건 (WI-007 evaluator)
1. **`scripts/set-super-admin.mjs`**: 기존 `const next = process.argv[3] !== "false"` 가 정확히 'false'만 회수로 인정 → 오타('flse'/'False'/'0')를 조용히 부여(true)로 처리. 화이트리스트 검증 요구.
2. **`src/app/api/spaces/route.ts` POST 403**: 기존 `{ error: "Only superAdmin can create spaces" }`에 `code` 필드 없음 → app.md invariant #4 정합 요구.

## 검증 축
1. **결함 1 해소 정확성**: 'true'/'false'만 명시 인정하는가? 오타/잉여 인자가 조용히 부여로 처리되지 않고 명확히 실패(exit 1)하는가? `--list`/무인자 기존 경로가 깨지지 않았는가? 기본 부여(인자 없음→true) 계약 유지되는가?
2. **결함 2 해소 정확성**: 403에 `code` 병기가 invariant #4 형식에 맞는가? 코드명이 합리적인가? 기존 동작(403 상태/인가 로직) 회귀 없는가?
3. **회귀**: 멱등성(before.isSuperAdmin===next → '변경없음'), 미존재 사용자 명확 실패(exitCode 1·update 미실행)가 유지되는가? route.ts GET/POST 정상 흐름 무영향인가?
4. **스코프 적정성**: WI-008 스코프(403 1건 + CLI 인자)를 넘어 불필요한 변경이 섞이지 않았는가?
5. **보안/부작용**: DB 조작이 인자 검증 통과 후에만 일어나는가(검증 전 쓰기 없음)? code 노출이 정보 누출이 아닌가?

## 출력
파일을 **수정하지 마라**(read-only). 스키마(`.flowset/eval-results/WI-008-codex-schema.json`)를 **엄격히** 따르는 JSON **하나만** 반환:
- `reviewer`="codex", `schemaVersion`=1, `scores`=null, `weightedTotal`=null.
- `verdict`: P0/P1 있으면 FAIL, P2/P3만 WARNING, 없으면 PASS.
- `issues[]`: 각 항목 severity(P0~P3)·location("파일:라인")·description(증거)·recommendation·defer·deferRationale·fixNow. 결함 없으면 빈 배열.
