/**
 * 치비 캐릭터용 OpenPose 스켈레톤 이미지 생성
 *
 * 32개 포즈 (4방향 × 8 walk frames) 를 1024×1024 검정 배경 위에
 * 컬러 keypoints + limbs로 그린다.
 *
 * 출력: comfyui-workflows/poses/pose_{direction}_{index}.png
 *
 * Usage:
 *   npx tsx scripts/generate-pose-skeletons.ts
 */
import sharp from "sharp";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";

// ─── 상수 ───────────────────────────────────────────
const SIZE = 1024;
const OUT_DIR = join(process.cwd(), "comfyui-workflows", "poses");
const DIRECTIONS = ["down", "left", "right", "up"] as const;
const FRAMES_PER_DIR = 8;

// OpenPose BODY_25 컬러 (관절별)
const JOINT_COLOR: [number, number, number] = [255, 0, 0]; // 빨강
const LIMB_COLORS: Record<string, [number, number, number]> = {
  torso: [255, 85, 0],
  leftArm: [0, 255, 0],
  rightArm: [0, 170, 255],
  leftLeg: [255, 255, 0],
  rightLeg: [255, 0, 255],
  head: [0, 255, 170],
};

// ─── 치비 스켈레톤 비율 (2등신: 머리 ≈ 몸) ───
// 좌표는 0~1 정규화 후 SIZE에 매핑
//
// 2등신 치비 비율:
//   머리(head→neck): ~45% of total height
//   몸통(neck→hip):  ~25%
//   다리(hip→foot):  ~30%
//
// 전체 캐릭터 높이: 캔버스의 ~50% (0.22 ~ 0.72)
interface Keypoint {
  x: number;
  y: number;
}

interface Skeleton {
  joints: Record<string, Keypoint>;
  limbs: [string, string, [number, number, number]][];
}

/** 방향별 기본 포즈 생성 (치비 2등신 비율) */
function makeSkeleton(
  direction: (typeof DIRECTIONS)[number],
  frameIndex: number
): Skeleton {
  // 걷기 사이클: 8프레임 → 사인 기반 팔/다리 스윙
  const t = (frameIndex / FRAMES_PER_DIR) * Math.PI * 2;
  const swing = Math.sin(t) * 0.02; // 치비: 짧은 팔 → 작은 스윙
  const legSwing = Math.sin(t) * 0.03; // 치비: 짧은 다리 → 작은 스윙
  const bounce = Math.abs(Math.sin(t)) * 0.01; // 상하 바운스

  // 치비 2등신 기준점 (정면 down 기준)
  const cx = 0.5;
  const headY = 0.22 - bounce;    // 머리 꼭대기
  const neckY = 0.44 - bounce;    // 목 (머리가 전체의 ~45%)
  const shoulderY = 0.47 - bounce; // 어깨
  const hipY = 0.57 - bounce;     // 힙
  const kneeY = 0.64 - bounce;    // 무릎
  const footY = 0.72 - bounce;    // 발

  let joints: Record<string, Keypoint>;

  switch (direction) {
    case "down": {
      // 정면 — 치비: 좁은 어깨, 짧은 팔다리
      const shoulderW = 0.08;
      const hipW = 0.05;
      const legW = 0.04;
      joints = {
        head: { x: cx, y: headY },
        neck: { x: cx, y: neckY },
        lShoulder: { x: cx - shoulderW, y: shoulderY },
        rShoulder: { x: cx + shoulderW, y: shoulderY },
        lElbow: { x: cx - shoulderW - 0.01 + swing, y: shoulderY + 0.04 },
        rElbow: { x: cx + shoulderW + 0.01 - swing, y: shoulderY + 0.04 },
        lWrist: { x: cx - shoulderW - 0.02 + swing * 1.5, y: shoulderY + 0.08 },
        rWrist: { x: cx + shoulderW + 0.02 - swing * 1.5, y: shoulderY + 0.08 },
        lHip: { x: cx - hipW, y: hipY },
        rHip: { x: cx + hipW, y: hipY },
        lKnee: { x: cx - legW + legSwing, y: kneeY },
        rKnee: { x: cx + legW - legSwing, y: kneeY },
        lFoot: { x: cx - legW + legSwing * 1.3, y: footY },
        rFoot: { x: cx + legW - legSwing * 1.3, y: footY },
      };
      break;
    }
    case "up": {
      // 뒷면
      const shoulderW = 0.08;
      const hipW = 0.05;
      const legW = 0.04;
      joints = {
        head: { x: cx, y: headY },
        neck: { x: cx, y: neckY },
        lShoulder: { x: cx - shoulderW, y: shoulderY },
        rShoulder: { x: cx + shoulderW, y: shoulderY },
        lElbow: { x: cx - shoulderW - 0.01 - swing, y: shoulderY + 0.04 },
        rElbow: { x: cx + shoulderW + 0.01 + swing, y: shoulderY + 0.04 },
        lWrist: { x: cx - shoulderW - 0.02 - swing * 1.5, y: shoulderY + 0.08 },
        rWrist: { x: cx + shoulderW + 0.02 + swing * 1.5, y: shoulderY + 0.08 },
        lHip: { x: cx - hipW, y: hipY },
        rHip: { x: cx + hipW, y: hipY },
        lKnee: { x: cx - legW - legSwing, y: kneeY },
        rKnee: { x: cx + legW + legSwing, y: kneeY },
        lFoot: { x: cx - legW - legSwing * 1.3, y: footY },
        rFoot: { x: cx + legW + legSwing * 1.3, y: footY },
      };
      break;
    }
    case "left": {
      // 왼쪽 프로파일: 모든 관절 좌우 겹침 (약간의 앞뒤 분리)
      const offset = 0.015;
      joints = {
        head: { x: cx, y: headY },
        neck: { x: cx, y: neckY },
        lShoulder: { x: cx - offset, y: shoulderY },
        rShoulder: { x: cx + offset, y: shoulderY },
        lElbow: { x: cx - offset + swing * 2, y: shoulderY + 0.04 },
        rElbow: { x: cx + offset - swing * 2, y: shoulderY + 0.04 },
        lWrist: { x: cx - offset + swing * 3, y: shoulderY + 0.08 },
        rWrist: { x: cx + offset - swing * 3, y: shoulderY + 0.08 },
        lHip: { x: cx - offset, y: hipY },
        rHip: { x: cx + offset, y: hipY },
        lKnee: { x: cx - offset + legSwing * 2, y: kneeY },
        rKnee: { x: cx + offset - legSwing * 2, y: kneeY },
        lFoot: { x: cx - offset + legSwing * 2.5, y: footY },
        rFoot: { x: cx + offset - legSwing * 2.5, y: footY },
      };
      break;
    }
    case "right": {
      // 오른쪽 = 왼쪽 미러
      const offset = 0.015;
      joints = {
        head: { x: cx, y: headY },
        neck: { x: cx, y: neckY },
        lShoulder: { x: cx + offset, y: shoulderY },
        rShoulder: { x: cx - offset, y: shoulderY },
        lElbow: { x: cx + offset - swing * 2, y: shoulderY + 0.04 },
        rElbow: { x: cx - offset + swing * 2, y: shoulderY + 0.04 },
        lWrist: { x: cx + offset - swing * 3, y: shoulderY + 0.08 },
        rWrist: { x: cx - offset + swing * 3, y: shoulderY + 0.08 },
        lHip: { x: cx + offset, y: hipY },
        rHip: { x: cx - offset, y: hipY },
        lKnee: { x: cx + offset - legSwing * 2, y: kneeY },
        rKnee: { x: cx - offset + legSwing * 2, y: kneeY },
        lFoot: { x: cx + offset - legSwing * 2.5, y: footY },
        rFoot: { x: cx - offset + legSwing * 2.5, y: footY },
      };
      break;
    }
  }

  const limbs: Skeleton["limbs"] = [
    ["head", "neck", LIMB_COLORS.head],
    ["neck", "lShoulder", LIMB_COLORS.torso],
    ["neck", "rShoulder", LIMB_COLORS.torso],
    ["lShoulder", "lElbow", LIMB_COLORS.leftArm],
    ["lElbow", "lWrist", LIMB_COLORS.leftArm],
    ["rShoulder", "rElbow", LIMB_COLORS.rightArm],
    ["rElbow", "rWrist", LIMB_COLORS.rightArm],
    ["neck", "lHip", LIMB_COLORS.torso],
    ["neck", "rHip", LIMB_COLORS.torso],
    ["lHip", "lKnee", LIMB_COLORS.leftLeg],
    ["lKnee", "lFoot", LIMB_COLORS.leftLeg],
    ["rHip", "rKnee", LIMB_COLORS.rightLeg],
    ["rKnee", "rFoot", LIMB_COLORS.rightLeg],
  ];

  return { joints, limbs };
}

/** SVG 기반으로 스켈레톤 렌더링 → sharp PNG */
function renderSkeleton(skeleton: Skeleton): Buffer {
  const { joints, limbs } = skeleton;
  const r = 12; // 관절 원 반지름
  const strokeW = 6; // 사지 두께

  let svgLines = "";
  let svgCircles = "";

  // limbs 먼저 (뒤에 그려짐)
  for (const [from, to, color] of limbs) {
    const a = joints[from];
    const b = joints[to];
    if (!a || !b) continue;
    const ax = Math.round(a.x * SIZE);
    const ay = Math.round(a.y * SIZE);
    const bx = Math.round(b.x * SIZE);
    const by = Math.round(b.y * SIZE);
    svgLines += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="rgb(${color[0]},${color[1]},${color[2]})" stroke-width="${strokeW}" stroke-linecap="round"/>`;
  }

  // joints
  for (const [, kp] of Object.entries(joints)) {
    const px = Math.round(kp.x * SIZE);
    const py = Math.round(kp.y * SIZE);
    svgCircles += `<circle cx="${px}" cy="${py}" r="${r}" fill="rgb(${JOINT_COLOR[0]},${JOINT_COLOR[1]},${JOINT_COLOR[2]})"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" fill="black"/>
  ${svgLines}
  ${svgCircles}
</svg>`;

  return Buffer.from(svg);
}

async function main() {
  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  let count = 0;
  for (const dir of DIRECTIONS) {
    for (let i = 0; i < FRAMES_PER_DIR; i++) {
      const skeleton = makeSkeleton(dir, i);
      const svgBuf = renderSkeleton(skeleton);
      const pngBuf = await sharp(svgBuf).png().toBuffer();

      const filename = `pose_${dir}_${i}.png`;
      const outPath = join(OUT_DIR, filename);
      await sharp(pngBuf).toFile(outPath);
      count++;
    }
  }

  console.log(`✓ Generated ${count} pose skeletons in ${OUT_DIR}`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
