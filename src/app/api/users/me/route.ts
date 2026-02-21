import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET /api/users/me - 내 프로필 조회 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      avatarConfig: true,
      isSuperAdmin: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

/** avatarConfig 검증 */
function validateAvatarConfig(config: unknown): config is { avatarString?: string; color?: string } {
  if (typeof config !== "object" || config === null) return false;
  const obj = config as Record<string, unknown>;
  // avatarString (parts/classic/custom) 또는 color (레거시) 허용
  if (obj.avatarString !== undefined && typeof obj.avatarString !== "string") return false;
  if (obj.color !== undefined && typeof obj.color !== "string") return false;
  return true;
}

/** PATCH /api/users/me - 프로필 수정 */
export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    avatarConfig?: Record<string, unknown>;
  };

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;

  if (body.avatarConfig !== undefined) {
    if (!validateAvatarConfig(body.avatarConfig)) {
      return NextResponse.json(
        { error: "Invalid avatar config" },
        { status: 400 },
      );
    }
    data.avatarConfig = body.avatarConfig;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      avatarConfig: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(user);
}
