import { AssetGenerateForm } from "@/components/assets/asset-generate-form";

export default function AssetGeneratePage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Generate Asset</h1>
        <p className="text-gray-600 mt-1">
          ComfyUI를 사용하여 게임 에셋을 생성합니다
        </p>
      </div>
      <AssetGenerateForm />
    </main>
  );
}
