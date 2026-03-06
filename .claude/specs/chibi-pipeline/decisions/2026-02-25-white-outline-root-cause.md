# Decision: 흰 아웃라인 근본 원인 재확정

> **Date**: 2026-02-25
> **Status**: 확정 (이전 결론 번복)

## 이전 결론 (부정확)
- "flowspace-chibi-v2 LoRA가 스티커형 흰 아웃라인 생성"
- "premultiply alpha가 해법 (95%→0%)"

## 새 결론 (단계별 디버깅으로 확정)

### 근본 원인: ref 이미지 오염 + IP-Adapter 전파

**단계별 증거:**
| Stage | 구성 | 흰 아웃라인 |
|-------|------|-----------|
| 1 | Checkpoint만 | 없음 |
| 2 | + LoRA 0.6 | **없음** |
| 3 | + IP-Adapter | **등장!** |
| 4 | + ControlNet | 유지 |
| 5 | + Rembg | 확정 |

**메커니즘:**
1. 최초 ref 생성 시 프롬프트 `thick outline, bold lineart` + LoRA → 흰 아웃라인 포함 이미지
2. 이 이미지를 ref_cXX.png로 저장
3. IP-Adapter가 ref의 흰 아웃라인을 "스타일"로 학습
4. 모든 생성물에 흰 아웃라인 전파 (피드백 루프)

### 해결 방향
1. ref 이미지에서 흰 아웃라인 제거 (또는 Stage 2 출력으로 교체)
2. 프롬프트에서 `thick outline, bold lineart` 제거
3. 남은 Rembg halo(반투명)에만 premultiply 보조 적용

## 이전 premultiply 분석의 오류
- "95%→0%" → Band 1(반투명, 외곽 1px)만 측정
- 실제 가시적 문제는 Band 4-7의 **불투명 흰색(alpha=255, 70%)** → premultiply 대상 아님
- 시각적으로 원본과 거의 차이 없었음 (어두운 배경 합성 비교)

## 재검토 필요 실험 목록
ref에 흰 아웃라인이 포함된 상태에서 진행된 모든 IP-Adapter 관련 실험:

1. **IP-Adapter weight_type 13종 비교 (§6)**: 모든 비교가 오염된 ref 기반 → 결론 자체는 유효할 수 있으나 재검증 권장
2. **back 주황 마크 테스트 (§3 Test A~F)**: ref의 주황은 실제 캐릭터 요소지만, 흰 아웃라인도 함께 전파됨
3. **back IPAdapterStyleComposition (§3 Test G~H)**: style/composition 비율 결정이 흰 아웃라인 포함 ref 기반
4. **warm ref 3방향 결과 (§3)**: warm ref도 흰 아웃라인 포함 여부 확인 필요
5. **v4 back 배치 (§7.5)**: 6캐릭터 채택/5제외 판정이 흰 아웃라인 영향받았을 가능성
6. **"IP-Adapter가 back 머리길이/악세서리 억제" (Rule #15)**: ref 오염이 원인일 가능성. 깨끗한 ref로 재테스트 필요

## 검증 워크플로우
`c02_pipeline_debug.json` — ComfyUI user/default/workflows/
