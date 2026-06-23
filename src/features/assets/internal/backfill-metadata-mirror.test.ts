import { describe, it, expect } from "vitest";
import { PUBLIC_METADATA_KEYS } from "./public-asset";
// 운영 백필 코어(.mjs)를 직접 import해 리터럴 미러링을 정규식 없이 잠근다.
import { PUBLIC_METADATA_KEYS as MIRRORED } from "../../../../scripts/backfill-stored-asset-metadata.core.mjs";

/**
 * 백필 스크립트 드리프트 가드 (WI-026 듀얼검증 수렴).
 *
 * `scripts/backfill-stored-asset-metadata.core.mjs`는 운영 .mjs라 TS 상수를 직접
 * import할 수 없어 `PUBLIC_METADATA_KEYS`를 리터럴로 미러링한다. 런타임 저장 빌더는
 * SoT를 공유하지만 백필 리터럴은 allowlist 변경 시 조용히 드리프트할 수 있다 — 이
 * 테스트가 코어 export와 exported TS 상수를 **직접 비교**해 드리프트를 빌드타임에
 * 검출한다(소스 텍스트 정규식 파싱 대신 실제 값 비교라 false-pass 불가).
 */
describe("backfill core — PUBLIC_METADATA_KEYS 미러링 드리프트 가드", () => {
  it("코어 .mjs의 미러링 배열이 exported PUBLIC_METADATA_KEYS와 정확히 일치한다", () => {
    expect((MIRRORED as readonly string[]).slice().sort()).toEqual(
      [...PUBLIC_METADATA_KEYS].sort()
    );
  });
});
