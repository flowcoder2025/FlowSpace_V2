# 설계 협의 (consult) — WI-008-fix: WI-007 듀얼검증 P3×2 해소

당신은 시니어 리뷰어다. 아래 WI-008-fix 구현 계획을 검토하고, **내가 놓친 위험 1가지 이상**을 반드시 지적하라. 산문으로 간결히 답하라.

## 배경
FlowSpace = Next.js 15 풀스택 + Phaser. WI-007(스페이스 생성 슈퍼어드민 전용 제한)의 evaluator 듀얼검증에서 defer된 P3 2건을 해소하는 정리 WI다. 기능 결함이 아닌 방어적 UX/일관성 부채.

프로젝트 규칙 app.md invariant #4: API 에러 응답은 `{ error: string, code?: string }` 형식 통일.

## 결함 1: `scripts/set-super-admin.mjs:36` 회수 인자 파싱
현재:
```js
const next = process.argv[3] !== "false"; // 기본 true, 'false' 명시 시에만 회수
```
문제: 정확히 문자열 `"false"`만 회수로 인정. 오타(`flse`, `False`, `0`)는 조용히 부여(true)로 처리됨.

용법(파일 헤더): `node scripts/set-super-admin.mjs <email> [true|false]` (기본 부여, false 명시 시 회수) + `--list`.

### 내 계획
3번째 인자를 명시적으로 검증:
- 인자 없음 → 기본 `true`(부여) 유지 (용법 문서와 일치)
- `"true"` → 부여, `"false"` → 회수
- 그 외 임의 문자열 → usage 출력 후 `process.exitCode = 1`, DB 조작 없이 즉시 반환
- (alias `grant`/`revoke` 추가 허용은 과한가? true/false만으로 충분한가?)

## 결함 2: `src/app/api/spaces/route.ts:86-91` POST 403 `code` 필드 누락
현재:
```ts
if (session.user.isSuperAdmin !== true) {
  return NextResponse.json(
    { error: "Only superAdmin can create spaces" },
    { status: 403 }
  );
}
```
문제: app.md invariant #4의 `code` 필드 없음. 같은 파일 GET의 400은 이미 `code: "INVALID_FILTER"` 병기.

### 내 계획
```ts
return NextResponse.json(
  { error: "Only superAdmin can create spaces", code: "FORBIDDEN_NOT_SUPERADMIN" },
  { status: 403 }
);
```
- 클라이언트 `create-space-form.tsx:49`는 `data.error`를 그대로 표시. 이 폼은 `/spaces/new` 페이지가 비-슈퍼어드민을 서버 redirect로 차단하므로 정상 흐름에서 도달 불가(403은 직접 POST/race에서만 발생).
- 질문: 클라이언트를 `code` 분기로 바꿔야 하나, 아니면 서버 `code` 병기만으로 충분한가? (P3 정리이므로 스코프 최소가 원칙)

## 스코프 질문
같은 route.ts에 `code` 없는 다른 4xx가 다수 존재(401 Unauthorized, POST 400 name/templateKey, POST 404 Template not found). invariant #4는 `code?` (선택)이라 강제 아님. WI-008 스코프를 **403 1건으로 한정**하고 나머지는 별도 WI로 두는 게 맞는가, 아니면 이 기회에 일괄 정합하는 게 맞는가?

## 코드명 컨벤션
기존 코드는 `INVALID_FILTER` (SCREAMING_SNAKE). 403 코드명으로 `FORBIDDEN_NOT_SUPERADMIN` 적절한가, 더 나은 컨벤션이 있는가?
