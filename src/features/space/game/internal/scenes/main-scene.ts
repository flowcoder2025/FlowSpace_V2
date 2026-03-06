/**
 * Main Scene - 씬 오케스트레이터
 *
 * 서브시스템 조합: Tilemap + LocalPlayer + RemotePlayerManager + Camera + Objects
 * EventBridge로 React에 SCENE_READY 알림
 */

import { SCENE_KEYS, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, DEPTH, MAP_COLS, MAP_ROWS, PLAYER_WIDTH, PLAYER_HEIGHT } from "@/constants/game-constants";
import { eventBridge, GameEvents } from "../../events";
import { createTilemapSystem, type TilemapResult } from "../tilemap/tilemap-system";
import { LocalPlayer } from "../player/local-player";
import { InputController } from "../player/input-controller";
import { TileCollisionChecker } from "../player/tile-collision-checker";
import { RemotePlayerManager } from "../remote/remote-player-manager";
import { CameraController } from "../camera/camera-controller";
import { ObjectManager } from "../objects/object-manager";
import { EditorSystem } from "@/features/space/editor/internal/editor-system";
import { createLoadableAssets, loadAssetsInScene } from "../asset-loader";
import { COLLISION_LAYER_NAMES } from "../tilemap/map-data";
import type { AssetGeneratedPayload } from "../../events";
import { CHIBI_CHARACTERS, getChibiTextureKey } from "@/features/space/avatar";

export class MainScene extends Phaser.Scene {
  tilemapResult!: TilemapResult;
  private localPlayer!: LocalPlayer;
  private inputController!: InputController;
  private tileCollisionChecker!: TileCollisionChecker;
  private remotePlayerManager!: RemotePlayerManager;
  private cameraController!: CameraController;
  private objectManager!: ObjectManager;
  private editorSystem!: EditorSystem;

  constructor() {
    super({ key: SCENE_KEYS.MAIN });
  }

  preload(): void {
    // AI 타일 이미지
    this.load.image("tile-wood-floor", "/assets/tiles/wood-floor.png");
    this.load.image("tile-carpet-floor", "/assets/tiles/carpet-floor.png");
    this.load.image("tile-wall", "/assets/tiles/wall.png");
    // AI 가구 오브젝트 (배경 제거됨)
    this.load.image("obj-desk", "/assets/objects/desk.png");
    this.load.image("obj-chair", "/assets/objects/chair.png");
    this.load.image("obj-bookshelf", "/assets/objects/bookshelf.png");
    this.load.image("obj-sofa", "/assets/objects/sofa.png");
    this.load.image("obj-plant", "/assets/objects/plant.png");
    this.load.image("obj-watercooler", "/assets/objects/watercooler.png");
    this.load.image("obj-whiteboard", "/assets/objects/whiteboard.png");
    this.load.image("obj-table", "/assets/objects/table.png");
    this.load.image("obj-chair-back", "/assets/objects/chair_back.png");
    // 치비 AI 캐릭터 스프라이트시트
    for (const ch of CHIBI_CHARACTERS) {
      this.load.spritesheet(getChibiTextureKey(ch.id), ch.spritePath, {
        frameWidth: PLAYER_WIDTH,
        frameHeight: PLAYER_HEIGHT,
      });
    }
  }

  create(): void {
    try {
      this.initWorld();
      this.initTilemap();
      this.initFurniture();
      this.initTileCollision();
      this.initPlayer();
      this.initRemotePlayers();
      this.initCamera();
      this.initObjects();
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
    if (this.inputController.isJumpPressed()) {
      this.localPlayer.jump();
    }
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

  /** 타일 충돌 체커 초기화 (충돌 레이어 데이터 추출) */
  private initTileCollision(): void {
    const collisionData: number[][][] = [];

    for (const layerName of COLLISION_LAYER_NAMES) {
      const layer = this.tilemapResult.layers.get(layerName);
      if (!layer) continue;

      // Phaser TilemapLayer에서 raw 데이터 추출
      const data: number[][] = [];
      for (let row = 0; row < MAP_ROWS; row++) {
        const rowData: number[] = [];
        for (let col = 0; col < MAP_COLS; col++) {
          const tile = layer.getTileAt(col, row);
          rowData.push(tile ? tile.index : -1);
        }
        data.push(rowData);
      }
      collisionData.push(data);
    }

    this.tileCollisionChecker = new TileCollisionChecker(
      MAP_COLS,
      MAP_ROWS,
      collisionData,
    );
  }

  /** 로컬 플레이어 아바타 업데이트 핸들러 */
  private onLocalAvatarUpdated = (payload: unknown) => {
    const { avatar } = payload as { avatar: string };
    this.localPlayer?.updateAvatar(avatar);
  };

  /** 에셋 생성 완료 → Phaser 런타임 텍스처 로드 */
  private onAssetGenerated = (payload: unknown) => {
    const data = payload as AssetGeneratedPayload;
    const filePath = data.metadata?.filePath as string | undefined;
    if (!filePath) return;

    const loadable = createLoadableAssets([
      { id: data.assetId, type: data.type, filePath, metadata: data.metadata },
    ]);

    loadAssetsInScene(this, loadable);
    this.load.start();
  };

  /** 로컬 플레이어 생성 */
  private initPlayer(): void {
    const userId = this.registry.get("userId") as string;
    const nickname = this.registry.get("nickname") as string;
    const avatar = this.registry.get("avatar") as string;

    // 스폰 위치: 문 앞 (타일 좌표)
    const spawnCol = 20;
    const spawnRow = 27;

    this.localPlayer = new LocalPlayer(this, {
      userId,
      nickname,
      avatar,
      col: spawnCol,
      row: spawnRow,
    });

    // 충돌 체커 주입
    this.localPlayer.setCollisionChecker(this.tileCollisionChecker);

    this.inputController = new InputController(this);

    // 아바타 변경 이벤트 수신
    eventBridge.on(GameEvents.PLAYER_AVATAR_UPDATED, this.onLocalAvatarUpdated);

    // 에셋 생성 완료 이벤트 수신 (런타임 동적 로드)
    eventBridge.on(GameEvents.ASSET_GENERATED, this.onAssetGenerated);
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

  /** AI 생성 가구 배치 — 타일 그리드 정렬 (플레이어와 동일 좌표계) */
  private initFurniture(): void {
    const T = TILE_SIZE;
    const H = T / 2; // TILE_HALF
    const S_LARGE = 0.16;  // 책상, 소파, 화이트보드 (~82px)
    const S_MED = 0.13;    // 의자, 책장, 정수기 (~67px)
    const S_SMALL = 0.11;  // 화분 (~56px)

    /** 타일 (col, row)에 가구 배치. 플레이어와 동일한 타일 그리드 사용. */
    const place = (key: string, col: number, row: number, scale: number) => {
      if (!this.textures.exists(key)) return;
      const img = this.add.image(
        col * T + H,   // 타일 가로 중심 (플레이어 x와 동일)
        (row + 1) * T, // 타일 세로 하단 (bottom-center origin, Y-sorting 대비)
        key,
      );
      img.setScale(scale);
      img.setDepth(DEPTH.FURNITURE);
      img.setOrigin(0.5, 1);
    };

    // === 좌측: 업무 영역 ===
    // 책상 row → 의자 row+2 (책상 앞에 앉는 구도)
    place("obj-desk", 6, 6, S_LARGE);
    place("obj-chair", 6, 8, S_MED);
    place("obj-desk", 12, 6, S_LARGE);
    place("obj-chair", 12, 8, S_MED);
    place("obj-desk", 18, 6, S_LARGE);
    place("obj-chair", 18, 8, S_MED);

    place("obj-desk", 6, 12, S_LARGE);
    place("obj-chair", 6, 14, S_MED);
    place("obj-desk", 12, 12, S_LARGE);
    place("obj-chair", 12, 14, S_MED);

    // === 우측: 회의/라운지 ===
    place("obj-whiteboard", 30, 4, S_LARGE);
    place("obj-sofa", 28, 10, S_LARGE);
    place("obj-sofa", 34, 10, S_LARGE);
    place("obj-plant", 25, 4, S_SMALL);
    place("obj-plant", 37, 4, S_SMALL);

    // === 하단: 휴게 공간 ===
    place("obj-bookshelf", 5, 20, S_MED);
    place("obj-bookshelf", 8, 20, S_MED);
    place("obj-watercooler", 20, 20, S_MED);
    place("obj-plant", 15, 21, S_SMALL);
    place("obj-plant", 25, 21, S_SMALL);
    place("obj-plant", 35, 21, S_SMALL);

    // === 테이블+의자 세트 (타일 정렬) ===
    place("obj-table", 28, 17, S_LARGE);
    place("obj-chair-back", 28, 18, S_MED);
    place("obj-table", 34, 17, S_LARGE);
    place("obj-chair-back", 34, 18, S_MED);
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
    eventBridge.off(GameEvents.ASSET_GENERATED, this.onAssetGenerated);
    this.localPlayer?.destroy();
    this.editorSystem?.destroy();
    this.remotePlayerManager?.destroy();
    this.objectManager?.destroy();
    this.inputController?.destroy();
    this.cameraController?.destroy();
  }
}
