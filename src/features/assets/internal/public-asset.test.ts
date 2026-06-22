import { describe, it, expect } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  toPublicGeneratedAsset,
  PUBLIC_METADATA_KEYS,
  type GeneratedAssetForPublic,
} from "./public-asset";

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

  it("FAILED 자산의 metadata.error는 보존한다 (실패 폴링 계약)", () => {
    const result = toPublicGeneratedAsset(
      makeAssetRow({
        status: "FAILED",
        filePath: null,
        metadata: { error: "ComfyUI timeout", batchId: "batch-9" },
      })
    );
    const meta = result.metadata as Record<string, unknown>;
    expect(meta.error).toBe("ComfyUI timeout");
    expect(meta.batchId).toBeUndefined();
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
