## WI-019-fix — assets GET 응답 allowlist 정형화

### 문제
`GET /api/assets/[id]`가 `prisma.generatedAsset.findUnique({ include })`로 raw `GeneratedAsset` 전체 행을 그대로 JSON 반환. 내부/민감 필드(`prompt`·`workflow`·`comfyuiJobId`)가 응답으로 노출됨. WI-014(spaces 응답 allowlist)와 동일 클래스(별 도메인) — WI-014 evaluator P3 defer 흡수. owner/superAdmin 게이트 하라 저위험이나 정보위생.

### 해결
- 순수 헬퍼 `toPublicGeneratedAsset` (`features/assets/internal/public-asset.ts`) + 배럴 export.
- 라우트: `include` → `select`(공개 필드 + 권한판정용 `userId`만 fetch) → 공개 DTO 반환.
- **핵심**: 민감 3필드가 `metadata`(Json) 컬럼에도 중복 저장됨(`generate`/`batch` 라우트가 `GeneratedAssetMetadata` 전체를 JSON 저장). top-level allowlist만으로는 metadata 우회 노출 → `PUBLIC_METADATA_KEYS` allowlist(`width,height,frameWidth,frameHeight,columns,rows,format,seed,generatedAt,processingTime,error`)로 metadata도 정규화.
- `userId`는 응답 DTO에서 제외(소유권 판정 전용).

### 무회귀 근거 (소비처 실측)
- `game-loader.ts`: `id`/`type`/`name`/`filePath`/`metadata` → 보존
- `sprite-generator.ts`: `filePath`/`metadata.frameWidth`·`frameHeight` → 보존
- `scripts/test-chibi-generation.ts`: `status`/`filePath`/`metadata.error` → 보존

### 검증
- 기계게이트 4/4: tsc 0 / lint 0(선재 LiveKit 경고1·WI무관) / vitest 191(174→191, +17) / build 0
- 회귀 테스트 17: 헬퍼 8(정규화·민감필드 제거·null/error/배열) + 라우트 9(인증가드·정확 키집합·metadata 우회차단·select 인자 단언·500 폴백)
- 설계 codex consult 1R (REST 응답 계약 변경): metadata 우회 노출 위험 적출
- 듀얼 블라인드 검증: codex CLI + evaluator-agent

🤖 Generated with [Claude Code](https://claude.com/claude-code)
