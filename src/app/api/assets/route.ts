import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET /api/assets - 에셋 목록 (필터링) */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const userId = searchParams.get("userId") || session.user.id;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const where: Record<string, unknown> = {};

    if (type) {
      where.type = type.toUpperCase();
    }
    if (status) {
      where.status = status.toUpperCase();
    }
    if (userId) {
      where.userId = userId;
    }

    const [assets, total] = await Promise.all([
      prisma.generatedAsset.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          type: true,
          name: true,
          prompt: true,
          status: true,
          filePath: true,
          thumbnailPath: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.generatedAsset.count({ where }),
    ]);

    return NextResponse.json({
      assets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch assets",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
