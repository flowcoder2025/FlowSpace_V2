import { describe, it, expect, beforeEach, vi } from "vitest";
import { InteractiveObject } from "./interactive-object";

function makeGraphicsStub() {
  const g = {
    setDepth: vi.fn(() => g),
    setPosition: vi.fn(() => g),
    setAlpha: vi.fn(() => g),
    fillStyle: vi.fn(() => g),
    fillCircle: vi.fn(() => g),
    destroy: vi.fn(),
  };
  return g;
}

function makeTextStub() {
  const t = {
    setOrigin: vi.fn(() => t),
    setDepth: vi.fn(() => t),
    setVisible: vi.fn(() => t),
    setPosition: vi.fn(() => t),
    destroy: vi.fn(),
  };
  return t;
}

function makeSceneStub() {
  const glowTween = { destroy: vi.fn() };
  const scene = {
    add: {
      graphics: vi.fn(() => makeGraphicsStub()),
      text: vi.fn(() => makeTextStub()),
    },
    tweens: {
      add: vi.fn(() => glowTween),
      killTweensOf: vi.fn(),
    },
  };
  return { scene, glowTween };
}

const CONFIG = { id: "o1", type: "portal", x: 100, y: 200 };

describe("InteractiveObject — tween 생명주기 정리 (WI-015)", () => {
  let stub: ReturnType<typeof makeSceneStub>;

  beforeEach(() => {
    stub = makeSceneStub();
  });

  it("근접 중 destroy()는 indicator 무한 tween을 killTweensOf로 정리한다 (hideIndicator 미경유 경로)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = new InteractiveObject(stub.scene as any, CONFIG);
    const indicator = stub.scene.add.text.mock.results[0].value;
    // setNearby(true)로 indicator 떠다니는 tween(repeat:-1) 시작
    obj.setNearby(true);

    // object-manager는 setNearby(false) 없이 destroy()를 직접 호출할 수 있다
    obj.destroy();

    // 변이검증: destroy에서 killTweensOf(indicator)가 빠지면 실패
    expect(stub.scene.tweens.killTweensOf).toHaveBeenCalledWith(indicator);
    expect(indicator.destroy).toHaveBeenCalledTimes(1);
    // 기존 glowTween 정리도 보존
    expect(stub.glowTween.destroy).toHaveBeenCalled();
  });

  it("근접하지 않은 상태에서 destroy()도 안전하다", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = new InteractiveObject(stub.scene as any, CONFIG);
    const indicator = stub.scene.add.text.mock.results[0].value;

    obj.destroy();

    expect(stub.scene.tweens.killTweensOf).toHaveBeenCalledWith(indicator);
    expect(indicator.destroy).toHaveBeenCalledTimes(1);
  });
});
