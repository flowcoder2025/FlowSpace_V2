# Decision: Depth ControlNet > OpenPose

> Date: 2026-02-24
> Epic: chibi-pipeline / Phase 12
> Status: 채택

## 결정
방향 제어를 OpenPose에서 Depth ControlNet (str=0.3, endAt=0.7)으로 교체.

## 근거
1. OpenPose는 정면/후면 구분 불가 (공식 한계, ControlNet issue #406)
2. 치비 비율 스켈레톤이 일반 인체 비율과 충돌
3. Depth ControlNet str=0.3: 얼굴 특징(눈/코) 유무로 정면/후면 구분 가능
4. str=0.3은 방향 힌트만 제공하여 애니메 스타일 보존

## 리스크
- 수작업 깊이 맵 제작 필요 (자동화 어려움)
- str=0.5+ 시 3D 점토 인형화
