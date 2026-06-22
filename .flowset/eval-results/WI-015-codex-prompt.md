# 블라인드 적대 검증 — WI-015-fix: Phaser 잔여 생명주기 결함

당신은 독립 코드 검증자(codex)다. read-only로 레포(브랜치 `fix/WI-015-fix-phaser-lifecycle`)를 검토하고 **반드시 제공된 JSON 스키마로만** 산출하라. 추측 금지 — 파일:라인 근거. evaluator(Claude) 산출물 절대 미참조(상호 블라인드).

## WI-015 목표
2026-06-22 승격前 통합감사(9축 멀티에이전트+적대검증)가 phaser-lifecycle 축에서 확정한 P2 결함 2건 해소.

## 변경 (2 파일 + 1 테스트)
1. `src/features/space/game/internal/remote/remote-player-sprite.ts`
   - **결함**: `jump()`(구 L116-131)이 `tweens.add({ targets: this, jumpOffsetY, yoyo })`로 tween 생성. targets가 Phaser GameObject가 아닌 RemotePlayerSprite 인스턴스(일반 객체)라, `destroy()`(구 L178-181, sprite/nameText만 destroy)에서 Phaser 자동 tween 정리 대상이 아님 → 파괴 후 tween이 계속 `this.jumpOffsetY`를 갱신하며 인스턴스를 잡아두는 누수.
   - **수정**: `private jumpTween?: Phaser.Tweens.Tween` 필드 추가, jump()이 tween 참조 보관(onComplete에서 undefined로 클리어), `destroy()`에서 `jumpTween.remove()` + `scene.tweens.killTweensOf(this)` 후 sprite/nameText destroy. moveTo()의 tween은 sprite/nameText(GameObject) targets라 자동 정리됨(무변).
2. `src/features/space/game/internal/scenes/main-scene.ts`
   - **결함**: `onAssetGenerated`(L163)가 scene-active 가드 없이 `this.load.start()`(L173) 호출. ASSET_GENERATED가 SHUTDOWN/DESTROY 도중 비동기 발화하면 비활성 씬에서 로더 조작 → 상태 손상/크래시. BootScene(boot-scene.ts:71)은 `this.scene.isActive(SCENE_KEYS.BOOT)` 가드 보유.
   - **수정**: 핸들러 진입부에 `if (!this.scene.isActive(SCENE_KEYS.MAIN)) return;` 추가(BootScene 패턴 미러).
3. `remote-player-sprite.test.ts` 신규: scene 스텁 + avatar 모듈 mock으로 jump() targets===인스턴스 / destroy()가 jumpTween.remove()+killTweensOf(this) 호출 변이검증.

## 검토 관점
- jump tween 정리가 실제로 누수를 닫는가(remove + killTweensOf 중복/충분성). onComplete 정상 종료와 destroy 중도 종료 양쪽에서 안전한가(이미 완료된 tween에 remove 호출이 무해한가).
- moveTo tween(sprite/nameText targets)이 destroy 시 정리되는 게 맞는가(회귀 없음).
- MainScene 가드가 정상 경로(활성 씬에서 ASSET_GENERATED 수신 시 로드)를 막지 않는가. `SCENE_KEYS.MAIN` 키가 올바른가. shutdown(L300)의 eventBridge.off와 가드가 함께 race를 닫는가.
- game-engine.md 불변식(EventBridge only, 씬 생명주기) 위반 여부. 기계게이트(tsc0/lint0/vitest/build) 회귀.
- 놓친 동일 클래스 결함(비-GameObject targets tween이 다른 곳에 있는가)을 지목.

## r2 추가 변경 (r1 codex P2×2 반영)
r1에서 codex 지목: (a) RemotePlayerSprite.destroy()가 jump tween만 정리하고 moveTo tween(sprite/nameText)은 미정리 — Phaser는 GameObject destroy 시 tween 자동 제거 안 함 → onComplete가 파괴된 sprite.anims 접근 가능. (b) LocalPlayer에 동일 클래스(startStep `targets:this`, jump `targets:this.jumpState`, 스케일 `targets:sprite`)가 destroy서 미정리 — 실제 프로덕션 호출자(고영향). r2 해소:
- **포괄 정리로 통일**: 개별 tween ref 추적 대신 `destroy()`에서 모든 target에 `killTweensOf` 호출. RemotePlayerSprite: `killTweensOf(this)`+`killTweensOf(sprite)`+`killTweensOf(nameText)`. LocalPlayer: `killTweensOf(this)`+`killTweensOf(this.jumpState)`+`killTweensOf(sprite)`. (jumpTween 필드 추적 제거 — moveTo의 3 tween을 놓치므로 killTweensOf가 정답.)
- 테스트: remote-player-sprite.test.ts를 killTweensOf(this/sprite/nameText) 단언으로 갱신 + **local-player.test.ts 신규**(killTweensOf this/jumpState/sprite 변이검증).

검토 시: 두 클래스 destroy의 killTweensOf 대상이 그 클래스의 전 tween target을 빠짐없이 커버하는가(RemotePlayerSprite: this/sprite/nameText / LocalPlayer: this/jumpState/sprite). 활성 경로(이동·점프 중 정상 동작) 무회귀. 동일 클래스 잔여(다른 game/ 객체)가 있는가.

## r3 추가 변경 (r2 codex P2 반영)
r2에서 codex 지목: `interactive-object.ts`의 showIndicator() indicator tween(`targets:this.indicator, repeat:-1` 무한)이 destroy()서 미정리 — object-manager가 setNearby(false)/hideIndicator 없이 obj.destroy() 직접 호출 가능 → 무한 tween이 파괴된 indicator 영구 갱신. r3 해소:
- `InteractiveObject.destroy()`에 `this.scene.tweens.killTweensOf(this.indicator)` 추가(기존 glowTween.destroy() 보존 — glowTween은 ref 추적되어 정리됨).
- `interactive-object.test.ts` 신규: 근접 중(showIndicator 후) destroy()가 killTweensOf(indicator) 호출 변이검증 + glowTween.destroy 보존 확인.

검토 시: indicator tween 정리가 완전한가, glowTween 정리 회귀 없는가, game/ 내 동일 클래스(repeat:-1 또는 비-GameObject targets, destroy서 미정리 tween)가 더 남았는가.

이슈 severity P0~P3 + defer/deferRationale/fixNow. P0/P1 또는 fixNow=true면 FAIL, 경미 defer만이면 WARNING, 무결하면 PASS.
