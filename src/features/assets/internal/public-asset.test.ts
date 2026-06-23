import { describe, it, expect } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  toPublicGeneratedAsset,
  buildStoredAssetMetadata,
  PUBLIC_METADATA_KEYS,
  type GeneratedAssetForPublic,
} from "./public-asset";
import type { GeneratedAssetMetadata } from "./types";

/**
 * COMPLETED 자산 row fixture.
 * metadata는 generate/batch 라우트가 저장하는 `GeneratedAssetMetadata` 전체 형태로,
 * 민감 필드(prompt/workflow/comfyuiJobId)가 top-level과 중복 저장됨을 재현한다.
 */
function makeAssetRow(
  overrides: Partial<GeneratedAssetForPublic> = {}
): GeneratedAssetForPublic & { userId: string } {
  const metadata: Prisma.JsonValue = {
    // 공개 가능 (allowlist)
    width: 1024,
    height: 1024,
    frameWidth: 128,
    frameHeight: 128,
    columns: 8,
    rows: 4,
    format: "png",
    seed: 42,
    generatedAt: "2026-06-22T00:00:00.000Z",
    processingTime: 12345,
    // 민감/내부 (metadata에도 중복 저장 — 반드시 제거)
    prompt: "secret generation prompt",
    workflow: "character-default",
    comfyuiJobId: "comfy-job-xyz",
    // 미래 드리프트 가드 — allowlist가 이런 민감 키로 확대되면 exact-key 단언이 깨져야 함
    accessSecret: "should-never-leak",
    token: "secret-token",
    clientSecret: "cs-xxx",
    // top-level 중복 (제거)
    id: "asset-1",
    type: "character",
    name: "전사",
    status: "completed",
    filePath: "/assets/generated/characters/x.png",
    thumbnailPath: "/assets/generated/thumbnails/x.png",
    fileSize: 9999,
    // 내부 그룹핑 (제거)
    batchId: "batch-77",
  };

  return {
    id: "asset-1",
    userId: "user-1",
    type: "CHARACTER",
    name: "전사",
    status: "COMPLETED",
    filePath: "/assets/generated/characters/x.png",
    thumbnailPath: "/assets/generated/thumbnails/x.png",
    fileSize: 9999,
    isShared: false,
    metadata,
    createdAt: new Date("2026-06-22T00:00:00.000Z"),
    updatedAt: new Date("2026-06-22T00:01:00.000Z"),
    user: { id: "user-1", name: "홍길동" },
    ...overrides,
  };
}

describe("toPublicGeneratedAsset", () => {
  it("응답은 정확히 공개 키 집합만 포함한다 (raw row 전체 노출 금지)", () => {
    const result = toPublicGeneratedAsset(makeAssetRow());
    expect(Object.keys(result).sort()).toEqual(
      [
        "createdAt",
        "fileSize",
        "filePath",
        "id",
        "isShared",
        "metadata",
        "name",
        "status",
        "thumbnailPath",
        "type",
        "updatedAt",
        "user",
      ].sort()
    );
  });

  it("top-level 민감/내부 필드(prompt/workflow/comfyuiJobId/userId)를 노출하지 않는다", () => {
    const result = toPublicGeneratedAsset(makeAssetRow()) as unknown as Record<
      string,
      unknown
    >;
    expect(result.prompt).toBeUndefined();
    expect(result.workflow).toBeUndefined();
    expect(result.comfyuiJobId).toBeUndefined();
    expect(result.userId).toBeUndefined();
  });

  it("metadata를 공개 키 allowlist로 정규화한다 (우회 노출 차단)", () => {
    const { metadata } = toPublicGeneratedAsset(makeAssetRow());
    expect(metadata).not.toBeNull();
    const meta = metadata as Record<string, unknown>;

    // 렌더링/폴링 키는 보존
    expect(meta.width).toBe(1024);
    expect(meta.frameWidth).toBe(128);
    expect(meta.frameHeight).toBe(128);
    expect(meta.columns).toBe(8);
    expect(meta.format).toBe("png");

    // metadata 안의 민감 필드는 제거 (top-level 차단 우회 방지)
    expect(meta.prompt).toBeUndefined();
    expect(meta.workflow).toBeUndefined();
    expect(meta.comfyuiJobId).toBeUndefined();
    expect(meta.accessSecret).toBeUndefined();
    expect(meta.token).toBeUndefined();
    expect(meta.clientSecret).toBeUndefined();
    // 내부 그룹핑/중복 필드도 제거
    expect(meta.batchId).toBeUndefined();
    expect(meta.id).toBeUndefined();
    expect(meta.filePath).toBeUndefined();
  });

  it("정규화된 metadata 키 집합은 fixture의 공개 키와 정확히 일치한다 (allowlist 확대 false-pass 차단)", () => {
    const { metadata } = toPublicGeneratedAsset(makeAssetRow());
    // PUBLIC_METADATA_KEYS를 오라클로 쓰지 않고 리터럴 기대값으로 잠근다 —
    // allowlist에 민감 키(accessSecret 등)가 추가되면(또는 공개 키가 누락되면)
    // 이 단언이 깨진다. 자기참조 부분집합 검사의 false-pass 차단.
    expect(Object.keys(metadata as Record<string, unknown>).sort()).toEqual(
      [
        "columns",
        "format",
        "frameHeight",
        "frameWidth",
        "generatedAt",
        "height",
        "processingTime",
        "rows",
        "seed",
        "width",
      ].sort()
    );
  });

  it("PUBLIC_METADATA_KEYS 상수 자체가 알려진 민감/내부 키를 포함하지 않는다", () => {
    const forbidden = [
      "prompt",
      "workflow",
      "comfyuiJobId",
      "accessSecret",
      "token",
      "clientSecret",
      "id",
      "userId",
      "filePath",
      // WI-024 (CWE-209): error는 raw 내부 정보(경로/스택)를 담을 수 있어 제외
      "error",
    ];
    const keys = PUBLIC_METADATA_KEYS as readonly string[];
    for (const key of forbidden) {
      expect(keys.includes(key)).toBe(false);
    }
  });

  it("metadata가 null이면(PENDING) null을 반환한다", () => {
    const result = toPublicGeneratedAsset(
      makeAssetRow({ metadata: null, status: "PENDING", filePath: null })
    );
    expect(result.metadata).toBeNull();
  });

  it("FAILED 자산의 metadata.error는 공개되지 않는다 (WI-024, CWE-209 차단)", () => {
    // 과거 행은 raw error.message(내부 경로/스택 단편 포함 가능)를 metadata.error에
    // 보유한다 — 저장 정규화(generic) 이전에 쌓인 행도 응답에서 차단되어야 한다.
    const result = toPublicGeneratedAsset(
      makeAssetRow({
        status: "FAILED",
        filePath: null,
        metadata: {
          error: "ComfyUI internal: ECONNREFUSED http://127.0.0.1:8188 at node 42",
          batchId: "batch-9",
          width: 512,
        },
      })
    );
    const meta = result.metadata as Record<string, unknown>;
    // raw 사유는 제거되고(폴링은 status=FAILED로 충분), 비민감 키만 남는다.
    expect(meta.error).toBeUndefined();
    expect(meta.batchId).toBeUndefined();
    expect(meta.width).toBe(512);
  });

  it("generic으로 정규화된 metadata.error(신규 행)도 응답에서 제거된다 (allowlist 제외)", () => {
    // 저장 정규화 후 행은 generic 메시지를 갖지만, error는 allowlist에서 아예 빠졌으므로
    // generic 여부와 무관하게 응답에 노출되지 않는다(키 자체 차단).
    const result = toPublicGeneratedAsset(
      makeAssetRow({
        status: "FAILED",
        filePath: null,
        metadata: { error: "Asset generation failed" },
      })
    );
    expect(result.metadata).toEqual({});
  });

  it("metadata가 배열/문자열 등 비객체면 null을 반환한다", () => {
    expect(
      toPublicGeneratedAsset(makeAssetRow({ metadata: ["a", "b"] })).metadata
    ).toBeNull();
    expect(
      toPublicGeneratedAsset(makeAssetRow({ metadata: "raw string" })).metadata
    ).toBeNull();
  });

  it("user는 {id,name}만 매핑한다", () => {
    const result = toPublicGeneratedAsset(makeAssetRow());
    expect(result.user).toEqual({ id: "user-1", name: "홍길동" });
  });
});

/**
 * 후처리 완료 메타데이터 fixture — generate/batch 라우트가 .then(metadata)로 받는
 * `GeneratedAssetMetadata` 전체 형태. 민감/내부 필드를 모두 포함한다.
 */
function makeFullMetadata(
  overrides: Partial<GeneratedAssetMetadata> = {}
): GeneratedAssetMetadata {
  return {
    id: "asset-1",
    type: "character",
    name: "전사",
    prompt: "secret generation prompt",
    workflow: "character-default",
    width: 1024,
    height: 1024,
    frameWidth: 128,
    frameHeight: 128,
    columns: 8,
    rows: 4,
    filePath: "/assets/generated/characters/x.png",
    thumbnailPath: "/assets/generated/thumbnails/x.png",
    fileSize: 9999,
    format: "png",
    comfyuiJobId: "comfy-job-xyz",
    seed: 42,
    generatedAt: "2026-06-22T00:00:00.000Z",
    processingTime: 12345,
    status: "completed",
    ...overrides,
  };
}

describe("buildStoredAssetMetadata", () => {
  it("저장값은 정확히 공개 런타임 키 집합만 포함한다 (전체 metadata 통째 저장 금지)", () => {
    const stored = buildStoredAssetMetadata(makeFullMetadata());
    // 리터럴 기대값으로 잠근다 — PUBLIC_METADATA_KEYS를 오라클로 쓰지 않아
    // 키 집합이 의도치 않게 넓어지면(민감 키 유입) 단언이 깨진다.
    expect(Object.keys(stored).sort()).toEqual(
      [
        "columns",
        "format",
        "frameHeight",
        "frameWidth",
        "generatedAt",
        "height",
        "processingTime",
        "rows",
        "seed",
        "width",
      ].sort()
    );
  });

  it("민감/내부 필드(prompt/workflow/comfyuiJobId)와 top-level 중복 필드를 저장하지 않는다", () => {
    const stored = buildStoredAssetMetadata(makeFullMetadata());
    expect(stored.prompt).toBeUndefined();
    expect(stored.workflow).toBeUndefined();
    expect(stored.comfyuiJobId).toBeUndefined();
    // top-level 컬럼과 중복되던 필드도 metadata에는 저장하지 않는다
    expect(stored.id).toBeUndefined();
    expect(stored.type).toBeUndefined();
    expect(stored.name).toBeUndefined();
    expect(stored.status).toBeUndefined();
    expect(stored.filePath).toBeUndefined();
    expect(stored.thumbnailPath).toBeUndefined();
    expect(stored.fileSize).toBeUndefined();
  });

  it("공개 런타임 값은 보존한다", () => {
    const stored = buildStoredAssetMetadata(makeFullMetadata());
    expect(stored.width).toBe(1024);
    expect(stored.height).toBe(1024);
    expect(stored.frameWidth).toBe(128);
    expect(stored.frameHeight).toBe(128);
    expect(stored.columns).toBe(8);
    expect(stored.rows).toBe(4);
    expect(stored.format).toBe("png");
    expect(stored.seed).toBe(42);
    expect(stored.generatedAt).toBe("2026-06-22T00:00:00.000Z");
    expect(stored.processingTime).toBe(12345);
  });

  it("undefined인 선택 필드(frameWidth/columns/rows/seed)는 키 자체를 생략한다", () => {
    const stored = buildStoredAssetMetadata(
      makeFullMetadata({
        frameWidth: undefined,
        frameHeight: undefined,
        columns: undefined,
        rows: undefined,
        seed: undefined,
      })
    );
    expect("frameWidth" in stored).toBe(false);
    expect("frameHeight" in stored).toBe(false);
    expect("columns" in stored).toBe(false);
    expect("rows" in stored).toBe(false);
    expect("seed" in stored).toBe(false);
    // 필수 공개 필드는 그대로 남는다
    expect(stored.width).toBe(1024);
    expect(stored.format).toBe("png");
  });

  it("extra 운영 키(batchId)는 저장값에 병합된다 (batch 상태 조회 의존성 보존)", () => {
    const stored = buildStoredAssetMetadata(makeFullMetadata(), {
      batchId: "batch-77",
    });
    expect(stored.batchId).toBe("batch-77");
    // 여전히 민감 필드는 없다
    expect(stored.prompt).toBeUndefined();
    expect(stored.workflow).toBeUndefined();
  });

  it("extra 미지정 시 batchId 키가 없다 (단일 생성 경로)", () => {
    const stored = buildStoredAssetMetadata(makeFullMetadata());
    expect("batchId" in stored).toBe(false);
  });

  it("저장값을 응답 정규화에 통과시키면 공개 키만 남는다 (저장면=응답면 SoT 일치)", () => {
    // 핵심 불변식: 저장 빌더가 만든 metadata를 toPublicMetadata(=응답 allowlist)에
    // 통과시켜도 형태가 그대로다(batchId만 응답에서 제외). 저장면과 응답면이 동일
    // 키 SoT를 공유함을 end-to-end로 잠근다 — 응답 shape 무회귀 + batchId storage-only.
    const stored = buildStoredAssetMetadata(makeFullMetadata(), {
      batchId: "batch-77",
    });
    const response = toPublicGeneratedAsset(
      makeAssetRow({ metadata: stored as unknown as Prisma.JsonValue })
    );
    expect(Object.keys(response.metadata as Record<string, unknown>).sort()).toEqual(
      [
        "columns",
        "format",
        "frameHeight",
        "frameWidth",
        "generatedAt",
        "height",
        "processingTime",
        "rows",
        "seed",
        "width",
      ].sort()
    );
    // batchId는 저장엔 있으나(운영 키) 응답엔 없다
    expect(stored.batchId).toBe("batch-77");
    expect(
      (response.metadata as Record<string, unknown>).batchId
    ).toBeUndefined();
  });
});
