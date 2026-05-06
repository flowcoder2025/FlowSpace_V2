import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CreateSpaceForm } from "@/components/spaces/create-space-form";

export default async function NewSpacePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream-deep p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-ink">Create Space</h1>
          <p className="mt-2 text-ink-muted">
            Set up a new virtual space for your team
          </p>
        </div>
        <CreateSpaceForm />
      </div>
    </main>
  );
}
