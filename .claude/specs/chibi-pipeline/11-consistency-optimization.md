# Phase 11: IP-Adapter 일관성 최적화

> Epic: [chibi-pipeline](./README.md)
> 상태: 진행중 | 업데이트: 2026-02-23

## 목표
방향 간 캐릭터 일관성 향상 — 동일 캐릭터가 Down/Left/Up에서 동일한 디자인(헬멧, 갑옷, 망토)으로 보이도록 최적화

## Task 목록
- [x] Task 11.1: IP-Adapter end_at 파라미터 미주입 버그 수정
- [x] Task 11.2: ComfyUI MCP A/B 테스트 (weight_type, embeds_scaling, img2img 등)
- [x] Task 11.3: 최적 IP-Adapter 설정 확정 (style and composition)
- [x] Task 11.4: Down = Phase A 레퍼런스 직접 사용 (재생성 제거) → **11.6에서 번복됨**
- [ ] Task 11.5: Up 방향 핑크 아티팩트 수정 (Rembg 잔여)
- [x] Task 11.6: Down도 IP-Adapter 파이프라인으로 전환 (스케일 일관성)
- [ ] Task 11.7: Trellis2+UltraShape 3D 기반 파이프라인 탐색 (방향 일관성 근본 해결)

## 구현 상세

### Task 11.1: end_at 버그 수정
**파일:** `comfyui-workflows/character-chibi-ipadapter.json`
**문제:** `_meta.parameters`에 `ipadapter_weight`만 매핑, `start_at`/`end_at`/`weight_type`은 매핑 없음
→ constants에 endAt=0.5 설정해도 실제 워크플로우는 end_at=1.0으로 실행
**수정:** 3개 파라미터 추가 (`ipadapter_start_at`, `ipadapter_end_at`, `ipadapter_weight_type`)

### Task 11.2: A/B 테스트 (ComfyUI MCP)
| 테스트 | weight_type | weight | end_at | embeds | sampler | 결과 |
|--------|-------------|--------|--------|--------|---------|------|
| A | linear | 0.6 | 1.0 | V only | euler_a | 방향 OK, 디테일 불일치 |
| B | linear | 0.6 | 0.5 | V only | euler_a | A와 유사 |
| C | style transfer | 0.8 | 0.5 | V only | euler_a | 스타일 양호, 디테일 부분 유지 |
| D | strong style transfer | 0.6 | 0.5 | V only | euler_a | 망토 과도 강조 |
| E | linear | 1.0 | 1.0 | V only | dpmpp_2m | 모노크롬, 방향 붕괴 |
| F | linear | 1.2 | 1.0 | V only | dpmpp_2m | 트리 형태, 완전 실패 |
| G | linear(img2img) | 0.6 | 1.0 | V only | euler_a(d=0.6) | 디테일 유지 but 방향 전환 안됨 |
| H | linear(img2img) | 0.6 | 1.0 | V only | euler_a(d=0.75) | 방향 약간, 디테일 손실 |
| I | 없음(img2img) | - | - | - | euler_a(d=0.65) | 디테일 유지, 방향 전환 불가 |
| K | linear | 0.8 | 1.0 | K+V | euler_a | 모노크롬, 아티팩트 |
| **L** | **style and composition** | **0.8** | **0.5** | **V only** | **euler_a** | **최적! 디테일+방향 모두 양호** |
| M | style and composition | 0.8 | 0.5 | V only | euler_a(Up) | Up도 일관성 양호 |

### Task 11.3: 최적 설정
**파일:** `src/features/assets/internal/constants.ts`
```typescript
export const IPADAPTER_DEFAULTS = {
  weight: 0.8,                          // 0.6 → 0.8
  weightType: "style and composition",  // "linear" → "style and composition"
  startAt: 0.0,
  endAt: 0.5,
} as const;
```

### Task 11.4: Down = Phase A 레퍼런스 직접 사용 → **번복됨 (Task 11.6)**
**파일:** `src/features/assets/internal/processor.ts`
- 원래: Phase A ref를 Down 기저 프레임으로 직접 사용 (55초)
- **문제 발견**: Phase A(chibi-frame)와 Phase B(chibi-ipadapter) 간 캐릭터 스케일 차이 심각
  - Down(Phase A): 캔버스 60% → Left(Phase B): 캔버스 35% → 크기 불일치
- **번복**: Task 11.6에서 Down도 Phase B로 전환

### Task 11.6: Down도 IP-Adapter 파이프라인으로 전환
**파일:** `src/features/assets/internal/processor.ts`
- `CHIBI_IPADAPTER_DIRECTIONS`: `["left", "up"]` → `["down", "left", "up"]`
- `refFrameData` 변수 제거 (Phase A ref는 IP-Adapter용으로만 사용)
- Down 직접 사용 코드 블록 제거
- ComfyUI 호출: 3회 → 4회 (ref + down + left + up), 67초
- **결과**: 높이 완전 통일 (112px, stddev=0), Down/Up 폭 유사 (72/71px)
- **남은 문제**: Left/Right 캐릭터 디자인 불일치 (투구→둥근머리) → Task 11.7

### Task 11.7: Trellis2+UltraShape 3D 기반 파이프라인 탐색
**상태:** 미착수 (다음 세션)
**접근법:** 2D 치비 → Trellis2로 3D 변환 → 4방향 렌더링 → 100% 일관성
- Microsoft TRELLIS.2 (4B 파라미터 image-to-3D)
- UltraShape (메시 품질 개선)
- 참고: https://www.youtube.com/watch?v=H7gqMnK7wUc

## 변경된 파일
| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `comfyui-workflows/character-chibi-ipadapter.json` | 수정 | IP-Adapter 파라미터 3개 추가 |
| `src/features/assets/internal/constants.ts` | 수정 | IPADAPTER_DEFAULTS 최적화 |
| `src/features/assets/internal/processor.ts` | 수정 | Phase A/B 리팩토링, Down 직접 사용 |

## 다음으로 넘기는 것
- Trellis2+UltraShape 3D 파이프라인 구현 (Task 11.7) — 방향 일관성 근본 해결
- Up 하단 핑크 아티팩트 수정 (Task 11.5) — Rembg 잔여
- Left/Right 캐릭터 디자인 불일치 — IP-Adapter 한계, 3D 전환으로 해결 기대
