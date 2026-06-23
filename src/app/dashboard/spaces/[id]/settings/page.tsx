import { requireSpaceAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { SpaceSettingsForm } from "@/components/dashboard/space-settings-form";
import { DeleteSpaceSection } from "@/components/dashboard/delete-space-section";
import { DASHBOARD_COPY } from "@/constants/dashboard-copy";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SettingsPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await requireSpaceAdmin(id);

  const space = await prisma.space.findUnique({
    where: { id },
    select: {
      name: true,
      description: true,
      maxUsers: true,
      accessType: true,
      primaryColor: true,
      loadingMessage: true,
      // ownerId는 삭제 게이트 판단용으로만 조회한다(화면 미노출).
      ownerId: true,
    },
  });

  if (!space) {
    return <div className="text-red-600">{DASHBOARD_COPY.SETTINGS.notFound}</div>;
  }

  // 삭제 권한 = DELETE /api/spaces/[id] 게이트의 정확한 미러(superAdmin 또는 실소유자).
  // 설정 페이지는 STAFF도 진입 가능하나(requireSpaceAdmin) 삭제는 OWNER/superAdmin만.
  const canDelete = ctx.isSuperAdmin || space.ownerId === ctx.userId;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{DASHBOARD_COPY.SETTINGS.title}</h1>
      <div className="bg-white rounded-lg border border-line p-6 max-w-2xl">
        <SpaceSettingsForm
          spaceId={id}
          initialValues={{
            name: space.name,
            description: space.description || "",
            maxUsers: space.maxUsers,
            accessType: space.accessType,
            primaryColor: space.primaryColor || "#3b82f6",
            loadingMessage: space.loadingMessage || "",
          }}
        />
      </div>
      {canDelete && <DeleteSpaceSection spaceId={id} spaceName={space.name} />}
    </div>
  );
}
