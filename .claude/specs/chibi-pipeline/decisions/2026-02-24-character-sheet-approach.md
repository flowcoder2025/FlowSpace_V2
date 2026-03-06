# Decision: Character Sheet 접근으로 방향 일관성 확보

> Date: 2026-02-24
> Epic: chibi-pipeline / Phase 12
> Status: 채택

## 컨텍스트
Phase 12에서 3D→2D→치비 파이프라인을 시도했으나:
- Hunyuan3D v2: 부조 형태만 생성 (FAIL)
- SV3D: anime 입력에서 평면 카드 회전 (FAIL), realistic 입력에서만 부분 성공

## 결정
Animagine XL의 "character sheet" 프롬프트로 front+side+back을 한 이미지에 생성하고,
각 방향을 crop하여 img2img + chibi LoRA로 치비화한다.

## 근거
1. `front_character_00001_.png`에서 3방향이 동일 캐릭터로 생성됨 (사용자 확인)
2. 3D 중간단계 불필요 → 파이프라인 복잡도 대폭 감소
3. 치비화는 "스타일 변환"(구도 유지) = img2img 적합 영역 (이전 세션에서 확인)
4. SV3D+반실사가 폴백으로 남아있음

## 리스크
- character sheet가 11캐릭터 전부에서 일관된 멀티뷰를 보장하는지 미검증
- side view에서 팔 사라짐 등 부분 결함 가능
- 프롬프트/시드에 따라 뷰 레이아웃이 달라질 수 있음

## 대안 (폴백)
1. SV3D + 반실사 입력 (부분 성공 확인됨)
2. 픽셀 아트 스타일 전환
3. 수작업/외주
