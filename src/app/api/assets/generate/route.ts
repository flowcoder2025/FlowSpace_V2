import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processAssetGeneration } from "@/features/assets";
import type { CreateAssetParams } from "@/features/assets";

const ASSET_TYPE_MAP = {
  character: "CHARACTER",
  tileset: "TILESET",
  object: "OBJECT",
  map: "MAP",
} as const;

/** POST /api/assets/generate - 에셋 생성 작업 시작 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateAssetParams & {
      userId: string;
    };

    // 입력 유효성 검증
    if (!body.type || !body.name || !body.prompt) {
      return NextResponse.json(
        { error: "type, name, prompt are required" },
        { status: 400 }
      );
    }

    if (!["character", "tileset", "object", "map"].includes(body.type)) {
      return NextResponse.json(
        { error: "type must be one of: character, tileset, object, map" },
        { status: 400 }
      );
    }

    // TODO: 실제 인증에서 userId 가져오기
    const userId = body.userId || "system";

    // DB에 pending 상태로 생성
    const dbAsset = await prisma.generatedAsset.create({
      data: {
        userId,
        type: ASSET_TYPE_MAP[body.type],
        name: body.name,
        prompt: body.prompt,
        workflow: body.workflow || `${body.type}-default`,
        status: "PROCESSING",
      },
    });

    // 비동기로 에셋 생성 처리 (fire-and-forget)
    processAssetGeneration({
      type: body.type,
      name: body.name,
      prompt: body.prompt,
      workflow: body.workflow,
      seed: body.seed,
      width: body.width,
      height: body.height,
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
            metadata: JSON.parse(JSON.stringify(metadata)),
          },
        });
      })
      .catch(async (error) => {
        await prisma.generatedAsset.update({
          where: { id: dbAsset.id },
          data: {
            status: "FAILED",
            metadata: {
              error:
                error instanceof Error ? error.message : "Unknown error",
            },
          },
        });
      });

    return NextResponse.json(
      {
        id: dbAsset.id,
        status: "processing",
        message: "Asset generation started",
      },
      { status: 202 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to start asset generation",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
