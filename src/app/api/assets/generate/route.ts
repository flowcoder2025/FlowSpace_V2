import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { internalErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { processAssetGeneration, GENERATION_FAILURE_MESSAGE } from "@/features/assets";
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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as CreateAssetParams;

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

    const userId = session.user.id;

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
      negativePrompt: body.negativePrompt,
      steps: body.steps,
      cfgScale: body.cfgScale,
      samplerName: body.samplerName,
      scheduler: body.scheduler,
      qualityPreset: body.qualityPreset,
      removeBackground: body.removeBackground,
      bgRemovalTolerance: body.bgRemovalTolerance,
      seamless: body.seamless,
      useControlNet: body.useControlNet,
      controlNetModel: body.controlNetModel,
      controlNetStrength: body.controlNetStrength,
      poseImage: body.poseImage,
      useChibiStyle: body.useChibiStyle,
      loraStrength: body.loraStrength,
      controlNetStart: body.controlNetStart,
      controlNetEnd: body.controlNetEnd,
      ipAdapterWeight: body.ipAdapterWeight,
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
        // raw 에러는 서버 로그에만 (WI-024, CWE-209): metadata.error로 저장하면
        // GET /api/assets/[id] 응답으로 내부 정보가 새 나간다 → generic으로 정규화.
        console.error("[POST /api/assets/generate] 비동기 에셋 생성 실패", error);
        await prisma.generatedAsset.update({
          where: { id: dbAsset.id },
          data: {
            status: "FAILED",
            metadata: { error: GENERATION_FAILURE_MESSAGE },
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
    return internalErrorResponse("POST /api/assets/generate", error, "Failed to start asset generation");
  }
}
