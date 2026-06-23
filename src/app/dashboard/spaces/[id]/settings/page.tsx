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

  // owner-or-superAdmin = 설정 편집(PATCH)·삭제(DELETE) 두 서버 게이트의 공통 판정식.
  // 설정 페이지는 STAFF도 진입 가능하나(requireSpaceAdmin) 편집/삭제는 owner/superAdmin만.
  // 편집과 삭제는 현재 표현식이 같지만 의미상 서로 다른 서버 게이트의 미러이므로
  // (향후 정책 발산 대비) 렌더 판단 변수는 분리해 둔다(WI-041).
  const isOwnerOrSuperAdmin = ctx.isSuperAdmin || space.ownerId === ctx.userId;
  const canEditSettings = isOwnerOrSuperAdmin; // PATCH /api/spaces/[id] 게이트 미러
  const canDelete = isOwnerOrSuperAdmin; // DELETE /api/spaces/[id] 게이트 미러

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{DASHBOARD_COPY.SETTINGS.title}</h1>
      <div className="bg-white rounded-lg border border-line p-6 max-w-2xl">
        <SpaceSettingsForm
          spaceId={id}
          canEdit={canEditSettings}
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
