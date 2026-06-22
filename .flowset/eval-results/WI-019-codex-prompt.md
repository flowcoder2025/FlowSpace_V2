# 블라인드 적대 검증 — WI-019-fix

너는 독립 검증자다. FlowSpace(Next.js 15 + Phaser)의 WI-019 구현을 read-only로 적대적으로 검증하고 **review.schema.json(oneOf-free 변형)** 형식 JSON으로만 답하라(`-o` 출력이 권위). `scores`/`weightedTotal`은 `null`로 둔다. 다른 검증자 산출물을 참조하지 마라.

## 변경 범위 (base=develop, head=HEAD)
`git diff develop...HEAD` 로 확인. 변경 파일:
- `src/app/api/assets/[id]/route.ts` (GET 핸들러)
- `src/features/assets/internal/public-asset.ts` (신규 순수 헬퍼)
- `src/features/assets/internal/public-asset.test.ts` (신규 테스트)
- `src/app/api/assets/[id]/route.test.ts` (신규 라우트 테스트)
- `src/features/assets/index.ts` (배럴 export 추가)

## WI-019 목표 (응답 allowlist 정형화 — 보안/정보위생, P3급 하드닝)
`GET /api/assets/[id]`가 `prisma.generatedAsset.findUnique({ include })`로 raw GeneratedAsset 전체 행을 그대로 JSON 반환하던 것을 `select` + 공개 DTO(`toPublicGeneratedAsset`)로 정형화. owner/superAdmin 게이트 하의 본인 소유 메타지만 WI-014(spaces 응답 allowlist)와 동일 클래스.

**핵심 설계(codex consult 반영)**: 민감 필드 `prompt`/`workflow`/`comfyuiJobId`가 **`metadata`(Json) 컬럼에도 중복 저장**된다(`generate/route.ts:90`·`batch/route.ts:79`가 `GeneratedAssetMetadata` 전체를 JSON 저장). 따라서 top-level allowlist만으로는 부족 → `PUBLIC_METADATA_KEYS` allowlist로 metadata도 정규화. `userId`는 권한판정용으로 select하되 응답 DTO에는 미포함.

## 검증 관점 (적대적으로)
1. **정보 누출**: 응답에 `prompt`/`workflow`/`comfyuiJobId`/`userId`/`accessSecret`류가 top-level **또는 metadata 내부**로 새는 경로가 남아 있나? `PUBLIC_METADATA_KEYS` allowlist가 충분히 타이트한가, 혹은 빠뜨린 민감 키가 있나?
2. **회귀**: 실제 소비처(`game-loader.ts`=filePath/type/name/metadata, `sprite-generator.ts`=filePath/metadata.frameWidth·frameHeight, `scripts/test-chibi-generation.ts`=status/filePath/metadata.error)가 쓰는 필드가 전부 보존되나? DTO 키 누락으로 런타임 깨지는 필드 있나?
3. **정확성**: `toPublicMetadata`의 null/배열/문자열/객체 분기, FAILED(`{error}`)·PENDING(null)·COMPLETED 케이스. select 인자 정확성(권한판정 userId 유지). 404/403/401/500 가드 보존.
4. **테스트 품질**: 회귀 테스트가 실제로 누출을 잡나(변이검증 가능한가), false-pass 없나, 정확 키집합 단언이 allowlist를 lock하나?
5. **경계/캡슐화**: 헬퍼가 `features/assets/internal/`에 있고 배럴로만 노출되나, 라우트가 배럴 경유 import하나.

## 출력
- `verdict`: PASS | WARNING | FAIL
- `issues[]`: severity(P0~P3)/location/description/recommendation/defer/deferRationale/fixNow
- 실결함이면 `fixNow:true`. P3 위생/심층방어는 defer 가능. **놓친 누출 경로가 있으면 반드시 적출하라.**
