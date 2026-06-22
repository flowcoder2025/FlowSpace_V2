import { describe, it, expect, beforeEach, vi } from "vitest";

// avatar(sprite-generator → Phaser/canvas)·events(event-bridge) 모듈 mock.
vi.mock("@/features/space/avatar", () => ({
  parseAvatarString: vi.fn(() => ({})),
  generateAvatarSpriteFromConfig: vi.fn(() => "tex-key"),
  DIRECTION_FRAMES: {
    down: { start: 0, end: 7 },
    left: { start: 8, end: 15 },
    right: { start: 16, end: 23 },
    up: { start: 24, end: 31 },
  },
  IDLE_FRAMES: { down: 0, left: 8, right: 16, up: 24 },
}));
vi.mock("../../events", () => ({
  eventBridge: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
  GameEvents: { PLAYER_JUMPED: "player:jumped", PLAYER_MOVED: "player:moved" },
}));

import { LocalPlayer } from "./local-player";

function makeGameObjectStub() {
  const go = {
    x: 0,
    y: 0,
    setDepth: vi.fn(() => go),
    setScale: vi.fn(() => go),
    setAlpha: vi.fn(() => go),
    setOrigin: vi.fn(() => go),
    setTexture: vi.fn(() => go),
    setFrame: vi.fn(() => go),
    setPosition: vi.fn(() => go),
    destroy: vi.fn(),
    anims: { play: vi.fn(), stop: vi.fn() },
  };
  return go;
}

function makeSceneStub() {
  const scene = {
    add: {
      sprite: vi.fn(() => makeGameObjectStub()),
      text: vi.fn(() => makeGameObjectStub()),
      ellipse: vi.fn(() => makeGameObjectStub()),
    },
    tweens: {
      add: vi.fn((_config: Record<string, unknown>) => ({}) as Record<string, unknown>),
      killTweensOf: vi.fn(),
    },
    anims: {
      exists: vi.fn(() => true),
      create: vi.fn(),
      remove: vi.fn(),
      generateFrameNumbers: vi.fn(() => []),
    },
    time: { now: 0 },
  };
  return scene;
}

const OPTS = { userId: "u1", nickname: "닉", avatar: "a", col: 5, row: 5 };

describe("LocalPlayer — tween 생명주기 정리 (WI-015)", () => {
  let scene: ReturnType<typeof makeSceneStub>;

  beforeEach(() => {
    scene = makeSceneStub();
  });

  it("destroy()는 this·jumpState·sprite의 tween을 killTweensOf로 정리하고 GameObject를 파괴한다", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lp = new LocalPlayer(scene as any, OPTS);
    const sprite = lp.getSprite();

    lp.destroy();

    const killed = scene.tweens.killTweensOf.mock.calls.map((c) => c[0]);
    // 변이검증: startStep(this)·jump 궤적(jumpState)·스케일(sprite) target 누락 시 실패
    expect(killed).toContain(lp); // startStep tween (logicalX/Y)
    expect(killed).toContain(sprite); // jump 스케일 tween
    expect(killed.some((t) => t && typeof t === "object" && "offsetY" in t)).toBe(true); // jumpState 궤적 tween
    // GameObject 3종 파괴
    expect(sprite.destroy).toHaveBeenCalledTimes(1);
  });

  it("jump()은 sprite를 target으로 하는 스케일 tween을 만든다", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lp = new LocalPlayer(scene as any, OPTS);
    const sprite = lp.getSprite();
    scene.tweens.add.mockClear();

    lp.jump();

    const firstTweenCfg = scene.tweens.add.mock.calls[0][0] as { targets: unknown };
    expect(firstTweenCfg.targets).toBe(sprite);
  });
});
