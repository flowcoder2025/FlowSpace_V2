# Decision: Warm ref로 3방향 머리색 일관성 확보

> Date: 2026-02-25
> Epic: chibi-pipeline / Phase 12
> Status: 채택

## 결정
`light brown hair` 프롬프트로 생성한 seed front를 IP-Adapter ref로 사용 (ref_front_warm.png).
3방향 모두 이 ref를 거쳐 일관된 웜톤 머리색으로 수렴.

## 근거
1. 기존 `brown hair` ref: 3방향 머리색 편차 23 RGB
2. `light brown hair` warm ref: 3방향 머리색 편차 17 RGB (개선)
3. front도 IP-Adapter 경유 필수 (안 하면 back/left와 색 차이)

## 주의
- `light brown hair` = Animagine XL에서 금발에 가까운 색 (brown hair와 큰 차이)
- hair tag 변경 시 seed 동일해도 캐릭터 디자인이 바뀜
