import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkComfyUICapabilities } from "@/features/assets/internal/capability-checker";

/** GET /api/comfyui/capabilities - ComfyUI 기능 지원 현황 조회 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const capabilities = await checkComfyUICapabilities();
    return NextResponse.json(capabilities);
  } catch {
    return NextResponse.json(
      { controlNet: false, controlNetModels: [] },
      { status: 200 }
    );
  }
}
