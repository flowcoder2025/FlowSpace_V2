import { AssetList } from "@/components/assets/asset-list";
import Link from "next/link";

export default function AssetsPage() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Assets</h1>
          <p className="text-gray-600 mt-1">
            AI 생성 에셋 관리
          </p>
        </div>
        <Link
          href="/assets/generate"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Generate New
        </Link>
      </div>
      <AssetList />
    </main>
  );
}
