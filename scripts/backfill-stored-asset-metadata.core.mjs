/**
 * 백필 순수 코어 (WI-026) — Prisma/IO 무의존 순수 함수 + 상수.
 *
 * 메인 스크립트(`backfill-stored-asset-metadata.mjs`)와 단위 테스트가 공유한다.
 * 부수효과가 없어(PrismaClient/dotenv 미사용) 테스트가 안전하게 import할 수 있다.
 *
 * (.mjs 운영 코어 — TS 상수를 직접 import할 수 없어 `PUBLIC_METADATA_KEYS`는 리터럴
 *  미러링이지만, `src/features/assets/internal/backfill-metadata-mirror.test.ts`가 이 export를
 *  exported TS 상수와 직접 비교해 드리프트를 빌드타임에 검출한다.)
 */

// src/features/assets/internal/public-asset.ts 의 PUBLIC_METADATA_KEYS와 동일해야 한다.
export const PUBLIC_METADATA_KEYS = [
  "width",
  "height",
  "frameWidth",
  "frameHeight",
  "columns",
  "rows",
  "format",
  "seed",
  "generatedAt",
  "processingTime",
];

// 저장 시 허용되는 키 = 공개 런타임 키 + 저장 전용 운영 키(batchId).
export const ALLOWED_STORED_KEYS = new Set([...PUBLIC_METADATA_KEYS, "batchId"]);

/** metadata가 허용 집합 밖의 키를 가진(=과다 저장된) 평범한 객체인지 판정. */
export function hasExtraStoredKeys(metadata) {
  if (
    metadata === null ||
    typeof metadata !== "object" ||
    Array.isArray(metadata)
  ) {
    return false;
  }
  return Object.keys(metadata).some((key) => !ALLOWED_STORED_KEYS.has(key));
}

/** 허용 키만 골라 새 metadata 객체로 정화(원본 키 순서 무관, 값 보존). */
export function normalizeStored(metadata) {
  const out = {};
  for (const key of Object.keys(metadata)) {
    if (ALLOWED_STORED_KEYS.has(key)) {
      out[key] = metadata[key];
    }
  }
  return out;
}

/**
 * DATABASE_URL이 로컬 개발 DB가 아닌 원격(prod 포함)을 가리키는지 판정.
 *
 * **hostname 컴포넌트만** 검사한다 — username/password/db명/query에 'localhost'가
 * 섞여도(예: `?schema=localhost`) 우회되지 않도록 URL을 파싱해 host만 본다.
 * 정확한 로컬 호스트(localhost/127.0.0.1/::1)만 로컬로 인정하고, 그 외(원격) 및
 * 파싱 불가한 비정상 URL은 보수적으로 원격으로 취급한다(게이트 활성).
 */
export function isRemoteDatabase(dbUrl) {
  if (!dbUrl) return false;
  let host;
  try {
    host = new URL(dbUrl).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  } catch {
    return true; // 파싱 불가 → 보수적으로 원격 취급
  }
  return !["localhost", "127.0.0.1", "::1"].includes(host);
}
