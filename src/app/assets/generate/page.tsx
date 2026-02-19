import Link from "next/link";
import { AssetGenerateForm } from "@/components/assets/asset-generate-form";
import { ROUTES } from "@/constants/navigation";

export default function AssetGeneratePage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <Link
            href={ROUTES.ASSETS}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Back to Assets
          </Link>
          <Link
            href={ROUTES.ASSETS_STUDIO}
            className="text-sm text-blue-500 hover:text-blue-700"
          >
            Studio &rarr;
          </Link>
        </div>
        <h1 className="text-2xl font-bold mt-2">Generate Asset</h1>
        <p className="text-gray-600 mt-1">
          ComfyUI를 사용하여 게임 에셋을 생성합니다
        </p>
      </div>
      <AssetGenerateForm />
    </main>
  );
}
