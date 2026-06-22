# 설계 협의(적대적) — WI-021 assets 목록 GET 응답 정형화

FlowSpace = Next.js 15 풀스택 + Phaser 메타버스. 너는 Claude(메인)의 **독립 적대 설계 검토자**다. read-only. 산문으로 답하라(스키마 없음). "괜찮다"는 동의보다 **깨질 시나리오·놓친 누출**을 찾는 게 임무다. 합의/반대를 명확히.

## 배경 (직전 WI-019, 머지 완료)
`GET /api/assets/[id]`(상세, owner/superAdmin 게이트)가 raw `GeneratedAsset` 전체 행을 반환하던 것을 `select` + 공개 DTO `toPublicGeneratedAsset`로 정형화했다. 핵심 교훈: 민감 3필드(`prompt`/`workflow`/`comfyuiJobId`)가 `metadata`(Json) 컬럼에도 **중복 저장**(generate/batch 라우트가 `GeneratedAssetMetadata` 전체를 JSON으로 저장)되므로 top-level allowlist만으론 부족 → metadata도 `PUBLIC_METADATA_KEYS`(width,height,frameWidth,frameHeight,columns,rows,format,seed,generatedAt,processingTime,error)로 정규화.

`toPublicGeneratedAsset(asset)` 반환 키: `{ id, type, name, status, filePath, thumbnailPath, fileSize, isShared, metadata(allowlisted), createdAt, updatedAt, user:{id,name} }` — userId는 입력에 있어도 응답 미포함. (`features/assets/internal/public-asset.ts`, 배럴 export)

## WI-021 대상 (목록 라우트, 별 라우트)
`GET /api/assets` (`src/app/api/assets/route.ts`). 현재 핵심 코드:

```ts
const where: Record<string, unknown> = {};
if (shared === "true") {
  where.isShared = true;          // ← 타인 공유 자산까지 조회
} else {
  where.userId = session.user.id; // 본인 자산만
}
if (type) where.type = type.toUpperCase();
if (status) where.status = status.toUpperCase();

const [assets, total] = await Promise.all([
  prisma.generatedAsset.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
    select: {
      id: true, type: true, name: true,
      prompt: true,            // ← 🔴 민감 필드 누출 (특히 shared 분기 = 타인 prompt)
      status: true, filePath: true, thumbnailPath: true,
      createdAt: true, updatedAt: true,
    },
  }),
  prisma.generatedAsset.count({ where }),
]);
return NextResponse.json({ assets, pagination: { page, limit, total, totalPages } });
```

**`GeneratedAsset` 스칼라**: id, userId, type, name, prompt(@db.Text), workflow, status, metadata(Json?), filePath, thumbnailPath, fileSize, comfyuiJobId, isShared, createdAt, updatedAt + user{id,name}.

## 실측 소비처 (목록 라우트 `GET /api/assets` 만, grep 전수)
1. `src/features/space/game/internal/asset-loader.ts` `fetchGeneratedAssets()` → `createLoadableAssets(data.assets)`: 각 asset의 **`id`, `type`, `filePath`, `metadata?.frameWidth`, `metadata?.frameHeight`** 소비. **단, 현재 목록 select에 `metadata`가 없어** `meta = asset.metadata || {}` → `(meta.frameWidth as number) || 64` 로 **항상 64 폴백** 중(CHARACTER frame).
2. `src/components/space/editor/asset-palette.tsx` `CompletedAsset`: **`id`, `type`, `name`, `thumbnailPath`, `filePath`** 소비.
- 상세 `/api/assets/[id]` 소비처(sprite-generator, game-loader)는 별 라우트라 WI-021 범위 밖.
- 과거 `/assets` 페이지는 제거됨(specs `_index.md`) — 위 2곳이 유일 라이브 소비처.

## 질문 1 — DTO 전략: lean vs 재사용 (핵심)
두 안의 트레이드오프:

**안 A (lean 목록 DTO / 그냥 `prompt`만 select에서 제거)**: 응답 `{ id, type, name, status, filePath, thumbnailPath, createdAt, updatedAt }`(현행에서 prompt만 제거). 동작 무변·신규 노출 0·무회귀 확실. 단 상세 라우트와 응답 shape 불일치, metadata 미반환 유지.

**안 B (`toPublicGeneratedAsset` 전체 재사용)**: 상세와 동일 shape. 단 부작용 2가지 — (1) `metadata`가 목록에 추가됨 → game-loader가 frameWidth를 64 폴백 대신 **실제 metadata.frameWidth(예: 128)로 읽기 시작** = **렌더링 동작 변경**(보안 수정의 부수효과). (2) `shared=true` 분기는 타인 공유 자산 목록이므로 `user:{id,name}`(타인 표시명/ID) + metadata(seed/generatedAt 등)가 **신규로 외부 노출**됨(현행 목록은 user/metadata 미반환).

내 잠정 결론: **안 A 우선**(보안 수정은 동작 보존이 원칙, shared 분기 신규 노출 회피). 단 상세와의 일관성·metadata frameWidth 정확성을 잃는다. 동의/반대와 근거. 제3안(예: lean DTO인데 metadata만 allowlisted로 포함해 frameWidth 복원)이 더 나은가, 아니면 그건 scope creep인가?

## 질문 2 — `shared=true` 분기의 올바른 필드 경계
목록은 owner 게이트가 아니라 `isShared=true`면 **누구나 타인 자산을 조회**한다(아바타 선택 등 의도된 공유). 이 분기에서:
- `user:{id,name}`(생성자 표시명) 노출이 정보위생상 허용되나, 아니면 목록에선 빼야 하나?
- metadata(allowlisted: seed/generatedAt/width 등) 타인 노출이 문제되나?
- shared 분기에만 더 타이트한 필드 집합을 적용하는 게 과한가, 아니면 owner 분기 vs shared 분기를 **동일 DTO로 통일**하는 게 맞나?

## 질문 3 — 회귀/엣지
- `prompt` 제거 시 두 소비처 타입 선언(`CompletedAsset`, `createLoadableAssets` 입력)은 prompt 미사용이라 무회귀 맞나? 빠뜨리면 안 되는 소비 필드 있나?
- 응답 정형화 외에 이 라우트의 선재 결함(예: `type.toUpperCase()`로 enum 무검증 주입, page/limit 무상한 — WI-010 spaces cursor와 달리 offset pagination)도 WI-021에 포함해야 하나, 아니면 별 WI로 분리?
- 테스트는 WI-019 패턴(`makeAssetSelectRow` fixture + exact-key-set allowlist 단언 + 민감필드 미노출 + select 인자 단언)을 목록 라우트에 미러링하면 충분한가?

## 질문 4
**내가 놓칠 위험 1가지**를 반드시 지적하라(설계·보안·회귀 어느 쪽이든).

각 항목 간결하게.
