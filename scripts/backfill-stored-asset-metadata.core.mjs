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

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/** host 문자열 정규화 — trim·소문자·IPv6 대괄호 제거. */
function normalizeHost(host) {
  return host.trim().toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
}

/** 후보 host가 로컬인지 — 정확한 로컬 호스트 또는 Unix 도메인 소켓(절대경로). */
function isLocalHost(host) {
  // 절대경로(/...)는 Unix 도메인 소켓 = 같은 머신 접속이라 항상 로컬(원격 도달 불가).
  return LOCAL_HOSTS.has(host) || host.startsWith("/");
}

/**
 * DATABASE_URL이 로컬 개발 DB가 아닌 원격(prod 포함)을 가리키는지 판정.
 *
 * **실제 접속 대상**을 검사한다 — libpq/Postgres 연결 문자열은 authority host뿐
 * 아니라 `host`/`hostaddr` **query 파라미터**로도 접속 대상을 바꾼다(예:
 * `...@localhost/db?host=prod.invalid` → Prisma는 prod.invalid에 접속). 반복 키
 * (`?host=a&host=b`)는 libpq가 마지막 값을 쓰므로 `getAll`로 전부, 콤마 다중호스트도
 * 분해해 후보로 모은다. 후보 중 **하나라도 비-로컬이면 원격**으로 판정한다(fail-safe).
 * username/password/db명/기타 query의 'localhost'는 영향 없다(host 컴포넌트만 봄).
 * Unix 소켓(절대경로 host)은 로컬로 인정한다(로컬 dev UX 보존). 파싱 불가(다중호스트
 * authority 등)·호스트 정보 전무는 보수적으로 원격 처리한다.
 */
export function isRemoteDatabase(dbUrl) {
  if (!dbUrl) return false;

  let url;
  try {
    url = new URL(dbUrl);
  } catch {
    return true; // 파싱 불가 → 보수적으로 원격 취급
  }

  const candidates = [];
  if (url.hostname) candidates.push(url.hostname);
  for (const key of ["host", "hostaddr"]) {
    for (const value of url.searchParams.getAll(key)) {
      if (value) candidates.push(...value.split(","));
    }
  }

  const effective = candidates.map(normalizeHost).filter((h) => h.length > 0);
  if (effective.length === 0) return true; // 호스트 정보 전무 → 보수적 원격
  return effective.some((h) => !isLocalHost(h));
}
