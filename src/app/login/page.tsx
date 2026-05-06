import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/my-spaces");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream-deep p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-ink">FlowSpace</h1>
          <p className="mt-2 text-ink-muted">
            AI 에셋 파이프라인을 갖춘 가상 공간 플랫폼
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
