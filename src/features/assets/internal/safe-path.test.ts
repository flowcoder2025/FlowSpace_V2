import { describe, it, expect } from "vitest";
import path from "path";
import { resolveGeneratedAssetPath } from "./safe-path";

const GENERATED_ROOT = path.resolve(
  process.cwd(),
  "public",
  "assets",
  "generated"
);

describe("resolveGeneratedAssetPath", () => {
  describe("정상 경로 → generated 루트 하위 절대경로", () => {
    it("선행 슬래시 포함 정상 경로", () => {
      const result = resolveGeneratedAssetPath("/assets/generated/characters/foo.png");
      expect(result).toBe(path.join(GENERATED_ROOT, "characters", "foo.png"));
    });

    it("선행 슬래시 없는 정상 경로", () => {
      const result = resolveGeneratedAssetPath("assets/generated/tilesets/x.png");
      expect(result).toBe(path.join(GENERATED_ROOT, "tilesets", "x.png"));
    });

    it("썸네일 경로", () => {
      const result = resolveGeneratedAssetPath("/assets/generated/thumbnails/thumb_abc.png");
      expect(result).toBe(path.join(GENERATED_ROOT, "thumbnails", "thumb_abc.png"));
    });

    it("register-characters.mjs 직접 등록 경로(루트 직속 파일)", () => {
      const result = resolveGeneratedAssetPath("/assets/generated/c02_spritesheet_96x128.png");
      expect(result).toBe(path.join(GENERATED_ROOT, "c02_spritesheet_96x128.png"));
    });

    it("내부 .. 가 정규화되어도 루트 안에 머물면 허용", () => {
      const result = resolveGeneratedAssetPath("/assets/generated/characters/../objects/y.png");
      expect(result).toBe(path.join(GENERATED_ROOT, "objects", "y.png"));
    });
  });

  describe("path traversal / 경계 밖 → null", () => {
    const blocked: Array<[string, string]> = [
      ["상대 traversal", "../../etc/passwd"],
      ["선행 슬래시 + traversal", "/../../x.png"],
      ["generated 내부에서 탈출", "/assets/generated/../../etc/passwd"],
      ["generated 밖 assets", "/assets/other.png"],
      ["generated 상위로 정규화", "/assets/generated/../x.png"],
      ["백슬래시 traversal", "..\\..\\x.png"],
      ["혼합 백슬래시", "/assets/generated/..\\..\\secret.png"],
      ["Windows 절대경로(슬래시)", "C:/Windows/win.ini"],
      ["Windows 절대경로(백슬래시)", "C:\\Windows\\win.ini"],
      ["루트", "/"],
      ["generated 루트 자체(파일 아님)", "/assets/generated"],
      ["빈 문자열", ""],
    ];

    it.each(blocked)("%s → null (%s)", (_label, input) => {
      expect(resolveGeneratedAssetPath(input)).toBeNull();
    });

    it("null byte poison 차단", () => {
      expect(
        resolveGeneratedAssetPath("/assets/generated/x.png\0/../../etc/passwd")
      ).toBeNull();
    });
  });
});
