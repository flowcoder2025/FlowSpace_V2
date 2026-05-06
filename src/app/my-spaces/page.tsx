import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SpaceListView } from "@/components/spaces/space-list-view";

export default async function MySpacesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 lg:px-8 lg:py-16">
      <header className="mb-12">
        <h1 className="font-serif text-4xl font-medium tracking-tightest text-ink sm:text-5xl">
          내 스페이스
        </h1>
        <p className="mt-3 text-base text-ink-soft">
          매일 출근하는 가상의 사무실. 새로 만들거나 초대 받은 곳에 입장하세요.
        </p>
      </header>

      <SpaceListView />
    </main>
  );
}
