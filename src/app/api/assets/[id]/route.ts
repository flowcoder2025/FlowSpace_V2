import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    const asset = await prisma.generatedAsset.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    return NextResponse.json(asset);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch asset",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
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

    // TODO: 파일 시스템에서 실제 파일 삭제

    await prisma.generatedAsset.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Asset deleted" });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete asset",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
