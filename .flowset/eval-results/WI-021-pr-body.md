## WI-021-fix — assets 목록 GET 응답 lean DTO 정형화

### 문제
`GET /api/assets`(목록)가 `select`에 `prompt: true`를 포함해 raw 행을 그대로 반환. 내부/민감 필드(`prompt`)가 응답으로 노출됨. **핵심: 이 라우트의 `shared=true` 분기는 `where.isShared=true`로 owner 게이트 없이 타인의 공유 자산을 누구에게나 반환** → 상세 라우트(WI-019, owner-gated)보다 노출 표면이 넓다. WI-019 동일 클래스·별 라우트 — WI-019 evaluator P3 defer 흡수.

### 해결
- 신규 lean 전용 DTO `toPublicAssetListItem` (`features/assets/internal/public-asset.ts`) + 배럴 export. 응답 8키: `id,type,name,status,filePath,thumbnailPath,createdAt,updatedAt`.
- 라우트: `select`에서 `prompt` 제거(쿼리단 방어) + `assets.map(toPublicAssetListItem)`(응답단 방어). `prompt`/`workflow`/`comfyuiJobId`(민감)·`metadata`·`user`·`userId` 이중 제외(우발적 select 확장에도 응답 키 집합 고정).
- **설계(codex consult 적출)**: 상세용 `toPublicGeneratedAsset` 전체 재사용을 **의도적으로 회피**. 재사용 시 (a) `metadata`가 목록에 추가돼 game-loader frameWidth 폴백(64)이 실측값으로 바뀌고(보안 수정의 부수효과 = 렌더링 동작 변경), (b) `shared=true`에서 타인 `user{id,name}`·metadata(seed/generatedAt 등)가 신규 노출. **목록(공유 분기 owner 게이트 없음)과 상세(owner-gated)는 권한 경계가 달라 응답 DTO 통일이 누출 회귀를 쉽게 만든다 → lean 분리.**

### 무회귀 근거 (목록 소비처 실측, grep 전수)
- `src/features/space/game/internal/asset-loader.ts` `createLoadableAssets`: `id`/`type`/`filePath`/`metadata.frameWidth`·`frameHeight` → 보존. **현재도 목록은 metadata 미반환이라 항상 64 폴백이 기존 동작** → metadata 제거가 game-loader를 깨지 않음.
- `src/components/space/editor/asset-palette.tsx` `CompletedAsset`: `id`/`type`/`name`/`thumbnailPath`/`filePath` → 보존.
- 상세 `/api/assets/[id]` 소비처(sprite-generator/game-loader)는 별 라우트 = 범위 밖.

### 검증
- 기계게이트 4/4: tsc 0 / lint 0(선재 LiveKit 경고1·WI무관) / vitest **204·204**(192→204, +12) / build 0
- 회귀 테스트 12(`route.test.ts` 신규): owner/shared 두 분기 exact-key-set allowlist + 민감필드 미노출(transform 심층방어) + select 인자 단언(쿼리단 방어) + 필터/페이지네이션 전달 + 401/500 가드
- 설계 codex consult 1R: lean DTO 분리 vs 재사용 트레이드오프 적출(`toPublicGeneratedAsset` 재사용 = "보안 수정으로 포장된 응답 확장"), shared 분기 user/metadata 비노출 권고, 선재 결함(enum 무검증·limit 무상한) 별 WI 분리 권고
- 듀얼 블라인드 1R 수렴: **codex CLI PASS 0 issues · evaluator-agent WARNING 9.81**(P0/P1 0, P3x3 전부 defer). evaluator 변이검증 2종 실증(DTO에 user+metadata 주입→3 FAIL·select에 prompt 복원→1 FAIL)
- 선재 입력검증 부채(type/status enum 무검증·limit 무상한·NaN)는 **WI-022** 분리

🤖 Generated with [Claude Code](https://claude.com/claude-code)
