/**
 * Main Scene - 씬 오케스트레이터
 *
 * 서브시스템 조합: Tilemap + LocalPlayer + RemotePlayerManager + Camera + Objects
 * EventBridge로 React에 SCENE_READY 알림
 */

import { SCENE_KEYS, MAP_WIDTH, MAP_HEIGHT } from "@/constants/game-constants";
import { eventBridge, GameEvents } from "../../events";
import { createTilemapSystem, type TilemapResult } from "../tilemap/tilemap-system";
import { LocalPlayer } from "../player/local-player";
import { InputController } from "../player/input-controller";
import { RemotePlayerManager } from "../remote/remote-player-manager";
import { CameraController } from "../camera/camera-controller";
import { ObjectManager } from "../objects/object-manager";
import { EditorSystem } from "@/features/space/editor/internal/editor-system";

export class MainScene extends Phaser.Scene {
  tilemapResult!: TilemapResult;
  private localPlayer!: LocalPlayer;
  private inputController!: InputController;
  private remotePlayerManager!: RemotePlayerManager;
  private cameraController!: CameraController;
  private objectManager!: ObjectManager;
  private editorSystem!: EditorSystem;

  constructor() {
    super({ key: SCENE_KEYS.MAIN });
  }

  create(): void {
    try {
      this.initWorld();
      this.initTilemap();
      this.initPlayer();
      this.initRemotePlayers();
      this.initCamera();
      this.initObjects();
      this.initCollisions();
      this.initEditor();
      this.notifyReady();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown scene error";
      eventBridge.emit(GameEvents.SCENE_ERROR, { error: message });
    }
  }

  update(): void {
    if (!this.localPlayer) return;

    // 에디터 업데이트
    this.editorSystem?.update();

    // 입력 처리
    const input = this.inputController.getMovement();
    this.localPlayer.update(input);

    // 원격 플레이어 보간
    this.remotePlayerManager.update();

    // 오브젝트 근접 체크
    this.objectManager.checkProximity(
      this.localPlayer.getPosition().x,
      this.localPlayer.getPosition().y
    );
  }

  /** 월드 바운드 설정 */
  private initWorld(): void {
    this.physics.world.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
  }

  /** 타일맵 서브시스템 초기화 */
  private initTilemap(): void {
    const storedMapData = this.registry.get("mapData") as
      | { layers: Record<string, number[][]> }
      | undefined;
    const externalLayers = storedMapData?.layers ?? undefined;
    this.tilemapResult = createTilemapSystem(this, externalLayers);
  }

  /** 로컬 플레이어 아바타 업데이트 핸들러 */
  private onLocalAvatarUpdated = (payload: unknown) => {
    const { avatar } = payload as { avatar: string };
    this.localPlayer?.updateAvatar(avatar);
  };

  /** 로컬 플레이어 생성 */
  private initPlayer(): void {
    const userId = this.registry.get("userId") as string;
    const nickname = this.registry.get("nickname") as string;
    const avatar = this.registry.get("avatar") as string;

    // 스폰 위치: 문 앞 (20, 27 타일 = 640, 864 픽셀)
    const spawnX = 20 * 32;
    const spawnY = 27 * 32;

    this.localPlayer = new LocalPlayer(this, {
      userId,
      nickname,
      avatar,
      x: spawnX,
      y: spawnY,
    });

    this.inputController = new InputController(this);

    // 아바타 변경 이벤트 수신
    eventBridge.on(GameEvents.PLAYER_AVATAR_UPDATED, this.onLocalAvatarUpdated);
  }

  /** 원격 플레이어 매니저 초기화 */
  private initRemotePlayers(): void {
    this.remotePlayerManager = new RemotePlayerManager(this);
  }

  /** 카메라 설정 */
  private initCamera(): void {
    this.cameraController = new CameraController(this, this.localPlayer.getSprite());
  }

  /** 오브젝트 매니저 초기화 */
  private initObjects(): void {
    this.objectManager = new ObjectManager(this);
  }

  /** 충돌 설정 */
  private initCollisions(): void {
    const playerSprite = this.localPlayer.getSprite();
    for (const collisionLayer of this.tilemapResult.collisionLayers) {
      this.physics.add.collider(playerSprite, collisionLayer);
    }
  }

  /** 에디터 시스템 초기화 */
  private initEditor(): void {
    this.editorSystem = new EditorSystem(this, this.tilemapResult);
  }

  /** SCENE_READY 이벤트 발행 */
  private notifyReady(): void {
    eventBridge.emit(GameEvents.SCENE_READY, {
      sceneKey: SCENE_KEYS.MAIN,
    });
  }

  /** 씬 종료 시 정리 */
  shutdown(): void {
    eventBridge.off(GameEvents.PLAYER_AVATAR_UPDATED, this.onLocalAvatarUpdated);
    this.editorSystem?.destroy();
    this.remotePlayerManager?.destroy();
    this.objectManager?.destroy();
    this.inputController?.destroy();
    this.cameraController?.destroy();
  }
}
