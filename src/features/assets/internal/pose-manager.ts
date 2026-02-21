import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { ComfyUIClient } from "@/lib/comfyui";

const POSES_DIR = join(process.cwd(), "comfyui-workflows", "poses");
const SUBFOLDER = "chibi-poses";
const DIRECTIONS = ["down", "left", "right", "up"] as const;
const FRAMES_PER_DIR = 8;

let uploadedOnce = false;

/**
 * 32개 포즈 이미지를 ComfyUI input 디렉토리에 일괄 업로드
 *
 * 이미 업로드한 경우 스킵 (프로세스 수명 내 1회만 실행).
 */
export async function ensurePosesUploaded(client: ComfyUIClient): Promise<void> {
  if (uploadedOnce) return;

  for (const dir of DIRECTIONS) {
    for (let i = 0; i < FRAMES_PER_DIR; i++) {
      const filename = `pose_${dir}_${i}.png`;
      const localPath = join(POSES_DIR, filename);

      if (!existsSync(localPath)) {
        console.warn(
          `[PoseManager] 포즈 파일 없음: ${localPath}. npx tsx scripts/generate-pose-skeletons.ts 실행 필요`
        );
        continue;
      }

      const buf = await readFile(localPath);
      await client.uploadImage(buf, filename, SUBFOLDER);
    }
  }

  uploadedOnce = true;
  console.log(`[PoseManager] ${DIRECTIONS.length * FRAMES_PER_DIR}개 포즈 업로드 완료`);
}

/** 프레임별 포즈 이미지 참조 경로 반환 (ComfyUI LoadImage 노드용) */
export function getPoseImageRef(
  direction: string,
  frameIndex: number
): string {
  return `${SUBFOLDER}/pose_${direction}_${frameIndex}.png`;
}
