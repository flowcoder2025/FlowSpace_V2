# Phase 14: Chrome 146 화면공유 picker 검정 박스

> 작성일: 2026-05-07 | 상태: **KNOWN ISSUE (수용)** | 우선순위: 낮음

## 요약

Chrome 146 `getDisplayMedia` picker가 "창" / "전체화면" 탭에서 picker 모달 바로 아래에 페이지 캡처 preview를 그릴 때, **WebGL canvas 영역이 검정으로 fallback**되는 회귀.

**수용 결정**: 본인 화면에만 잠깐 보이는 시각적 잔재. 공유되는 화면/타 참가자에게 영향 없음. 기능적 문제 0. 코드 변경 없이 KNOWN ISSUE로 유지.

## 진단 결과 (완료)

### picker preview 메커니즘 (관찰 기반)

picker 모달 바로 아래 영역 = **Chrome이 현재 active OS 창의 라이브 캡처**를 표시하는 위치. 자기 자신(현재 Chrome 창)이 active면 self-capture 재귀가 발생하며, 페이지의 WebGL canvas 영역이 검정 fallback으로 표시됨.

- 다른 창(예: ChatGPT 탭)이 active일 때: picker preview에 그 창의 캡처가 정상 표시
- 자기 창이 active일 때: WebGL canvas 영역만 검정 fallback

### Canvas 유형별 격리 검증

| 테스트 조건 | 검정 박스 |
|------------|-----------|
| 빈 페이지 | 없음 |
| WebGL canvas 1개 추가 | **발생** |
| Canvas 2D (`fillRect`) | 없음 |

**결론**: WebGL canvas가 self-capture 재귀에서 검정 fallback의 직접 원인.

### 폐기된 가설 (전부 검증)

| 가설 | 검증 방법 | 결과 |
|------|----------|------|
| Scale.RESIZE 풀화면 | ZEP도 풀화면에서 정상 | 무관 |
| backgroundColor `#0a0a0a` | 빨강 변경 시 박스 그대로 | 무관 |
| Chrome picker 자체 동작 | ZEP = 동일 Chrome 146에서 정상 | 무관 |
| backdrop-filter | 글로벌 무력화 후 동일 | 무관 |
| `preserveDrawingBuffer: false` | 명시 후 동일 | 무관 |

### 시도/폐기된 해결책

| 옵션 | 내용 | 폐기 이유 |
|------|------|----------|
| A (Phaser.CANVAS) | WebGL → Canvas 2D 강제 | 박스 해결되지만 TilemapLayer + Canvas 2D에서 타일 sub-pixel 줄무늬 발생 → 원복 |
| D (게임 캔버스 hide) | 화면공유 중 `display:none` | Scale.RESIZE width=0 → WebGL Framebuffer Incomplete Attachment 크래시 → 원복 |

### 미검증 가설 (수용 결정으로 검증 보류)

V1 vs V2 차이:

| 항목 | V1 (flow_metaverse, 정상) | V2 (FlowSpace, 검정) |
|------|------|------|
| `pixelArt` | `true` (antialias 자동 false) | (없음, antialias:true) |
| `render.antialias` | (강제 false) | `true` |
| `render.roundPixels` | (강제 true) | `false` |
| WebGL `powerPreference` | `low-power` | `default` |

V2는 AI 치비 캐릭터 대응으로 `antialias: true` 추가됨. MSAA 버퍼와 picker self-capture 호환성이 후보 가설이지만 미검증. AI 캐릭터 품질 트레이드오프 평가 필요.

다른 후보:
- `getDisplayMedia({ selfBrowserSurface: "exclude" })` — 자기 창 picker 후보 제외 (단, 자기 화면 공유 use case 제한)
- ZEP 스타일 게임 월드 풀화면 + 참가자 패널 overlay 구조 개선 (picker 박스 무관, 시각 정리 차원)

## 사용자 영향

- 본인 시각적 잔재만 (picker 떠있는 짧은 동안)
- 공유되는 영상에 영향 없음
- 타 참가자에게 영향 없음
- 화면공유 기능 자체 정상 동작

## 관련 파일

- `src/features/space/game/internal/phaser-config.ts` — Phaser/WebGL 설정 위치 (변경 없음)

## 비고

- 증상 스크린샷: `C:\Users\User\Pictures\Screenshots\스크린샷 2026-05-07 001010.png` 외 다수
- 이전 핸드오프 문서: `.claude/specs/handoff/2026-05-07-phaser-canvas-black-boxes.md` (이 파일로 대체)
- 진단용 페이지 `src/app/test-screenshare/`: 본 진단 종료 후 제거 완료
- V1 비교 경로: `C:\Team-jane\flow_metaverse`
