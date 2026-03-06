# Decision: 코드 기반 걷기 애니메이션 (AI 생성 폐기)

> Date: 2026-02-25
> Epic: chibi-pipeline / Phase 12
> Status: 채택

## 결정
standing 스프라이트에서 코드(Python)로 걷기 프레임 생성.
AI(txt2img/img2img) 걷기 포즈 생성은 폐기.

## AI 실패 근거
1. txt2img (별도 생성): 걷기 포즈 나오지만 얼굴/머리 다름 (identity 불일치)
2. img2img (standing→walking): denoise 0.35~0.50 모두 다리 포즈 변화 없음
   - Depth ControlNet str=0.3이 img2img latent의 다리를 못 바꿈

## 코드 기반 접근
- `scripts/generate-walking-frames.py`
- standing에서 상체/다리 분리 → 다리만 프로그래밍 이동
- 4프레임 사이클, 8방향 (대각선 = 측면 재사용)
- 장점: identity 100% 보존 (standing과 "한 뿌리")
