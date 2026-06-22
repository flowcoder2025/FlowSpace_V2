# 블라인드 적대 검증 — WI-021-fix

너는 독립 검증자다. FlowSpace(Next.js 15 + Phaser)의 WI-021 구현을 read-only로 적대적으로 검증하고 **review.schema.json(oneOf-free 변형)** 형식 JSON으로만 답하라(`-o` 출력이 권위). `scores`/`weightedTotal`은 `null`로 둔다. 다른 검증자(evaluator) 산출물을 절대 참조하지 마라.

## 변경 범위 (base=develop, head=HEAD)
`git diff develop...HEAD` 로 확인. 코드 변경:
- `src/app/api/assets/route.ts` (GET 목록 핸들러)
- `src/features/assets/internal/public-asset.ts` (신규 lean DTO `toPublicAssetListItem` 추가)
- `src/features/assets/index.ts` (배럴 export 추가)
- `src/app/api/assets/route.test.ts` (신규 라우트 테스트 12)
- `.flowset/fix_plan.md` (원장 — 코드 아님)

## WI-021 목표 (목록 응답 allowlist 정형화 — 보안/정보위생)
`GET /api/assets`(목록)가 `select`에 `prompt: true`를 포함해 raw 행을 그대로 반환하던 것을 lean 전용 DTO(`toPublicAssetListItem`)로 정형화. 핵심: 이 라우트의 `shared=true` 분기는 **owner 게이트 없이 타인의 공유 자산(`isShared=true`)을 누구에게나 반환**하므로 상세 라우트(WI-019, owner-gated)보다 노출 표면이 넓다.

**설계(codex consult 반영)**: 상세용 `toPublicGeneratedAsset` 전체 재사용을 **의도적으로 회피**했다. 재사용 시 (a) `metadata`가 목록에 추가되어 game-loader frameWidth 폴백(64) 동작이 실측값으로 바뀌고(보안 수정의 부수효과), (b) `shared=true` 분기에서 타인 `user{id,name}`·metadata가 신규 노출된다. 따라서 목록은 lean 키만(`id,type,name,status,filePath,thumbnailPath,createdAt,updatedAt`) 반환하고, `prompt`/`workflow`/`comfyuiJobId`(민감)·`metadata`·`user`·`userId`는 select·응답 모두에서 제외(쿼리 단 + transform 이중 방어).

## 실측 소비처 (목록 `GET /api/assets` 만)
1. `src/features/space/game/internal/asset-loader.ts` `createLoadableAssets`: `id`/`type`/`filePath`/`metadata?.frameWidth`/`metadata?.frameHeight`. **단 현재 목록은 metadata 미반환이라 항상 64 폴백 = 기존 동작.**
2. `src/components/space/editor/asset-palette.tsx` `CompletedAsset`: `id`/`type`/`name`/`thumbnailPath`/`filePath`.
- 상세 `/api/assets/[id]` 소비처(sprite-generator/game-loader)는 별 라우트 = 범위 밖.

## 검증 관점 (적대적으로)
1. **정보 누출**: 응답에 `prompt`/`workflow`/`comfyuiJobId`/`userId`/`metadata`/`user`/`accessSecret`류가 새는 경로가 남아 있나? 특히 `shared=true`에서 타인 자산의 민감/소유자 정보가 노출되나? lean DTO가 충분히 타이트한가, 빠뜨린 누출 표면이 있나?
2. **회귀**: 두 라이브 소비처가 쓰는 필드가 보존되나? `metadata` 제거로 game-loader가 깨지나(→ 아니다: 현재도 metadata 미반환·64 폴백이 기존 동작인지 확인)? 응답 shape 변경(`assets[i]`에서 prompt 제거 + 키 축소)이 소비처 타입과 충돌하나?
3. **설계 타당성**: lean DTO 분리 vs `toPublicGeneratedAsset` 재사용 — 보안 수정으로서 동작 보존 원칙이 맞나? shared 분기 신규 노출 회피가 옳나? scope(선재 결함 `type.toUpperCase()` enum 무검증·`limit` 무상한·offset pagination 분리)이 타당한가, 아니면 WI-021에 포함했어야 하나?
4. **테스트 품질**: 회귀 테스트가 실제 누출을 잡나(변이검증 가능한가)? owner/shared 두 분기를 모두 커버하나? exact-key-set 단언이 allowlist를 lock하나? select 인자 단언이 쿼리 단 방어를 lock하나? false-pass 없나?
5. **경계/캡슐화**: lean DTO가 `features/assets/internal/`에 있고 배럴로만 노출되나, 라우트가 배럴 경유 import하나.

## 출력
- `verdict`: PASS | WARNING | FAIL
- `issues[]`: severity(P0~P3)/location/description/recommendation/defer/deferRationale/fixNow
- 실결함이면 `fixNow:true`. P3 위생/심층방어는 defer 가능. **놓친 누출 경로가 있으면 반드시 적출하라.**
