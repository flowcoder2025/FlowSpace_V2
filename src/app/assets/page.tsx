import { AssetGallery } from "@/components/assets/asset-gallery";

export default function AssetsPage() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">에셋 갤러리</h1>
        <p className="text-gray-600 mt-1">AI 생성 에셋 관리</p>
      </div>
      <AssetGallery />
    </main>
  );
}
