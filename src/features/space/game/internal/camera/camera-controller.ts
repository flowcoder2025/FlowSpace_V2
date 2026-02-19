/**
 * Camera Controller - 카메라 팔로우 + 월드 바운드
 */

import {
  MAP_WIDTH,
  MAP_HEIGHT,
  CAMERA_LERP,
  CAMERA_DEADZONE_X,
  CAMERA_DEADZONE_Y,
} from "@/constants/game-constants";

export class CameraController {
  private camera: Phaser.Cameras.Scene2D.Camera;

  constructor(scene: Phaser.Scene, target: Phaser.GameObjects.Sprite) {
    this.camera = scene.cameras.main;

    // 월드 바운드
    this.camera.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // 타겟 팔로우 (lerp로 부드러운 추적)
    this.camera.startFollow(target, true, CAMERA_LERP, CAMERA_LERP);

    // 데드존 (중앙 영역에서 카메라 고정)
    this.camera.setDeadzone(CAMERA_DEADZONE_X, CAMERA_DEADZONE_Y);
  }
}
