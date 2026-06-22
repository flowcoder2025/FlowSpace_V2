# 블라인드 검증 — WI-023-fix (500 응답 details 정보 노출 일괄 제거)

당신은 FlowSpace의 독립 코드 검증자(codex)입니다. 아래 변경을 read-only로 적대적으로 검토하고, 결함을 P0~P3로 분류해 **출력 스키마(JSON)** 로만 답하세요. 다른 검증자의 산출물을 참조하지 마세요.

## WI 목표
다수 API 라우트가 500 catch 블록에서 `details: error instanceof Error ? error.message : undefined`로 원본 에러 메시지를 클라이언트에 노출(CWE-209)하던 것을 중앙 헬퍼로 일괄 제거.

## 변경 요약 (HEAD = 이 브랜치 최신 커밋)
- 신규 `src/lib/api-error.ts` — `internalErrorResponse(context, error, message)`: 원본 에러는 `console.error`로 서버 로그에만, 클라이언트엔 `NextResponse.json({ error: message }, { status: 500 })`만 반환. `details` 어떤 환경에서도 미반환.
- 26개 API 라우트(`src/app/api/**/route.ts`)의 500 catch 블록 37곳을 `internalErrorResponse("<METHOD> <route path>", error, "<기존 메시지 verbatim>")`로 치환. 기존 메시지 문구 보존, `code` 미추가(응답 키집합 정확히 `{ error }`).
- DB metadata에 저장하는 `error.message`(500 응답 아님 — assets generate/batch의 `metadata.error`)는 의도적으로 미변경.
- 테스트: `src/lib/api-error.test.ts`(헬퍼 유닛 5종) + 대표 라우트 3곳(assets/route.test.ts, assets/[id]/route.test.ts, spaces/route.test.ts)에 500 details 미노출·정확 키집합 단언.

## 검증 관점 (적대적으로)
1. **누출 잔존**: `details: error instanceof Error` 또는 다른 형태로 원본 에러가 클라이언트로 새는 경로가 남았는가? `error` 문자열 외 응답에 민감정보 포함 가능성?
2. **회귀**: 비-500 응답(200/201/400/401/403/404/409 등)이 의도치 않게 바뀌었는가? 응답 계약(`{ error }`)을 소비처/테스트가 기대하는 것과 어긋나는가? `NextResponse` 미사용으로 인한 import 깨짐?
3. **변환 정확성**: 메서드/경로 태그 오류, 메시지 문구 변형, 헬퍼 시그니처 오용, 누락된 500 블록, 잘못 변경된 비-500 블록.
4. **헬퍼 설계**: 서버 로깅이 실제로 디버깅 정보를 보존하는가? 헬퍼가 throw하거나 다른 부작용을 일으키는가? 타입 안전성(`error: unknown`).
5. **테스트 품질**: 단언이 self-referential하거나 false-pass인가? 변이검증(헬퍼에 details 복원 시 FAIL)이 가능한 구조인가?
6. **스코프**: offset 상한 분리가 타당한가(이번 WI 범위 적절성).

## 검증 방법
- 변경 파일 직접 확인: `git -C C:/Team-jane/FlowSpace diff HEAD~1 HEAD` 또는 작업트리 파일 read.
- `rg "details: error instanceof Error" src` 가 0건인지 확인.
- 기계게이트는 오케스트레이터가 실측 통과(tsc0/lint0err/vitest232/build0) — 재실행 불필요하나 코드 논리로 판단.

P0/P1 또는 fixNow:true가 있으면 verdict=FAIL 또는 WARNING. 없고 안전하면 PASS. defer 가능한 P3는 defer=true + deferRationale.
