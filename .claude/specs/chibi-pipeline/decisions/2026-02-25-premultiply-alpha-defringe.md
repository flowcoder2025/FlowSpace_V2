# Decision: Premultiply Alpha로 흰 테두리 해결

> 날짜: 2026-02-25 | Task: 12.23
> **⚠️ Superseded**: 이 문서의 원인 분석은 **부분적으로만 정확**. 근본 원인은 ref 이미지 오염 + IP-Adapter 전파로 재확정됨. → [2026-02-25-white-outline-root-cause.md](./2026-02-25-white-outline-root-cause.md) 참조

## 배경
Rembg 배경 제거 후 캐릭터 edge에 흰 halo 발생. 어두운 게임 배경에서 눈에 띔.

## 원인 (수정됨)
- ~~flowspace-chibi-v2 LoRA가 스티커형 흰 아웃라인을 캐릭터 일부로 생성~~ → LoRA 단독(Stage 2)에서는 흰 아웃라인 없음
- **근본 원인**: ref 이미지(ref_cXX.png)에 흰 아웃라인 포함 → IP-Adapter가 스타일로 전파 (Stage 3에서 등장)
- Rembg의 soft alpha gradient → 반투명+흰RGB 픽셀이 halo 형성 (부차적 원인)

## 시도 → 실패
1. **ComfyUI GrowMask erode (-2~-6)**: edge RGB 자체가 흰색 → 깎아도 다음 층도 흰색
2. **ThresholdMask + erode**: hard edge 되지만 white 남음
3. **프롬프트 `thick outline` 제거**: ref가 원인이라 프롬프트 무관 (95%→94%)
4. **배경색 변경 (green/simple)**: ref가 원인이라 배경 무관 (99~100%)

## 결정: Premultiply Alpha (부분 해결만)
반투명 픽셀(alpha<230)의 RGB를 `RGB * (alpha/255)`로 곱하기.

### 원리
- alpha=3, RGB=236 → RGB=236*(3/255)=2.8 → 거의 검정
- alpha 블렌딩: `result = 2.8 * (3/255) + bg * (252/255)` → bg 색이 지배 → halo 없음

### 한계
- **Band 1-2 (반투명 halo)만 해결** — Rembg가 만든 soft edge
- **Band 4-7 (불투명 흰색, alpha=255, 전체의 70%)은 처리 불가** — IP-Adapter가 전파한 스티커 아웃라인
- 이전 "95%→0%"는 Band 1만 측정한 수치. 전체 edge 기준으로는 개선 미미

### 올바른 해결 방향
1. **ref 이미지에서 흰 아웃라인 제거** (근본 해결)
2. **프롬프트에서 `thick outline, bold lineart` 제거** (ref 정리와 병행)
3. 남은 Rembg halo(Band 1-2)에만 premultiply 보조 적용
