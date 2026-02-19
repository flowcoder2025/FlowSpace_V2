import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SpaceListView } from "@/components/spaces/space-list-view";

export default async function MySpacesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">FlowSpace</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{session.user.name || session.user.email}</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        <SpaceListView />
      </div>
    </main>
  );
}
