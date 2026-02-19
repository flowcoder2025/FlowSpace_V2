import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { JoinSpaceView } from "@/components/spaces/join-space-view";

interface PageProps {
  params: Promise<{ inviteCode: string }>;
}

export default async function JoinSpacePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { inviteCode } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <JoinSpaceView inviteCode={inviteCode} />
    </main>
  );
}
