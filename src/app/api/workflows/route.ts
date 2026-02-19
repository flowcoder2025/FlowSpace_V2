import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/workflows - 워크플로우 목록 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const assetType = searchParams.get("assetType");

    const where: Record<string, unknown> = {
      isActive: true,
    };

    if (assetType) {
      where.assetType = assetType.toUpperCase();
    }

    const workflows = await prisma.assetWorkflow.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        version: true,
        assetType: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ workflows });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch workflows",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
