import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CreateSpaceForm } from "@/components/spaces/create-space-form";

export default async function NewSpacePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 lg:px-8 lg:py-16">
      <header className="mb-10">
        <h1 className="font-serif text-4xl font-medium tracking-tightest text-ink sm:text-5xl">
          새 스페이스
        </h1>
        <p className="mt-3 text-base text-ink-soft">
          템플릿을 고르고, 팀과 함께 사용할 가상 공간을 만드세요.
        </p>
      </header>
      <CreateSpaceForm />
    </main>
  );
}
