/**
 * 모듈 경계 캡슐화 강제 테스트 (WI-003)
 *
 * 아키텍처 규칙: 각 모듈은 `module/index.ts`(Public API) + `module/internal/`(Private).
 * 타 모듈의 `internal/*`를 직접 import 하는 것을 금지한다.
 *
 * ESLint `no-restricted-imports`는 alias(@/) 경로만 정밀 차단 가능하다. 상대경로
 * cross-module internal 침범은 glob으로 동일모듈 상향(`../../internal/*`)과 구분이
 * 불가능하므로, import 경로를 실제 해석해 모듈 소유권을 판정하는 본 테스트로 보강한다.
 * (server/**·scripts/** 는 별도 빌드/툴이며 순수 계약 예외 → src/ 만 검사한다.)
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SRC_ROOT = path.resolve(process.cwd(), "src");

/** src 하위 모든 .ts/.tsx 파일 절대경로 수집 */
function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** 파일에서 import/export-from/dynamic-import 의 모듈 스펙ifier 추출 */
function extractSpecifiers(content: string): string[] {
  const specs: string[] = [];
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g, // import/export ... from "X"
    /\bimport\s+["']([^"']+)["']/g, // import "X" (side-effect)
    /\bimport\s*\(\s*["']([^"']+)["']/g, // dynamic import("X")
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      specs.push(m[1]);
    }
  }
  return specs;
}

/** specifier를 절대경로(posix)로 해석. 외부 패키지(bare)는 null */
function resolveSpecifier(fileAbs: string, spec: string): string | null {
  let abs: string;
  if (spec.startsWith("@/")) {
    abs = path.resolve(SRC_ROOT, spec.slice(2));
  } else if (spec.startsWith(".")) {
    abs = path.resolve(path.dirname(fileAbs), spec);
  } else {
    return null; // node_modules 등 bare specifier
  }
  return abs.split(path.sep).join("/");
}

/**
 * cross-module internal 침범이면 소유 모듈 디렉토리를 반환, 아니면 null.
 * 규칙: 해석된 경로에 `internal` 세그먼트가 있고, import 한 파일이 그 internal을
 * 소유한 모듈(internal 디렉토리의 부모) 하위에 있지 않으면 위반.
 */
function violationModuleDir(fileAbs: string, resolved: string): string | null {
  const segs = resolved.split("/");
  const idx = segs.indexOf("internal");
  if (idx < 1) return null; // internal 세그먼트 없음
  const moduleDir = segs.slice(0, idx).join("/");
  const filePosix = fileAbs.split(path.sep).join("/");
  // 같은 모듈(소유 디렉토리 하위)이면 정상
  if (filePosix === moduleDir || filePosix.startsWith(moduleDir + "/")) {
    return null;
  }
  return moduleDir;
}

describe("module boundaries: 타 모듈 internal/* 직접 import 금지", () => {
  it("src 내 cross-module internal import 위반이 0건이어야 한다", () => {
    const files = collectSourceFiles(SRC_ROOT);
    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      for (const spec of extractSpecifiers(content)) {
        const resolved = resolveSpecifier(file, spec);
        if (!resolved) continue;
        const owner = violationModuleDir(file, resolved);
        if (owner) {
          const rel = path.relative(SRC_ROOT, file).split(path.sep).join("/");
          violations.push(`src/${rel}  →  "${spec}"  (소유 모듈: ${owner.split("/src/")[1] ?? owner})`);
        }
      }
    }

    expect(
      violations,
      `타 모듈 internal/* 직접 import 위반:\n${violations.join("\n")}\n해당 모듈의 배럴(index.ts)을 통해 import하세요.`,
    ).toEqual([]);
  });
});
