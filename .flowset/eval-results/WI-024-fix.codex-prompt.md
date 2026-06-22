# 블라인드 검증 — WI-024-fix (assets metadata.error 정보 노출 차단, CWE-209)

당신은 FlowSpace의 독립 코드 검증자(codex)입니다. 아래 변경을 read-only로 적대적으로 검토하고, 결함을 P0~P3로 분류해 **출력 스키마(JSON)** 로만 답하세요. 다른 검증자(evaluator)의 산출물을 참조하지 마세요.

## WI 목표
비동기 에셋 생성 실패 시 raw `error.message`(ComfyUI 내부 URL·로컬 파일 경로·프롬프트/스택 단편 포함 가능)가 `GeneratedAsset.metadata.error`에 저장되고, WI-019에서 도입한 응답 allowlist `PUBLIC_METADATA_KEYS`(`'error'` 포함)를 거쳐 `GET /api/assets/[id]`(owner/superAdmin 게이트) 응답으로 도달하던 정보 노출(CWE-209, WI-023과 동일 클래스)을 차단.

## 설계 결정 (codex consult 1R 수렴 — C안 = A+B)
B(저장 정규화) 단독은 **기존 DB 행이 이미 raw `metadata.error`를 보유**해 불완전(generate/batch만 고쳐도 과거 행이 응답에 새 나감) → A(응답 allowlist 제외)로 기존·신규 행 모두 응답 계층 차단이 필수.

## 변경 요약 (HEAD = `3cd7d04`, 직전 develop merge `b788009`)
- **A** `src/features/assets/internal/public-asset.ts`: `PUBLIC_METADATA_KEYS`에서 `'error'` 제거. 기존 raw 행도 즉시 응답 차단(`toPublicMetadata`가 allowlist 키만 골라 반환하므로 error는 더 이상 포함되지 않음). 폴링 계약은 `status`(FAILED)로 충분.
- **B** `src/app/api/assets/generate/route.ts` + `src/app/api/assets/batch/route.ts`의 fire-and-forget `.catch`: raw error는 `console.error("[POST /api/assets/...]", error)`로 **서버 로그에만**, DB엔 generic `GENERATION_FAILURE_MESSAGE`(="Asset generation failed") 저장. batch는 `{ batchId, error: GENERATION_FAILURE_MESSAGE }`(batchId 보존).
- 상수 `GENERATION_FAILURE_MESSAGE`를 `src/features/assets/internal/constants.ts`에 정의, `src/features/assets/index.ts` 배럴 노출(하드코딩 회피).
- **백필** `scripts/backfill-failed-asset-error.mjs`: 기존 FAILED 행의 raw metadata.error를 generic으로 치환(dry-run 기본, `--apply`로만 적용, 멱등 — 이미 generic/error 키 없는 행 스킵, error 키만 치환·batchId 등 보존). prod 적용은 사용자 게이트.
- **테스트 +6**: `public-asset.test.ts` L170 "보존"→"공개되지 않음(차단)" 뒤집기 + generic도 제거 단언 + `PUBLIC_METADATA_KEYS` forbidden 키에 `error` 추가. `generate/route.test.ts`(신규 3) + `batch/route.test.ts`(신규 2): 실패 경로가 raw error.message 미저장·generic 정규화·console.error로 raw 보존·비-Error 거부값도 generic.

## 검증 관점 (적대적으로)
1. **누출 잔존**: metadata.error 외 raw 내부 정보가 `GET /api/assets/[id]` 또는 목록/배치 상태 응답으로 새는 경로가 남았는가? `PUBLIC_METADATA_KEYS`의 다른 키(processingTime/seed/generatedAt 등)에 민감 정보가 실릴 가능성? `toPublicMetadata`/`toPublicAssetListItem`/배치 GET select가 raw 노출하나?
2. **기존 행 차단 완전성**: A가 정말 기존 raw 행을 응답에서 차단하는가? metadata가 배열/비객체/null인 엣지에서 깨지지 않는가?
3. **저장 정규화 정확성(B)**: generate/batch `.catch`가 raw를 절대 저장하지 않는가? `.catch` 내부 `prisma.update`가 reject하면(2차 실패) 새 raw 누출/unhandled rejection이 생기나(선재 동작 대비 회귀 여부)? console.error가 raw 보존하는가?
4. **회귀**: 성공(202/COMPLETED) 경로·소비처(game-loader/sprite-generator/asset-loader, 배치 GET 폴링)가 깨지는가? metadata.error를 읽는 런타임 소비처가 실제로 없는가(있다면 폴링 계약 회귀)? 응답 키집합 변화가 클라를 깨뜨리나?
5. **백필 스크립트 안전성**: 멱등성(재실행)·dry-run 기본·error 키만 치환(batchId 보존)·비객체 metadata 가드가 올바른가? 운영 위험?
6. **테스트 품질**: 단언이 self-referential/false-pass인가? 변이검증(allowlist에 error 복원/저장을 raw로 되돌리면 FAIL)이 가능한 구조인가? fire-and-forget `.catch`를 `vi.waitFor`로 검증하는 방식이 견고한가(플래키)?
7. **스코프**: codex consult가 지목한 "성공 경로 metadata 전체 저장면 확대(향후 필드 추가 시)"를 이번 WI에서 다루지 않고 후속으로 분리한 것이 타당한가?

## 검증 방법
- 변경 직접 확인: `git -C C:/Team-jane/FlowSpace diff b788009 HEAD` 또는 작업트리 파일 read.
- `rg "error instanceof Error \? error.message" src/app/api/assets` 0건 확인.
- `rg "metadata\\.error" src` 로 실제 읽기 소비처 유무 확인.
- 기계게이트는 오케스트레이터가 실측 통과(tsc0/lint0err/vitest238/build0) — 재실행 불필요, 코드 논리로 판단.

P0/P1 또는 fixNow:true가 있으면 verdict=FAIL 또는 WARNING. 없고 안전하면 PASS. defer 가능한 P3는 defer=true + deferRationale.
