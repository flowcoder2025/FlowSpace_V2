# 블라인드 검증 요청 — WI-011-test (FlowSpace)

당신은 독립 검증자(codex)입니다. **active WI(`.flowset/current.json`)와 git diff(`develop..HEAD`)만 ground truth로** 검토하고, 스키마(`--output-schema`)에 맞는 JSON만 반환하세요. **파일을 수정하지 마세요.**

## 대상 (WI-011-test, P3 테스트 부채)
테스트 전용 변경. 두 영역:
1. `GET /api/spaces` filter 분기 회귀 테스트 + 재사용 가능한 API 라우트 테스트 하니스(auth/prisma mock) 신규 도입.
2. `useScreenRecorder` unmount-during-stopping settle 경로 테스트(WI-006 evaluator P3 흡수).

## 변경 파일 (diff = `git diff develop..HEAD`)
- `src/__tests__/helpers/api-route.ts` (신규) — 순수 빌더: `buildGetRequest`/`buildJsonRequest`/`makeSession`/`makeSpaceRow`/`readJson`.
- `src/app/api/spaces/route.test.ts` (신규) — filter→scope 분기 15케이스.
- `src/features/space/hooks/internal/useScreenRecorder.test.ts` (수정) — unmount 경로 3케이스 추가.
- `.flowset/*` 는 프로세스 원장 (검토 대상 아님).

**소스 코드(route.ts, useScreenRecorder.ts)는 변경하지 않았다** — 테스트만 추가. 즉 테스트가 기존 동작을 정확히 검증하는지가 핵심.

## 검증 관점 (테스트 품질)
- **거짓 통과(false-pass) 위험**: assertion이 실제 동작을 검증하나? mock이 과해서 회귀를 못 잡는 케이스는?
- **커버리지 정합**: filter→scope 분기(owned/joined/null·all × 일반/슈퍼어드민), INVALID_FILTER 400, status:"ACTIVE" 상시 부착, 페이지네이션 take/cursor/skip, cursor에도 scope 보존, 응답 allowlist(inviteCode/accessSecret/ownerId 미노출)가 실제 route 동작과 일치하나?
- **권한 격리 핵심**: `filter=all` + 일반 사용자가 전역이 아닌 멤버십 scope로 제한되는지 검증이 올바른가?
- **하니스 건전성**: `makeSpaceRow` fixture가 Prisma 행 형태/민감필드를 충분히 모사하나? 하니스가 `module-boundaries.test.ts`(cross-module internal import 차단) 게이트를 위반하지 않나?
- **useScreenRecorder unmount 테스트**: (A) settle 테스트가 결정적이고 변이 검출 가능한가? (B) mountedRef 가드 smoke가 false-pass거나 flaky하지 않나?
- 테스트 결정성/flakiness, jsdom 환경 가정.

## 기계 게이트 (이미 통과)
tsc 0 · lint 0 errors · vitest 126/126 (108→126, +18) · next build 0.

## 산출
- 스키마(WI-011-codex-schema.json) 준수 JSON만.
- `reviewer="codex"`, `schemaVersion=1`, `scores=null`, `weightedTotal=null`.
- 각 이슈에 `severity`(P0~P3)·`location`·`description`·`recommendation`·`defer`·`deferRationale`·`fixNow`.
- 실제 결함만. P0/P1 또는 `fixNow:true`가 있으면 게이트 미통과.
