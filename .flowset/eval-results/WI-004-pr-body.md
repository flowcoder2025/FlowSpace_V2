## WI-004-fix — assets DELETE unlink 경로 격리 (path traversal 차단, CWE-22 P2)

### 문제
`DELETE /api/assets/[id]` 가 DB 저장 `filePath`/`thumbnailPath`를 검증 없이 `join(cwd, "public", path)` 후 `unlink`. DB에 오염된 경로(`../`/절대경로/백슬래시/null byte)가 주입되면 `public` 밖 임의 파일 삭제 가능.

### 해결
- `resolveGeneratedAssetPath()` (`features/assets/internal/safe-path.ts` + 배럴): `public/assets/generated/` 경계 격리. 백슬래시/null byte 즉시 거부 + POSIX URL 정규화로 `..` 평탄화(호스트 OS 무관) + generated prefix 검사 + `path.relative` 이중 검사(크로스플랫폼 드라이브 경계).
- DELETE 핸들러: 해석 성공 시만 `unlink`, 경계 밖이면 스킵+`console.warn`. **DB row 삭제는 그대로 진행**(오염 row도 정리 가능).
- vitest 18케이스 신규(정상 5 + 차단 13), 52→71.

### 검증
- 기계게이트 4/4 PASS: tsc 0 / lint 0(기존 경고 1, 무관) / vitest 71·71 / build 0
- 듀얼검증: **codex PASS(0 issues)** · evaluator WARNING 9.62 (P3×3 전부 defer — %2e%2e 무해/relative 이중검사 방어중복/generated 밖 정상자산 부재). evaluator 16벡터 PoC 독립실행 → 전부 BLOCK, 정상삭제 회귀 0 실증.
- 설계 codex consult 1R: 컨테인먼트 루트를 `public/`→`public/assets/generated/`로 타이트화(전 write 경로가 generated로 귀결 실증→무회귀) + null byte/백슬래시 거부 보강.

### 범위 밖 (후속)
- write-side(`processor.ts`/`register-characters.mjs`) 저장경로 중앙화 → WI-012-refactor.

## PR Checklist
- [x] 경계(모듈)는? assets feature 모듈 internal + 배럴 노출
- [x] internal 직접 import 없음? 라우트는 `@/features/assets` 배럴 import
- [x] 공개 API 최소화? `resolveGeneratedAssetPath` 1개 노출
- [x] 중복 컴포넌트 없이 재사용? unlink 2개소 공통 헬퍼화
- [x] 하드코딩된 값 없음? generated 루트는 `path.resolve` 상수

🤖 Generated with [Claude Code](https://claude.com/claude-code)
