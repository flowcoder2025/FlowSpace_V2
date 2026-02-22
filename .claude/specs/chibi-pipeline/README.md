# Epic: 치비 캐릭터 스프라이트 파이프라인

> 상태: 진행중 | 시작: 2026-02-22

## 목표
픽셀아트 → 치비/SD 스타일 캐릭터 스프라이트 생성 파이프라인 구현.
프레임별 개별 생성 + ControlNet 포즈 제어 + 후처리 정규화 + 합성.

## 모델 스택
| 모델 | 용도 |
|------|------|
| Animagine XL 3.1 | 베이스 체크포인트 |
| yuugiri-lyco-nochekaiser (LoRA) | 치비 스타일 |
| OpenPoseXL2 (ControlNet) | 포즈 가이드 |
| IP-Adapter Plus SDXL | 캐릭터 identity 유지 |
| CLIP-ViT-H | IP-Adapter 이미지 인코딩 |

## Phase 목록
| Phase | 설명 | 상태 |
|-------|------|------|
| 1 | 포즈 레퍼런스 시스템 | 완료 |
| 2 | 워크플로우 JSON | 완료 |
| 3 | 상수/타입 업데이트 | 완료 |
| 4 | 후처리 함수 (resize, compose, normalize) | 완료 |
| 5 | 프로세서 리팩토링 (32프레임 루프) | 완료 |
| 6 | API/모듈 연결 | 완료 |
| 7 | 검증 + 폭 정규화 | 완료 (GRADE: PASS) |
| 8 | IP-Adapter 캐릭터 identity 유지 | **완료** (GRADE: PASS) |

## 핵심 결과
- 32프레임 생성 시간: ~19분 (IP-Adapter 포함, Phase A+B)
- 분석기 GRADE: **PASS**
- 높이/폭 stddev: 0px (완벽 통일)
- 방향 내 폭 range: 0px (4방향 모두 완전 통일)
- IP-Adapter로 프레임 간 캐릭터 외형 일관성 확보
- 2-Phase 방식: Phase A(레퍼런스 1장) → Phase B(32프레임 IP-Adapter 주입)
