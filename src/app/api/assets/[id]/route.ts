import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { auth } from "@/lib/auth";
import { internalErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { resolveGeneratedAssetPath, toPublicGeneratedAsset } from "@/features/assets";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/assets/[id] - 에셋 상세 + 상태 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    // 응답 allowlist (WI-019): raw row 대신 select로 공개 필드만 fetch.
    // userId는 소유권 판정 전용 — 응답 DTO(toPublicGeneratedAsset)에는 미포함.
    // metadata는 민감 필드(prompt/workflow/comfyuiJobId)가 중복 저장되므로
    // DTO에서 공개 키 allowlist로 정규화한다.
    const asset = await prisma.generatedAsset.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        type: true,
        name: true,
        status: true,
        filePath: true,
        thumbnailPath: true,
        fileSize: true,
        isShared: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: { id: true, name: true },
        },
      },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // 소유권 검증 (본인 또는 superAdmin만 접근 가능)
    if (asset.userId !== session.user.id && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(toPublicGeneratedAsset(asset));
  } catch (error) {
    return internalErrorResponse("GET /api/assets/[id]", error, "Failed to fetch asset");
  }
}

/** DELETE /api/assets/[id] - 에셋 삭제 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const asset = await prisma.generatedAsset.findUnique({
      where: { id },
    });

    if (asset && asset.userId !== session.user.id && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // 파일 시스템에서 실제 파일 삭제 (path traversal 방어: generated 루트 밖 경로는 unlink 스킵)
    if (asset.filePath) {
      const safePath = resolveGeneratedAssetPath(asset.filePath);
      if (safePath) {
        await unlink(safePath).catch(() => {});
      } else {
        console.warn(
          `[assets/DELETE] filePath가 generated 경계를 벗어나 unlink 스킵: assetId=${asset.id}`
        );
      }
    }
    if (asset.thumbnailPath) {
      const safeThumb = resolveGeneratedAssetPath(asset.thumbnailPath);
      if (safeThumb) {
        await unlink(safeThumb).catch(() => {});
      } else {
        console.warn(
          `[assets/DELETE] thumbnailPath가 generated 경계를 벗어나 unlink 스킵: assetId=${asset.id}`
        );
      }
    }

    await prisma.generatedAsset.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Asset deleted" });
  } catch (error) {
    return internalErrorResponse("DELETE /api/assets/[id]", error, "Failed to delete asset");
  }
}
