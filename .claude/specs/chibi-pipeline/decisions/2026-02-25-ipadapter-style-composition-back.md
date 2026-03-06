# Decision: IPAdapterStyleComposition for back view

> Date: 2026-02-25
> Epic: chibi-pipeline / Phase 12
> Status: 채택

## 결정
back 방향에 IPAdapterStyleComposition (style=1.0, composition=0.3) 사용.
front/left는 기존 IPAdapterAdvanced (style and composition) 유지.

## 근거
1. `style and composition`: ref의 주황 넥타이가 back에 삽입됨 (endAt/weight 조정으로 해결 불가)
2. `style transfer`: 주황 제거되지만 composition 손실 → 사이즈 축소
3. IPAdapterStyleComposition: style/composition 독립 제어 → style=1.0(주황 방지) + comp=0.3(크기 힌트)
4. Test G 결과: 412x892 (front 416x863 근접, 너비 차이 4px)

## 대안 (폐기)
- endAt/weight 감소: 0.3~1.0 범위 전부 테스트, 주황 제거 불가
- front에 style transfer: 팔 사라짐 + 크기 변동 → 사용 금지
