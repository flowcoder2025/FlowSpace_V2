import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface AdminContext {
  userId: string;
  spaceId: string;
  role: "OWNER" | "STAFF";
  isSuperAdmin: boolean;
}

/**
 * 서버 컴포넌트/라우트에서 관리자 권한을 확인합니다.
 * OWNER, STAFF, 또는 superAdmin만 접근 가능합니다.
 */
export async function requireSpaceAdmin(spaceId: string): Promise<AdminContext> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;
  const isSuperAdmin = session.user.isSuperAdmin === true;

  // superAdmin은 항상 통과
  if (isSuperAdmin) {
    return { userId, spaceId, role: "OWNER", isSuperAdmin: true };
  }

  const member = await prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId, userId } },
    select: { role: true },
  });

  if (!member || (member.role !== "OWNER" && member.role !== "STAFF")) {
    redirect("/my-spaces");
  }

  return {
    userId,
    spaceId,
    role: member.role as "OWNER" | "STAFF",
    isSuperAdmin: false,
  };
}
