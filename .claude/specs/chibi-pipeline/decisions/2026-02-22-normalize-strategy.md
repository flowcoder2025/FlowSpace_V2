# Decision: 폭 정규화 전략 (normalizeDirectionFrames)

> 날짜: 2026-02-22
> Epic: 치비 캐릭터 스프라이트 파이프라인

## 배경
프레임별 개별 생성 시 각 프레임의 캐릭터 크기가 다름 (bbox 폭 편차 64~128px).
resizeFrame만으로는 비율이 왜곡되거나 여백이 불균일.

## 결정
normalizeDirectionFrames: 방향별 8프레임을 일괄 정규화
1. 각 프레임의 alpha bbox 추출 (threshold: alpha > 10)
2. 방향 내 median bbox 폭/높이 계산
3. fit:fill로 모든 프레임을 동일 크기 강제 리사이즈
4. 2차 equalization: bbox 재측정 → 수평 스케일 미세 조정
5. 중앙 배치 + 바닥선 앵커

## 근거
- **median 사용**: mean보다 outlier에 강건
- **fit:fill**: 여백 최소화, 프레임 내 캐릭터 점유율 극대화
- **2차 equalization**: fit:fill 후에도 bbox 편차가 남을 수 있으므로 재측정 보정
- **alignCharacterFrames 제거**: normalizeDirectionFrames가 이미 처리, 추가 시프트는 클리핑 유발

## 결과
- 높이 stddev: 0px
- 방향 내 폭 range: 0px
- GRADE: PASS
