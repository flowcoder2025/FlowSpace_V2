# 설계 협의 (consult) — WI-004-fix: assets DELETE unlink 경로 격리 (path traversal 차단)

당신은 시니어 보안 리뷰어다. 아래 WI-004-fix 구현 계획을 검토하고, **내가 놓친 위험 1가지 이상**을 반드시 지적하라. 산문으로 간결히 답하라. 파일 수정은 하지 말고 설계 판단만.

## 배경
FlowSpace = Next.js 15 풀스택 + Phaser. 대상은 `src/app/api/assets/[id]/route.ts`의 DELETE 핸들러. P2 보안 하드닝(현재 정상 플로우로는 미악용 가능, 방어적 경계 보강).

현재 코드(취약점):
```ts
import { join } from "path";
// ...
if (asset.filePath) {
  const absPath = join(process.cwd(), "public", asset.filePath);
  await unlink(absPath).catch(() => {});
}
if (asset.thumbnailPath) {
  const absThumb = join(process.cwd(), "public", asset.thumbnailPath);
  await unlink(absThumb).catch(() => {});
}
```

`asset.filePath` / `asset.thumbnailPath`는 DB 컬럼(`GeneratedAsset.filePath?`, `thumbnailPath?`)에서 온다. `path.join`이 `..` 세그먼트를 정규화하므로, DB에 `../../../../etc/passwd`(또는 Windows `..\..`) 같은 값이 있으면 `unlink`가 `public/` 밖 임의 파일을 삭제 시도한다 (CWE-22).

## 위협 모델 (왜 P2인가)
- 정상 생성 경로(`POST /api/assets/generate`·`/batch` → `processor.ts` → `generateAssetFilename`)는 사용자 입력 `name`을 `replace(/[^a-z0-9]+/g, "_")`로 sanitize → 현재 `..`/`/`/`\` 주입 불가. **오늘은 미악용**.
- 그러나 unlink 사이트가 DB 저장 경로를 **무조건 신뢰**한다. 우회 경로 존재:
  - `scripts/register-characters.mjs`가 `filePath`를 sanitizer 우회해 직접 기록(현재는 하드코딩 안전값이지만 계약 부재).
  - 향후 신규 write 경로/마이그레이션/DB 변조 시 traversal 경로가 들어오면 즉시 임의 파일 삭제.
- 그래서 **삭제(unlink) 시점의 경계 격리**가 정석 방어.

## 내 계획

### 1) 격리 헬퍼 (assets feature 모듈 internal + 배럴 노출)
`src/features/assets/internal/safe-path.ts`:
```ts
import { join, resolve, relative, isAbsolute } from "path";

const PUBLIC_ROOT = resolve(process.cwd(), "public");

/**
 * DB 저장 상대경로(예: "/assets/generated/characters/foo.png")를 public 루트 내부로
 * 제한한 절대경로로 해석. public 밖으로 탈출하면 null.
 * - join(PUBLIC_ROOT, relPath): 기존 코드와 동일하게 선행 "/"는 세그먼트로 취급되고 ".." 정규화됨.
 * - relative로 컨테인먼트 검사 (크로스플랫폼: 다른 드라이브 → isAbsolute).
 */
export function resolvePublicPath(relPath: string): string | null {
  const abs = join(PUBLIC_ROOT, relPath);
  const rel = relative(PUBLIC_ROOT, abs);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) return null;
  return abs;
}
```
`src/features/assets/index.ts` 배럴에 `export { resolvePublicPath } from "./internal/safe-path";`.

### 2) DELETE 핸들러 적용
```ts
import { resolvePublicPath } from "@/features/assets";
// ...
if (asset.filePath) {
  const safe = resolvePublicPath(asset.filePath);
  if (safe) await unlink(safe).catch(() => {});
}
if (asset.thumbnailPath) {
  const safe = resolvePublicPath(asset.thumbnailPath);
  if (safe) await unlink(safe).catch(() => {});
}
```
- 탈출 경로면 unlink **스킵**하되, **DB row 삭제는 그대로 진행**(asset 레코드는 어차피 제거 대상, 잘못된 경로의 row를 남길 이유 없음). 이 판단 맞나?

### 3) vitest 단위 테스트
`src/features/assets/internal/safe-path.test.ts`: 정상(`/assets/generated/x.png`) → 절대경로, traversal(`../../etc/passwd`, `/../../x`, Windows `..\..`, 절대경로 `C:/...`) → null, 루트 자체(`/`) → null.

## 협의 질문
1. **컨테인먼트 루트**: `public/`(기존 join base, 정상 삭제 0 회귀) vs `public/assets/`(모든 정상 filePath가 `/assets/...` 하위라 더 타이트). 어느 쪽이 맞나? 타이트하게 가면 P2 하드닝이 향후 루트직속 에셋 삭제를 깰 위험은? 핸드오프 스펙은 "public 격리"로 명시됨.
2. **알고리즘 정확성**: `join`+`relative`+`isAbsolute` 조합이 선행 슬래시(`/assets/...`), `..` 정규화, Windows 드라이브 경계, symlink 미고려를 모두 안전하게 처리하나? `resolve(PUBLIC_ROOT, relPath)`를 raw DB값에 직접 쓰면 선행 `/`가 절대경로로 해석돼 탈출하는 함정이 있어 `join`을 택했다 — 맞나?
3. **헬퍼 배치**: assets feature 모듈(스토리지 경로 의미 소유, `ASSET_STORAGE_PATHS`/`generateAssetFilename` 동거) vs `@/lib`(앱 전역 유틸) vs route.ts 인라인. WI-003에서 막 경계 캡슐화를 강제한 맥락에서 어디가 맞나?
4. **DB row 삭제 정책**: 탈출 경로 감지 시 unlink만 스킵하고 row는 삭제 — 맞나, 아니면 탈출 경로는 무결성 이상으로 보고 별도 처리(로깅/거부)해야 하나?
5. **스코프**: write 경로(`processor.ts`/`register-characters.mjs`)에도 sanitize 추가는 이번 WI 범위인가, 아니면 unlink 격리만으로 P2 닫고 write-side는 별도 WI인가?
6. **내가 놓친 위험 1가지** (필수).
