import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-12 lg:px-8 lg:py-16">
      <header className="mb-10 text-center">
        <h1 className="font-serif text-4xl font-medium tracking-tightest text-ink sm:text-5xl">
          환영합니다.
        </h1>
        <p className="mt-3 text-base text-ink-soft">
          캐릭터와 이름을 설정하고 시작하세요.
        </p>
      </header>
      <OnboardingForm
        userId={session.user.id}
        currentName={session.user.name || ""}
        currentImage={session.user.image || ""}
      />
    </main>
  );
}
