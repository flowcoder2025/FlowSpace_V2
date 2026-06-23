import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PUBLIC_METADATA_KEYS } from "./public-asset";

/**
 * 백필 스크립트 드리프트 가드 (WI-026 듀얼검증 수렴).
 *
 * `scripts/backfill-stored-asset-metadata.mjs`는 운영 .mjs라 TS 상수를 직접 import할
 * 수 없어 `PUBLIC_METADATA_KEYS`를 리터럴로 미러링한다. 런타임 저장 빌더는 SoT를
 * 공유하지만 백필 리터럴은 allowlist 변경 시 조용히 드리프트할 수 있다 — 이 테스트가
 * 스크립트 리터럴과 exported 상수의 동등성을 잠가 드리프트를 빌드 타임에 검출한다.
 */
describe("backfill-stored-asset-metadata.mjs — PUBLIC_METADATA_KEYS 미러링 드리프트 가드", () => {
  it("스크립트의 리터럴 미러링이 exported PUBLIC_METADATA_KEYS와 정확히 일치한다", () => {
    const scriptPath = resolve(
      process.cwd(),
      "scripts/backfill-stored-asset-metadata.mjs"
    );
    const src = readFileSync(scriptPath, "utf8");

    const match = src.match(/const PUBLIC_METADATA_KEYS = \[([\s\S]*?)\];/);
    expect(match, "스크립트에서 PUBLIC_METADATA_KEYS 리터럴 배열을 찾지 못함").not.toBeNull();

    const mirrored = (match![1].match(/"([^"]+)"/g) ?? []).map((s) =>
      s.replace(/"/g, "")
    );

    expect(mirrored.length).toBeGreaterThan(0);
    expect(mirrored.slice().sort()).toEqual([...PUBLIC_METADATA_KEYS].sort());
  });
});
