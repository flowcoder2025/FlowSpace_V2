import type { AssetType, AssetStatus, Prisma } from "@prisma/client";

/**
 * GeneratedAsset 공개 응답 DTO (WI-019)
 *
 * `GET /api/assets/[id]`는 게임 런타임 로더(game-loader/sprite-generator)와
 * 폴링 스크립트가 호출하는 자산 상세 API다. raw Prisma row를 그대로 반환하면
 * 내부/민감 필드(prompt·workflow·comfyuiJobId)가 외부로 새 나간다.
 *
 * ⚠️ 핵심: 동일 민감 필드가 `metadata`(Json) 컬럼에도 중복 저장된다
 * (generate/batch 라우트가 `GeneratedAssetMetadata` 전체를 JSON으로 저장).
 * 따라서 top-level allowlist만으로는 부족하고 metadata도 정규화해야 한다.
 */

/**
 * 공개 metadata 키 allowlist — 렌더링/폴링에 필요한 비민감 키만.
 * 제외: prompt·workflow·comfyuiJobId(민감), id·type·name·status·filePath·
 * thumbnailPath·fileSize(top-level 중복), batchId(내부 그룹핑).
 *
 * ⚠️ `error` 제외 (WI-024, CWE-209): 비동기 생성 실패 시 generate/batch가
 * `metadata.error`에 저장하는 값이 과거엔 raw `error.message`였다(ComfyUI 내부 URL·
 * 파일 경로·스택 단편 포함 가능). 저장값은 이제 generic으로 정규화되지만
 * (`GENERATION_FAILURE_MESSAGE`), **기존 DB 행은 여전히 raw를 보유**하므로 응답
 * 계층에서도 `error`를 allowlist에서 제외해 기존·신규 행 모두 차단한다(심층 방어).
 * 폴링 계약은 `status` 필드(FAILED)만으로 충분하다 — 실패 사유 raw 노출 불필요.
 */
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
] as const;

export interface PublicGeneratedAsset {
  id: string;
  type: AssetType;
  name: string;
  status: AssetStatus;
  filePath: string | null;
  thumbnailPath: string | null;
  fileSize: number | null;
  isShared: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; name: string | null };
}

/** 헬퍼가 요구하는 최소 입력 형태(route의 select 결과를 구조적으로 수용). */
export interface GeneratedAssetForPublic {
  id: string;
  type: AssetType;
  name: string;
  status: AssetStatus;
  filePath: string | null;
  thumbnailPath: string | null;
  fileSize: number | null;
  isShared: boolean;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; name: string | null };
}

/**
 * 저장된 metadata(Json)를 공개 키 allowlist로 축소.
 * null/비객체/배열 → null. 객체면 allowlist 키만 골라 새 객체로.
 */
function toPublicMetadata(
  metadata: Prisma.JsonValue
): Record<string, unknown> | null {
  if (
    metadata === null ||
    typeof metadata !== "object" ||
    Array.isArray(metadata)
  ) {
    return null;
  }

  const src = metadata as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_METADATA_KEYS) {
    const value = src[key];
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * raw GeneratedAsset row → 공개 응답 DTO.
 * userId 등 권한 판정 전용 필드는 입력에 있어도 응답에 포함하지 않는다.
 */
export function toPublicGeneratedAsset(
  asset: GeneratedAssetForPublic
): PublicGeneratedAsset {
  return {
    id: asset.id,
    type: asset.type,
    name: asset.name,
    status: asset.status,
    filePath: asset.filePath,
    thumbnailPath: asset.thumbnailPath,
    fileSize: asset.fileSize,
    isShared: asset.isShared,
    metadata: toPublicMetadata(asset.metadata),
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    user: { id: asset.user.id, name: asset.user.name },
  };
}

/**
 * 목록 공개 응답 DTO (WI-021) — `GET /api/assets`(목록) 전용 lean 표현.
 *
 * 상세(`toPublicGeneratedAsset`)와 의도적으로 분리한다. 목록은 `shared=true`일 때
 * 타인의 공유 자산을 owner 게이트 없이 반환하므로(아바타 선택 등 의도된 공유),
 * 상세 DTO를 재사용하면 타인의 `user{id,name}`·`metadata`(seed/generatedAt 등)가
 * 새로 노출되고 game-loader frameWidth 폴백(64) 동작까지 바뀐다(설계 codex consult).
 * 따라서 목록은 렌더링/팔레트에 필요한 최소 비민감 필드만 노출한다.
 *
 * 제외: prompt·workflow·comfyuiJobId(민감), userId(소유권 판정 전용),
 * metadata·user·fileSize·isShared(목록 소비처 미사용 + shared 분기 타인 노출 표면).
 */
export interface PublicAssetListItem {
  id: string;
  type: AssetType;
  name: string;
  status: AssetStatus;
  filePath: string | null;
  thumbnailPath: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 목록 헬퍼 입력 — route의 lean select 결과를 구조적으로 수용. */
export interface GeneratedAssetForListItem {
  id: string;
  type: AssetType;
  name: string;
  status: AssetStatus;
  filePath: string | null;
  thumbnailPath: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * raw GeneratedAsset row → 목록 공개 응답 DTO.
 * 입력에 민감/소유 필드가 섞여 있어도 lean 키만 골라 반환한다(심층 방어):
 * select가 우발적으로 넓어져도 응답 키 집합은 고정된다.
 */
export function toPublicAssetListItem(
  asset: GeneratedAssetForListItem
): PublicAssetListItem {
  return {
    id: asset.id,
    type: asset.type,
    name: asset.name,
    status: asset.status,
    filePath: asset.filePath,
    thumbnailPath: asset.thumbnailPath,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}
