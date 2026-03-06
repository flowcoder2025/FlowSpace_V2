# Epic: 치비 캐릭터 스프라이트 파이프라인

> 상태: **Phase 12 진행중** | 시작: 2026-02-22

## 목표
11개 고정 프리셋 캐릭터의 8방향 걷기 스프라이트시트 생성 + 게임 적용.

## 모델 스택 (Phase 12 현재)
| 모델 | 용도 | 설정 |
|------|------|------|
| Animagine XL 3.1 | 베이스 체크포인트 | - |
| flowspace-chibi-v2 LoRA | 치비 스타일 | str=0.6 |
| Depth ControlNet (controlnet-depth-sdxl-1.0) | 방향 제어 | str=0.3, endAt=0.7 |
| IP-Adapter Plus SDXL | 캐릭터 identity | front/left: style and composition |
| IPAdapterStyleComposition | back 전용 | style=1.0, comp=0.3 |
| Inspyrenet Rembg | AI 배경 제거 | - |

## Phase 목록
| Phase | 설명 | 상태 |
|-------|------|------|
| 1~7 | 초기 파이프라인 (포즈, 워크플로우, 후처리, 검증) | 완료 |
| 8 | IP-Adapter 캐릭터 identity | 완료 |
| 9 | LoRA 학습 (flowspace-chibi) | 완료 |
| 10 | batch 리팩토링 (v2, 77% 속도 향상) | 완료 |
| 11 | IP-Adapter 일관성 최적화 (v3) | 완료 |
| **12** | **멀티뷰 스프라이트시트** | **진행중** |

## Phase 12 현재 진행
- **완료**: Depth ControlNet 방향 제어, back 문제 해결, 코드 기반 걷기, 해상도 업그레이드, 점프 기능, v5 파이프라인 확정, 5캐릭터 걷기 프레임 + 게임 적용 완료, pixelArt OFF + 닉네임 텍스트 개선, 타일맵 ZEP 스타일 색상 교체, 맵 단색 오프화이트 전환, Flux 2 Klein 4B 오브젝트 7종 생성, 정면 시점 재생성, Rembg, AI 타일 3종, 게임 맵 레이아웃+가구배치, **오브젝트 front+back 7종 전부 완료** (s777 매칭 세트), ReferenceLatent 시점 전환 조사 종결, Hunyuan3D 3D→Paint 파이프라인 PoC 동작 확인 (품질 미달로 Klein 유지), **오브젝트 리디자인 완료** (개방형 테이블 s77 + obj4dir 의자, 기존 에셋 유지 + table.png 추가), 테이블+의자 세트 배치 테스트 (s42/s777 구도)
- **다음**: 대각선 점프 도약 통일 → 충돌 영역 정밀화 → Y-sorting

## 핵심 결과
- 5캐릭터 채택 (c02/c03/c04/c05/c07), c08 back 불량으로 후속 제외, 5캐릭터 IP-Adapter 한계로 제외
- 걷기 프레임: 코드 기반 (standing에서 상체/다리 분리 → 프로그래밍 이동)
- 게임 해상도: 96x128 텍스처 + scale 0.35 = 34x45 표시 (ZEP/게더타운 수준)
- 점프: Tween 시각 연출 + squash&stretch + 바닥 그림자
- **흰 테두리 근본 해결**: clean ref(IP-Adapter 없이 생성) + `thick outline` 제거 → 전원 0%
- **v5 파이프라인**: 3개 워크플로우 ComfyUI 저장, 배치 스크립트 v5

## 남은 작업
- ~~**그리드 이동 시스템**~~ → **완료** (Task 12.31, Tween 기반 타일 단위 이동, Shift+방향 전환)
- **충돌 영역 정밀화** — 가구별 blocked 타일 등록 (TileCollisionChecker.addBlocked)
- **Y-sorting 구현** — 순수 Y-sort (`depth = bottom Y`), 리서치 완료
- 대각선 점프 도약 거리 통일

## Flux 2 Klein 오브젝트 워크플로우
- **저장**: `flux2-klein-object-generator.json` (ComfyUI user library)
- **구성**: UNETLoader + CLIPLoader(qwen_3_4b, flux2) + VAELoader(flux2-vae) + FluxGuidance(3.5) + KSampler(steps=4, cfg=1) + Rembg
- **ReferenceLatent**: 네이티브 지원, 스타일 전달 유효, 시점 전환은 추가 조사 필요
