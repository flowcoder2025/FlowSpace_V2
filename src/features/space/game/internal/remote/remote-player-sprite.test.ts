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
  remove: ReturnType<typeof vi.fn>;
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
    setText: vi.fn(() => go),
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
        const t: FakeTween = { config, remove: vi.fn() };
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

describe("RemotePlayerSprite — jump tween 생명주기 (WI-015)", () => {
  let sceneStub: ReturnType<typeof makeSceneStub>;

  beforeEach(() => {
    sceneStub = makeSceneStub();
  });

  it("jump()은 인스턴스(this)를 targets로 하는 tween을 생성한다", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rp = new RemotePlayerSprite(sceneStub.scene as any, INFO);
    rp.jump();

    const jumpTween = sceneStub.tweens.find((t) => "jumpOffsetY" in t.config);
    expect(jumpTween).toBeDefined();
    // jump tween의 targets는 GameObject가 아닌 RemotePlayerSprite 인스턴스 → Phaser 자동정리 대상 아님
    expect(jumpTween!.config.targets).toBe(rp);
  });

  it("destroy()는 jump tween을 명시적으로 제거하고 killTweensOf(this)를 호출한다 (stale tween 누수 차단)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rp = new RemotePlayerSprite(sceneStub.scene as any, INFO);
    rp.jump();
    const jumpTween = sceneStub.tweens.find((t) => "jumpOffsetY" in t.config)!;

    rp.destroy();

    // 변이검증: destroy에서 tween 정리가 빠지면 둘 다 실패
    expect(jumpTween.remove).toHaveBeenCalledTimes(1);
    expect(sceneStub.scene.tweens.killTweensOf).toHaveBeenCalledWith(rp);
  });

  it("점프 중이 아니어도 destroy()는 killTweensOf(this)로 안전하게 정리한다", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rp = new RemotePlayerSprite(sceneStub.scene as any, INFO);
    // jump 없이 destroy — 잔여 tween이 없어도 killTweensOf는 호출되어야 함(방어적)
    rp.destroy();
    expect(sceneStub.scene.tweens.killTweensOf).toHaveBeenCalledWith(rp);
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
