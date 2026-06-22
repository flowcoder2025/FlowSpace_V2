import { describe, it, expect, beforeEach, vi } from "vitest";

// avatar 모듈은 sprite-generator가 Phaser/canvas에 의존하므로 전체 mock.
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

import { RemotePlayerSprite } from "./remote-player-sprite";

interface FakeTween {
  config: Record<string, unknown>;
}

function makeGameObjectStub() {
  const go = {
    x: 0,
    y: 0,
    setDepth: vi.fn(() => go),
    setScale: vi.fn(() => go),
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
  const tweens: FakeTween[] = [];
  const scene = {
    add: {
      sprite: vi.fn(() => makeGameObjectStub()),
      text: vi.fn(() => makeGameObjectStub()),
    },
    tweens: {
      add: vi.fn((config: Record<string, unknown>) => {
        const t: FakeTween = { config };
        tweens.push(t);
        return t;
      }),
      killTweensOf: vi.fn(),
    },
    anims: {
      exists: vi.fn(() => true),
      create: vi.fn(),
      remove: vi.fn(),
      generateFrameNumbers: vi.fn(() => []),
    },
  };
  return { scene, tweens };
}

const INFO = { userId: "u1", nickname: "닉", avatar: "a", x: 10, y: 20, direction: "down" };

describe("RemotePlayerSprite — tween 생명주기 정리 (WI-015)", () => {
  let sceneStub: ReturnType<typeof makeSceneStub>;

  beforeEach(() => {
    sceneStub = makeSceneStub();
  });

  it("jump()은 인스턴스(this)를 targets로 하는 tween을 만든다 (GameObject 아님 → Phaser 자동정리 대상 아님)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rp = new RemotePlayerSprite(sceneStub.scene as any, INFO);
    rp.jump();

    const jumpTween = sceneStub.tweens.find((t) => "jumpOffsetY" in t.config);
    expect(jumpTween).toBeDefined();
    expect(jumpTween!.config.targets).toBe(rp);
  });

  it("destroy()는 this·sprite·nameText의 tween을 모두 killTweensOf로 정리한다", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rp = new RemotePlayerSprite(sceneStub.scene as any, INFO);
    const sprite = sceneStub.scene.add.sprite.mock.results[0].value;
    const nameText = sceneStub.scene.add.text.mock.results[0].value;
    rp.jump(); // this-target tween
    rp.moveTo(99, 99, "left"); // sprite/nameText-target tween

    rp.destroy();

    const killed = sceneStub.scene.tweens.killTweensOf.mock.calls.map((c) => c[0]);
    // 변이검증: 세 target 중 하나라도 killTweensOf에서 빠지면 실패
    expect(killed).toContain(rp); // jump tween
    expect(killed).toContain(sprite); // moveTo x/y tween
    expect(killed).toContain(nameText); // moveTo x tween
    // GameObject 파괴도 수행
    expect(sprite.destroy).toHaveBeenCalledTimes(1);
    expect(nameText.destroy).toHaveBeenCalledTimes(1);
  });

  it("점프 없이 destroy()해도 모든 target을 안전하게 killTweensOf한다", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rp = new RemotePlayerSprite(sceneStub.scene as any, INFO);
    const sprite = sceneStub.scene.add.sprite.mock.results[0].value;
    const nameText = sceneStub.scene.add.text.mock.results[0].value;

    rp.destroy();

    const killed = sceneStub.scene.tweens.killTweensOf.mock.calls.map((c) => c[0]);
    expect(killed).toContain(rp);
    expect(killed).toContain(sprite);
    expect(killed).toContain(nameText);
  });

  it("이미 점프 중이면 jump()는 중복 tween을 만들지 않는다", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rp = new RemotePlayerSprite(sceneStub.scene as any, INFO);
    rp.jump();
    rp.jump();
    const jumpTweens = sceneStub.tweens.filter((t) => "jumpOffsetY" in t.config);
    expect(jumpTweens).toHaveLength(1);
  });
});
