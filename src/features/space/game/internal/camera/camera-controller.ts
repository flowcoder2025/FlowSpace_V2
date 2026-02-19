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
import { eventBridge, GameEvents } from "../../events";

export class CameraController {
  private camera: Phaser.Cameras.Scene2D.Camera;
  private target: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, target: Phaser.GameObjects.Sprite) {
    this.camera = scene.cameras.main;
    this.target = target;

    // 월드 바운드
    this.camera.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // 타겟 팔로우 (lerp로 부드러운 추적)
    this.camera.startFollow(target, true, CAMERA_LERP, CAMERA_LERP);

    // 데드존 (중앙 영역에서 카메라 고정)
    this.camera.setDeadzone(CAMERA_DEADZONE_X, CAMERA_DEADZONE_Y);

    eventBridge.on(GameEvents.EDITOR_EXIT, this.onEditorExit);
  }

  destroy(): void {
    eventBridge.off(GameEvents.EDITOR_EXIT, this.onEditorExit);
  }

  /** 에디터 종료 시 플레이어 팔로우 복원 */
  private onEditorExit = (): void => {
    this.camera.startFollow(this.target, true, CAMERA_LERP, CAMERA_LERP);
    this.camera.setDeadzone(CAMERA_DEADZONE_X, CAMERA_DEADZONE_Y);
  };
}
