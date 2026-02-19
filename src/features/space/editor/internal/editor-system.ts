/**
 * Editor System - 에디터 모드 핵심 로직
 *
 * 타일 페인팅, 오브젝트 배치/선택/이동/삭제
 * EventBridge로 React UI와 통신
 */

import { TILE_SIZE, MAP_COLS, MAP_ROWS } from "@/constants/game-constants";
import { eventBridge, GameEvents } from "@/features/space/game/events";
import type {
  EditorToolChangePayload,
  EditorTileSelectPayload,
  EditorLayerSelectPayload,
  EditorLayerVisibilityPayload,
  EditorTilePaintRequestPayload,
} from "@/features/space/game/events";
import type { TilemapResult } from "@/features/space/game/internal/tilemap/tilemap-system";
import { GridOverlay } from "./grid-overlay";
import { EditorCursor } from "./editor-cursor";

export class EditorSystem {
  private gridOverlay: GridOverlay;
  private editorCursor: EditorCursor;
  private isActive = false;
  private activeTool: string = "paint";
  private activeLayer: string = "ground";
  private selectedTileIndex = 0;
  private selectedObjectType: string | null = null;
  private isPainting = false;

  // 오브젝트 드래그
  private selectedObjectId: string | null = null;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;

  // 자유 카메라
  private cameraKeys: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  } | null = null;

  constructor(
    private scene: Phaser.Scene,
    private tilemapResult: TilemapResult
  ) {
    this.gridOverlay = new GridOverlay(scene);
    this.editorCursor = new EditorCursor(scene);

    // EventBridge 리스너
    eventBridge.on(GameEvents.EDITOR_ENTER, this.onEnter);
    eventBridge.on(GameEvents.EDITOR_EXIT, this.onExit);
    eventBridge.on(GameEvents.EDITOR_TOOL_CHANGE, this.onToolChange);
    eventBridge.on(GameEvents.EDITOR_TILE_SELECT, this.onTileSelect);
    eventBridge.on(GameEvents.EDITOR_LAYER_SELECT, this.onLayerSelect);
    eventBridge.on(GameEvents.EDITOR_LAYER_VISIBILITY, this.onLayerVisibility);
    eventBridge.on(GameEvents.EDITOR_TILE_PAINT_REQUEST, this.onTilePaintRequest);

    // 마우스 입력
    scene.input.on("pointerdown", this.onPointerDown, this);
    scene.input.on("pointermove", this.onPointerMove, this);
    scene.input.on("pointerup", this.onPointerUp, this);
  }

  update(): void {
    if (!this.isActive) return;

    // 카메라 자유 이동
    this.updateFreeCamera();

    // 커서 업데이트
    const pointer = this.scene.input.activePointer;
    const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.editorCursor.update(worldPoint.x, worldPoint.y);
  }

  destroy(): void {
    eventBridge.off(GameEvents.EDITOR_ENTER, this.onEnter);
    eventBridge.off(GameEvents.EDITOR_EXIT, this.onExit);
    eventBridge.off(GameEvents.EDITOR_TOOL_CHANGE, this.onToolChange);
    eventBridge.off(GameEvents.EDITOR_TILE_SELECT, this.onTileSelect);
    eventBridge.off(GameEvents.EDITOR_LAYER_SELECT, this.onLayerSelect);
    eventBridge.off(GameEvents.EDITOR_LAYER_VISIBILITY, this.onLayerVisibility);
    eventBridge.off(GameEvents.EDITOR_TILE_PAINT_REQUEST, this.onTilePaintRequest);

    this.scene.input.off("pointerdown", this.onPointerDown, this);
    this.scene.input.off("pointermove", this.onPointerMove, this);
    this.scene.input.off("pointerup", this.onPointerUp, this);

    this.gridOverlay.destroy();
    this.editorCursor.destroy();
  }

  // ============================================
  // EventBridge handlers
  // ============================================

  private onEnter = (): void => {
    this.isActive = true;
    this.gridOverlay.show();
    this.editorCursor.show();
    this.setupFreeCamera();
  };

  private onExit = (): void => {
    this.isActive = false;
    this.isPainting = false;
    this.isDragging = false;
    this.gridOverlay.hide();
    this.editorCursor.hide();
    this.teardownFreeCamera();
  };

  private onToolChange = (payload: unknown): void => {
    const data = payload as EditorToolChangePayload;
    this.activeTool = data.tool;
    this.selectedObjectId = null;
  };

  private onTileSelect = (payload: unknown): void => {
    const data = payload as EditorTileSelectPayload;
    this.selectedTileIndex = data.tileIndex;
  };

  private onLayerSelect = (payload: unknown): void => {
    const data = payload as EditorLayerSelectPayload;
    this.activeLayer = data.layer;
  };

  private onLayerVisibility = (payload: unknown): void => {
    const data = payload as EditorLayerVisibilityPayload;
    const layer = this.tilemapResult.layers.get(data.layer);
    if (layer) {
      layer.setVisible(data.visible);
    }
  };

  private onTilePaintRequest = (payload: unknown): void => {
    const data = payload as EditorTilePaintRequestPayload;
    this.applyTile(data.layer, data.col, data.row, data.tileIndex);
  };

  // ============================================
  // Mouse handlers
  // ============================================

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.isActive) return;
    if (pointer.rightButtonDown()) return;

    const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const col = Math.floor(worldPoint.x / TILE_SIZE);
    const row = Math.floor(worldPoint.y / TILE_SIZE);

    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return;

    if (this.activeTool === "paint") {
      this.isPainting = true;
      this.paintTile(col, row);
    } else if (this.activeTool === "erase") {
      this.isPainting = true;
      this.eraseTile(col, row);
    } else if (this.activeTool === "object-place") {
      this.placeObject(col, row);
    } else if (this.activeTool === "select") {
      this.selectAtPosition(col, row);
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isActive) return;

    if (this.isPainting && pointer.isDown) {
      const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const col = Math.floor(worldPoint.x / TILE_SIZE);
      const row = Math.floor(worldPoint.y / TILE_SIZE);

      if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return;

      if (this.activeTool === "paint") {
        this.paintTile(col, row);
      } else if (this.activeTool === "erase") {
        this.eraseTile(col, row);
      }
    }

    if (this.isDragging && this.selectedObjectId && pointer.isDown) {
      const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const col = Math.floor(worldPoint.x / TILE_SIZE);
      const row = Math.floor(worldPoint.y / TILE_SIZE);

      if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return;

      if (col !== this.dragStartX || row !== this.dragStartY) {
        eventBridge.emit(GameEvents.EDITOR_OBJECT_MOVED, {
          id: this.selectedObjectId,
          positionX: col,
          positionY: row,
        });
        this.dragStartX = col;
        this.dragStartY = row;
      }
    }
  }

  private onPointerUp(): void {
    this.isPainting = false;
    this.isDragging = false;
  }

  // ============================================
  // Tile operations
  // ============================================

  private paintTile(col: number, row: number): void {
    this.applyTile(this.activeLayer, col, row, this.selectedTileIndex);
    eventBridge.emit(GameEvents.EDITOR_TILE_PAINTED, {
      layer: this.activeLayer,
      col,
      row,
      tileIndex: this.selectedTileIndex,
    });
  }

  private eraseTile(col: number, row: number): void {
    this.applyTile(this.activeLayer, col, row, -1);
    eventBridge.emit(GameEvents.EDITOR_TILE_PAINTED, {
      layer: this.activeLayer,
      col,
      row,
      tileIndex: -1,
    });
  }

  private applyTile(layerName: string, col: number, row: number, tileIndex: number): void {
    const layer = this.tilemapResult.layers.get(layerName);
    if (!layer) return;

    if (tileIndex < 0) {
      layer.removeTileAt(col, row);
    } else {
      layer.putTileAt(tileIndex, col, row);
    }

    // 충돌 업데이트
    if (layerName === "walls" || layerName === "furniture" || layerName === "collision") {
      layer.setCollisionByExclusion([-1]);
    }
  }

  // ============================================
  // Object operations
  // ============================================

  private placeObject(col: number, row: number): void {
    if (!this.selectedObjectType) return;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    eventBridge.emit(GameEvents.EDITOR_OBJECT_PLACED, {
      id: tempId,
      tempId,
      objectType: this.selectedObjectType,
      positionX: col,
      positionY: row,
    });
  }

  private selectAtPosition(col: number, row: number): void {
    // 간단한 위치 기반 선택 - 해당 타일 좌표에 오브젝트가 있는지 체크
    // 실제 오브젝트 목록은 React store에서 관리하므로 EventBridge로 알림
    eventBridge.emit(GameEvents.EDITOR_OBJECT_SELECTED, {
      id: null, // React에서 좌표 기반으로 실제 오브젝트 검색
      positionX: col,
      positionY: row,
    });
  }

  // ============================================
  // Free camera
  // ============================================

  private setupFreeCamera(): void {
    const camera = this.scene.cameras.main;
    camera.stopFollow();

    const kb = this.scene.input.keyboard!;
    this.cameraKeys = {
      W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W, false),
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A, false),
      S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S, false),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D, false),
    };
  }

  private teardownFreeCamera(): void {
    if (this.cameraKeys) {
      this.scene.input.keyboard!.removeKey(this.cameraKeys.W, true);
      this.scene.input.keyboard!.removeKey(this.cameraKeys.A, true);
      this.scene.input.keyboard!.removeKey(this.cameraKeys.S, true);
      this.scene.input.keyboard!.removeKey(this.cameraKeys.D, true);
      this.cameraKeys = null;
    }
  }

  private updateFreeCamera(): void {
    if (!this.cameraKeys) return;
    const speed = 8;
    const camera = this.scene.cameras.main;

    if (this.cameraKeys.A.isDown) camera.scrollX -= speed;
    if (this.cameraKeys.D.isDown) camera.scrollX += speed;
    if (this.cameraKeys.W.isDown) camera.scrollY -= speed;
    if (this.cameraKeys.S.isDown) camera.scrollY += speed;
  }
}
