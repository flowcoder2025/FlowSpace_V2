# 핸드오프: Phaser 캔버스 검은 박스 (화면공유 picker 시 발생)

> 작성일: 2026-05-07 | 상태: 진단 미완료 | 우선순위: 중

## 증상

게임 룸(`/space/[id]`)에서 화면 공유 시작 시 Chrome `getDisplayMedia` 다이얼로그가 뜨는 동안, **소파 sprite 두 개 위치**에 큰 검은 사각형이 보임. 사용자가 picker에서 항목을 hover하면 사라졌다가, hover 해제 시 다시 나타남.

증상 스크린샷: `C:\Users\User\Pictures\Screenshots\스크린샷 2026-05-07 001010.png` 외 3장 (001016, 001022, 001027)

**오늘(2026-05-06) 변경 이전엔 없던 현상**. 사용자 명확히 지적.

## 추측한 원인 (검증 안 됨 — 모두 가설)

1. **Phaser `Scale.RESIZE`로 캔버스가 뷰포트 크기로 커짐 (커밋 `2f54c9d`)**: 4K 모니터에서 캔버스 픽셀 수 약 6배 증가 → picker가 페이지 RAF throttle 시 frame paint 미완성 → 일부 sprite 검게 남음
2. **캔버스 `backgroundColor` 변경 (커밋 `2f54c9d`)**: `#1a1a2e` (짙은 보라) → `#0a0a0a` (검정). 이전엔 sprite 안 그려져도 보라색이라 덜 띄었을 가능성. 이번엔 순수 검정이라 눈에 띄게 보임
3. **Page Visibility API throttle**: picker 모달이 페이지를 "백그라운드"로 만들어서 Phaser 일시 정지

**중요**: 위 셋 다 코드 검토 없이 추측한 것. 실제 원인은 다를 수 있음.

## 다음 세션에서 검증할 단계 (순서대로)

### 1. 검은 박스의 진짜 좌표 → 게임 월드 좌표 역추적
- DevTools Performance 탭으로 picker 떠있는 동안 frame 분석
- 검은 박스 픽셀 좌표 측정
- Phaser camera viewport / scroll 적용해서 게임 월드 좌표로 변환
- 그 좌표가 정말 sofa sprite 위치인지 검증 (`MainScene` 코드 + 맵 데이터)

### 2. 캔버스 backgroundColor 격리 테스트
- `phaser-config.ts`의 `backgroundColor`를 임시로 빨강(`#FF0000`)으로 변경
- 같은 현상 재현 시 검은 박스가 빨간 박스로 보이면 = 캔버스 background 노출 확정 (sprite 미렌더)
- 검은 박스 그대로면 = 다른 원인 (예: sprite 텍스처가 검은색으로 그려짐)

### 3. Scale.RESIZE 격리 테스트
- 임시로 `Scale.FIT` + 고정 960×640으로 되돌림
- 동일 환경에서 화면공유 picker 띄우고 같은 현상 재현되는지 확인
- 재현 안 됨 = `Scale.RESIZE`가 원인 확정
- 재현됨 = Scale 모드 무관, 다른 원인

### 4. 코드 정독 (검증 시작 전 필수)

| 파일 | 확인 내용 |
|------|----------|
| `src/features/space/game/internal/phaser-config.ts` | width/height/backgroundColor/scale.mode 현재 상태 |
| `src/features/space/game/internal/scenes/main-scene.ts` | sofa sprite 로드 (load.image), 카메라 setBounds, viewport 처리 |
| `src/features/space/game/internal/scenes/boot-scene.ts` | preload 시점 처리 |
| `src/features/space/game/internal/player/camera-controller.ts` | 카메라 follow / viewport 변경 코드 |
| `src/constants/game-constants.ts` | MAP_WIDTH/MAP_HEIGHT, TILE_SIZE 등 |
| `src/components/space/game-canvas.tsx` | 캔버스 컨테이너 CSS, parent 크기 |

### 5. 진짜 근본 해결 결정 (검증 완료 후)
가능한 후보들 (검증 결과에 따라 선택):
- 렌더 캔버스 크기 고정 + CSS scale (`Scale.ENVELOP` + 1920×1080 logical)
- Scale.FIT 복귀 (letterbox 수용)
- Page Visibility 핸들링 (Phaser pause/resume)
- backgroundColor 변경만 원복

## 현재 적용된 임시 상태 (변경 없음)

- Phaser `Scale.RESIZE` + 동적 width/height
- `backgroundColor: #0a0a0a`
- 게임 룸 컨테이너 `bg-ink`

## 사용자 영향 평가

- 증상은 **본인 화면에만 잠깐 보이는 시각적 잔재** (다른 참가자에게 송출 X, 공유되는 화면에도 영향 X)
- 보안/기능적 문제 아님
- UX 거슬림 정도

→ 즉시 fix 필요 수준은 아니고, 차분한 진단 후 근본 해결 권장

## 관련 커밋 (오늘 변경)

- `2f54c9d` feat: 디자인 시스템 전면 통합 + 게임 룸 풀스크린 전환 (Phaser Scale.RESIZE 도입)
- `c93b4da` revert: Phaser Scale.RESIZE 진단 원복 (이후)
- `c6bd4c1` revert: 진단용 원복 취소 (Scale.RESIZE 복원, 현재 상태)

## 자기 평가 (이전 세션 마지막에 사용자 지적 받음)

- 컨텍스트 무거워진 상태에서 코드 직접 안 보고 일반론으로 답변하는 패턴 발생
- 옵션 A/B/C 제안은 모두 회피책이지 근본 해결 아니었음
- 다음 세션에서는 위 검증 단계 1~4를 순서대로 실제로 실행한 후에만 해결책 제시할 것
