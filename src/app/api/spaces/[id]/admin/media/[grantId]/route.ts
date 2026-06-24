import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { internalErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { enforceSpaceMutable } from "@/lib/space-status-policy";

interface RouteParams {
  params: Promise<{ id: string; grantId: string }>;
}

/** DELETE: 스포트라이트 권한 철회 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: spaceId, grantId } = await params;

    const member = await prisma.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId, userId: session.user.id } },
      select: { role: true },
    });

    if (!member && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (member && member.role !== "OWNER" && member.role !== "STAFF" && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // 비-ACTIVE 스페이스(soft-delete 등)는 스포트라이트 권한 철회 불가(superAdmin 포함, WI-046).
    const archivedGate = await enforceSpaceMutable(spaceId);
    if (archivedGate) return archivedGate;

    // grant가 해당 space에 속하는지 확인
    const grant = await prisma.spotlightGrant.findFirst({
      where: { id: grantId, spaceId },
    });

    if (!grant) {
      return NextResponse.json({ error: "Grant not found" }, { status: 404 });
    }

    await prisma.spotlightGrant.delete({ where: { id: grantId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalErrorResponse("DELETE /api/spaces/[id]/admin/media/[grantId]", error, "Failed to delete grant");
  }
}
