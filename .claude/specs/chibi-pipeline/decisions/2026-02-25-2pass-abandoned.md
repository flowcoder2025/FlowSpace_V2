# Decision: 2-pass img2img back 생성 폐기

> Date: 2026-02-25
> Epic: chibi-pipeline / Phase 12
> Status: 폐기

## 시도한 접근
Pass1(IP-Adapter 없이 방향만 확보) → 라인추출(HED/FakeScribble) → Pass2(img2img + IP-Adapter 스타일)

## 실패 원인
1. Pass1에서 IP-Adapter 없이 생성 → front와 완전히 다른 캐릭터 (의상/체형/머리)
2. img2img denoise 0.40~0.55로 복구 불가 (구조 차이가 너무 큼)
3. HED vs FakeScribble 차이 없음 (denoise 0.40에서 무의미)
4. 약한 IP-Adapter(w=0.3, startAt=0.3)를 Pass1에 추가해도 효과 미미

## 복귀
기존 단일 패스 (IPAdapterStyleComposition) 복귀.
