import Link from "next/link";
import { auth } from "@/lib/auth";
import { ROUTES } from "@/constants/navigation";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    return <Dashboard userName={session.user.name || session.user.email || "User"} />;
  }

  return <Hero />;
}

function Dashboard({ userName }: { userName: string }) {
  const actions = [
    {
      title: "My Spaces",
      description: "가상 공간 목록 보기",
      href: ROUTES.MY_SPACES,
      color: "bg-blue-50 hover:bg-blue-100 border-blue-200",
    },
    {
      title: "Assets",
      description: "AI 생성 에셋 관리",
      href: ROUTES.ASSETS,
      color: "bg-purple-50 hover:bg-purple-100 border-purple-200",
    },
    {
      title: "Create Space",
      description: "새 공간 만들기",
      href: ROUTES.SPACES_NEW,
      color: "bg-green-50 hover:bg-green-100 border-green-200",
    },
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-bold text-gray-900">
        Welcome, {userName}
      </h1>
      <p className="mt-2 text-gray-600">무엇을 하시겠습니까?</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={`rounded-lg border p-6 transition-colors ${action.color}`}
          >
            <h2 className="font-semibold text-gray-900">{action.title}</h2>
            <p className="mt-1 text-sm text-gray-600">{action.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}

function Hero() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <h1 className="text-4xl font-bold text-gray-900">FlowSpace</h1>
      <p className="mt-4 text-lg text-gray-600">
        ComfyUI 기반 에셋 파이프라인을 갖춘 가상 공간 플랫폼
      </p>
      <Link
        href={ROUTES.LOGIN}
        className="mt-8 rounded-md bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 transition-colors"
      >
        시작하기
      </Link>
    </main>
  );
}
