import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SpaceListView } from "@/components/spaces/space-list-view";

export default async function MySpacesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <SpaceListView />
    </main>
  );
}
