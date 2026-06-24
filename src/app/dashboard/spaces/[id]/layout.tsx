import { redirect } from "next/navigation";
import { requireSpaceAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DASHBOARD_COPY } from "@/constants/dashboard-copy";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function DashboardLayout({ children, params }: LayoutProps) {
  const { id } = await params;
  const { isSuperAdmin } = await requireSpaceAdmin(id);

  const space = await prisma.space.findUnique({
    where: { id },
    select: { name: true, status: true },
  });

  // soft-delete(ARCHIVED)된 스페이스의 관리자 대시보드는 일반 OWNER/STAFF에게 닫는다.
  // (DELETE /api/spaces/[id]는 status=ARCHIVED만 설정하므로 멤버 행 기준 requireSpaceAdmin은
  //  삭제 후에도 통과 → 서브페이지가 직접 URL로 계속 열리던 결함.)
  // superAdmin은 감사/복원 목적의 조회만 허용한다(편집/삭제 정책은 별도 WI 결정).
  if (!isSuperAdmin && space?.status === "ARCHIVED") {
    redirect("/my-spaces");
  }

  return (
    <div className="flex min-h-screen bg-cream-deep">
      <DashboardSidebar spaceId={id} spaceName={space?.name ?? DASHBOARD_COPY.NAV.spaceFallback} />
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
