import path, { posix as posixPath } from "path";

/**
 * 생성 에셋(GeneratedAsset)의 파일시스템 루트.
 * 모든 정상 filePath/thumbnailPath는 DB에 `/assets/generated/...` 형태로 저장되며
 * (`processor.ts` ASSET_STORAGE_PATHS·THUMBNAIL_PATH, `register-characters.mjs`),
 * 실제 파일은 이 디렉토리 하위에 위치한다.
 */
const GENERATED_ASSETS_ROOT = path.resolve(
  process.cwd(),
  "public",
  "assets",
  "generated"
);

/**
 * DB에 저장된 에셋 public 경로(예: `/assets/generated/characters/foo.png`)를
 * `public/assets/generated/` 경계 안으로 제한한 절대 파일시스템 경로로 해석한다.
 *
 * path traversal(CWE-22) 방어: DELETE 핸들러가 unlink하기 전에 이 함수를 통과시켜,
 * DB에 오염된 경로(`../`, 절대경로, 백슬래시, null byte)가 들어와도 generated 루트
 * 밖의 파일을 삭제하지 못하게 한다. 경계를 벗어나면 `null`을 반환한다.
 *
 * - 백슬래시/null byte는 즉시 거부 (Windows 구분자·poison null byte 우회 차단).
 * - POSIX URL 경로로 정규화하여 호스트 OS와 무관하게 `..` 세그먼트를 평탄화.
 * - generated 루트 prefix 검사 + path.relative 이중 검사(크로스플랫폼 드라이브 경계 포함).
 */
export function resolveGeneratedAssetPath(publicPath: string): string | null {
  if (!publicPath || publicPath.includes("\0") || publicPath.includes("\\")) {
    return null;
  }

  // 선행 슬래시 제거 후 절대 URL 경로로 정규화 (POSIX 기준 `..` 평탄화)
  const normalized = posixPath.normalize(`/${publicPath.replace(/^\/+/, "")}`);

  if (
    normalized === "/assets/generated" ||
    !normalized.startsWith("/assets/generated/")
  ) {
    return null;
  }

  const absPath = path.resolve(process.cwd(), "public", normalized.slice(1));
  const relativePath = path.relative(GENERATED_ASSETS_ROOT, absPath);

  if (
    relativePath === "" ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    return null;
  }

  return absPath;
}
