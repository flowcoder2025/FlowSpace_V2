import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processAssetGeneration } from "@/features/assets";
import type { CreateAssetParams } from "@/features/assets";

const ASSET_TYPE_MAP = {
  character: "CHARACTER",
  tileset: "TILESET",
  object: "OBJECT",
  map: "MAP",
} as const;

const MAX_BATCH_SIZE = 10;

/** POST /api/assets/batch - 배치 에셋 생성 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { items: CreateAssetParams[] };

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "items array required" }, { status: 400 });
    }

    if (body.items.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Maximum ${MAX_BATCH_SIZE} items per batch` },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const batchId = `batch-${Date.now()}`;
    const results: Array<{ id: string; name: string; status: string }> = [];

    // DB에 모든 항목 PENDING 상태로 생성
    for (const item of body.items) {
      if (!item.type || !item.name || !item.prompt) continue;
      if (!["character", "tileset", "object", "map"].includes(item.type)) continue;

      const dbAsset = await prisma.generatedAsset.create({
        data: {
          userId,
          type: ASSET_TYPE_MAP[item.type],
          name: item.name,
          prompt: item.prompt,
          workflow: item.workflow || `${item.type}-default`,
          status: "PENDING",
          metadata: { batchId },
        },
      });

      results.push({ id: dbAsset.id, name: item.name, status: "PENDING" });

      // 순차 큐잉 (fire-and-forget)
      processAssetGeneration({
        type: item.type,
        name: item.name,
        prompt: item.prompt,
        workflow: item.workflow,
        seed: item.seed,
        width: item.width,
        height: item.height,
      })
        .then(async (metadata) => {
          await prisma.generatedAsset.update({
            where: { id: dbAsset.id },
            data: {
              status: "COMPLETED",
              filePath: metadata.filePath,
              thumbnailPath: metadata.thumbnailPath,
              fileSize: metadata.fileSize,
              comfyuiJobId: metadata.comfyuiJobId,
              metadata: {
                ...JSON.parse(JSON.stringify(metadata)),
                batchId,
              },
            },
          });
        })
        .catch(async (error) => {
          await prisma.generatedAsset.update({
            where: { id: dbAsset.id },
            data: {
              status: "FAILED",
              metadata: {
                batchId,
                error: error instanceof Error ? error.message : "Unknown error",
              },
            },
          });
        });
    }

    return NextResponse.json(
      {
        batchId,
        items: results,
        total: results.length,
      },
      { status: 202 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to start batch generation",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/** GET /api/assets/batch?batchId=xxx - 배치 상태 조회 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const batchId = request.nextUrl.searchParams.get("batchId");
    if (!batchId) {
      return NextResponse.json({ error: "batchId required" }, { status: 400 });
    }

    const assets = await prisma.generatedAsset.findMany({
      where: {
        userId: session.user.id,
        metadata: {
          path: ["batchId"],
          equals: batchId,
        },
      },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        thumbnailPath: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const completed = assets.filter((a) => a.status === "COMPLETED").length;
    const failed = assets.filter((a) => a.status === "FAILED").length;

    return NextResponse.json({
      batchId,
      items: assets,
      total: assets.length,
      completed,
      failed,
      pending: assets.length - completed - failed,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch batch status",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
