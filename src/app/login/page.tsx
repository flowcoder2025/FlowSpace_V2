import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ROUTES } from "@/constants/navigation";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/my-spaces");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream-deep/40 p-6">
      <div className="w-full max-w-md">
        <div className="mb-10 flex flex-col items-center text-center">
          <Link href={ROUTES.HOME} className="flex items-center gap-2">
            <Image
              src="/Logo.png"
              alt="FlowSpace"
              width={40}
              height={40}
              priority
            />
            <span className="font-serif text-2xl font-medium tracking-tight text-ink">
              FlowSpace
            </span>
          </Link>
          <h1 className="mt-8 font-serif text-3xl font-medium tracking-tightest text-ink sm:text-4xl">
            다시 오셨네요.
          </h1>
          <p className="mt-3 text-sm text-ink-soft">
            팀이 모이는 가상의 사무실로 입장하세요.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
