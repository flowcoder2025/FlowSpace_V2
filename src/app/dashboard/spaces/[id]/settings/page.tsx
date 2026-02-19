import { requireSpaceAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { SpaceSettingsForm } from "@/components/dashboard/space-settings-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SettingsPage({ params }: PageProps) {
  const { id } = await params;
  await requireSpaceAdmin(id);

  const space = await prisma.space.findUnique({
    where: { id },
    select: {
      name: true,
      description: true,
      maxUsers: true,
      accessType: true,
      primaryColor: true,
      loadingMessage: true,
    },
  });

  if (!space) {
    return <div className="text-red-600">Space not found</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl">
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
    </div>
  );
}
