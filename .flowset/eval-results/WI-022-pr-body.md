## WI-022-fix — assets 목록 GET 입력 강건화 (enum 검증 + page/limit 정규화)

`GET /api/assets`(목록)의 선재 입력 검증 부채 해소. WI-021 듀얼검증에서 발굴, codex consult 권고로 별 WI 분리. **누출 아님** — 응답 누출(lean DTO)은 WI-021에서 완료, 본 WI는 입력 강건화.

### 결함 → 해소
| 결함 | 변경 전 | 변경 후 |
|---|---|---|
| enum 무검증 | `type.toUpperCase()` 직접 주입 → 오타시 Prisma enum 불일치 500 | `getAll()` 전 값 `trim().toUpperCase()` 후 `Object.values(AssetType/AssetStatus)` allowlist 검증 → 불일치 400 `{error, code:"INVALID_FILTER"}` (WI-009 패턴) |
| limit 무상한/NaN | `parseInt(...\|\|"20")` → `limit=100000`이면 `take:100000` | `parsePageLimit(raw, 20)` → default 20 보존 + MAX 100 cap |
| page 음수 skip | `parseInt(...\|\|"1")` → `page=0/-5` → 음수 skip → 500 | `parsePageNumber(raw)` → NaN/0/음수를 1로 클램프 |

### 설계 (codex consult 1R)
- **B**: `parsePageLimit`에 optional `defaultLimit` param 추가 → assets default 20 보존(자매 라우트 50 통일보다 무회귀 우선).
- **C**: 신규 `parsePageNumber`를 `src/lib/pagination.ts`에 추가(공통 입력 파싱).
- **A**: `Object.values(enum)` 동적 allowlist(하드코딩 회피·enum 자동 동기화) + uppercase-후-검증.
- **400**: 잘못된 enum은 조용히 무시(전체목록 응답)하지 않고 400(오타 surface).

### 무회귀 (소비처 2곳 실측)
- `asset-loader.ts:124` `?status=completed&limit=100` — **소문자** `completed`가 `.toUpperCase()` 후 통과, limit=100 cap 정확.
- `asset-palette.tsx:38` `?status=COMPLETED&limit=100`.
- `parsePageLimit` optional param은 기존 무인자 호출부(spaces/messages×2) 무영향, 기존 계약 `"12.9"→12` 보존.

### 검증
- **기계게이트 4/4**: tsc 0 / lint 0(선재 LiveKit 경고1·WI무관) / vitest **204→227**(+23) / build 0.
- **듀얼 블라인드 3R 수렴**: codex r1 WARNING(fixNow P3 공백-only enum) → r2 WARNING(fixNow P3 중복 파라미터 검증 우회) → **r3 PASS 0 issues**. 두 fixNow를 매 라운드 즉시 해소(trim-first / `getAll()` 전수 검증).
- **evaluator WARNING 9.88**(최종HEAD, P0/P1 0, P3×3 defer: 500 details 선재·page 상한 의도·타입 nit). 변이검증 3종 실증.
- `.pass` fingerprint `0c66c8a5`.

### Defer (→ WI-023 선택 backlog)
- 500 폴백 `details:error.message` 노출(선재·spaces/messages 정렬), `parsePageNumber` 큰 offset 상한(설계 의도·소비처 미사용), `PublicAssetListItem` 타입 중복 nit(WI-021 도입).

### 변경 파일
- `src/app/api/assets/route.ts` (enum getAll 전수 검증 + page/limit 정규화)
- `src/lib/pagination.ts` (`parsePageLimit` optional defaultLimit + 신규 `parsePageNumber`)
- `src/lib/pagination.test.ts`, `src/app/api/assets/route.test.ts` (회귀 테스트 +21)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
