import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Welcome!</h1>
          <p className="mt-2 text-gray-600">Set up your profile to get started</p>
        </div>
        <OnboardingForm
          userId={session.user.id}
          currentName={session.user.name || ""}
          currentImage={session.user.image || ""}
        />
      </div>
    </main>
  );
}
