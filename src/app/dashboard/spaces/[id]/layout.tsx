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
  await requireSpaceAdmin(id);

  const space = await prisma.space.findUnique({
    where: { id },
    select: { name: true },
  });

  return (
    <div className="flex min-h-screen bg-cream-deep">
      <DashboardSidebar spaceId={id} spaceName={space?.name ?? DASHBOARD_COPY.NAV.spaceFallback} />
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
