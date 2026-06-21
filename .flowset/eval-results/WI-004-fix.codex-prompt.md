# 블라인드 적대 검증 — WI-004-fix

당신은 독립 보안 리뷰어다. 아래 ACTIVE WI의 구현을 **read-only**로 검증하라. 파일을 수정하지 마라. **반드시 주어진 JSON 스키마에 맞는 객체만** 반환하라(산문 금지).

## Ground Truth
- ACTIVE WI = `.flowset/current.json` 의 `activeWI` (WI-004-fix).
- 변경분 = `git diff develop...HEAD` (이 브랜치 `fix/WI-004-fix-assets-delete-path-isolation` 의 develop 대비 diff). 이것만 검증 대상.
- 변경 4파일:
  - `src/features/assets/internal/safe-path.ts` (신규: `resolveGeneratedAssetPath`)
  - `src/features/assets/internal/safe-path.test.ts` (신규: vitest 18케이스)
  - `src/features/assets/index.ts` (배럴 export 1줄 추가)
  - `src/app/api/assets/[id]/route.ts` (DELETE 핸들러에 격리 적용)

## WI 목표 (수용 기준)
`DELETE /api/assets/[id]` 가 DB에 저장된 `filePath`/`thumbnailPath`를 검증 없이 `join(cwd, "public", path)` 후 `unlink` 하던 path traversal(CWE-22, P2) 차단:
- DB 경로가 `public/assets/generated/` 경계를 벗어나면(`../`, 절대경로, 백슬래시, null byte 등) `unlink`를 **스킵**(경계 밖 파일 삭제 금지).
- 경계 밖이어도 **DB row 삭제는 그대로 진행**(오염 row 정리 가능해야 함, 권한검사는 이미 통과).
- 정상 경로(`/assets/generated/...`)는 회귀 없이 그대로 삭제.

## 검증 관점 (중요도순)
1. **격리 완전성**: `resolveGeneratedAssetPath`가 우회 가능한 traversal 벡터가 있는가? (혼합 구분자, URL 인코딩, 이중 정규화, `..` 잔존, 드라이브 경계, symlink 등). 우회 PoC가 있으면 P0/P1.
2. **회귀**: 정상 `/assets/generated/...` (characters/tilesets/objects/maps/thumbnails + register-characters.mjs 루트직속) 삭제가 깨지지 않는가? generated 밖 경로를 쓰는 정상 GeneratedAsset가 존재할 가능성(있다면 파일 누수 회귀)?
3. **경계/캡슐화**: assets feature 모듈 internal + 배럴 노출이 WI-003에서 강제한 경계 규칙과 정합한가? route의 barrel import가 클라이언트 sharp 오염을 일으키지 않는가(서버 라우트라 무관한가)?
4. **정합성**: DB row 삭제 정책, console.warn 처리, app.md 에러형식 invariant 위반 여부.

## 판정
- 우회 PoC 또는 정상삭제 회귀 = P0/P1 (`fixNow:true`).
- 비치명 개선(추가 하드닝·로깅·테스트 보강) = P2/P3 (`defer` 판단 + `deferRationale`).
- 결함 없으면 `verdict:"PASS"`, `issues:[]`.
- codex는 `scores:null`, `weightedTotal:null`.
