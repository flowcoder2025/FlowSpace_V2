import Link from "next/link";
import { AssetStudio } from "@/components/assets/asset-studio";
import { ROUTES } from "@/constants/navigation";

export default function AssetStudioPage() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link
          href={ROUTES.ASSETS}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; 에셋 목록으로
        </Link>
        <h1 className="text-2xl font-bold mt-2">에셋 스튜디오</h1>
        <p className="text-gray-600 mt-1">
          ComfyUI를 사용하여 게임 에셋을 생성하고 관리합니다
        </p>
      </div>
      <AssetStudio />
    </main>
  );
}
