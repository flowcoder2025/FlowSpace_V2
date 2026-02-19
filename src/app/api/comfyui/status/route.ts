import { NextResponse } from "next/server";
import { ComfyUIClient } from "@/lib/comfyui";

export async function GET() {
  const client = new ComfyUIClient();
  const status = await client.getStatus();
  return NextResponse.json(status);
}
