# Decision: 범용 치비 스타일 LoRA 학습

> Date: 2026-02-22
> Epic: chibi-pipeline
> Status: 승인 대기 (플랜 작성 완료)

## 배경
- 치비 파이프라인 Phase 1~8 완료 후 실제 생성 결과 검토
- GRADE: PASS (크기/정렬)이지만 **시각적 일관성 부족**
- 같은 방향 내에서도 갑옷 디테일/체형 달라짐
- 방향 간에는 다른 캐릭터처럼 보임
- IP-Adapter + ControlNet으로도 diffusion 모델 독립 샘플링 한계 극복 불가

## 결정
- **kohya_ss**로 범용 치비 스타일 LoRA 학습
- 특정 캐릭터가 아닌 **게임 스프라이트 치비 스타일 자체**를 학습
- 기존 yuugiri LoRA를 **대체** (fallback으로 유지)
- 트리거 워드: `flowspace_chibi`

## 학습 스펙
- 기반 모델: Animagine XL 3.1
- 도구: kohya_ss (sd-scripts)
- 데이터: 35~50장 (AI 생성 선별 + 오픈소스)
- network_dim: 32, alpha: 16
- optimizer: AdamW8bit, LR: 5e-5
- 12 epochs, 정규화 이미지 100~200장
- RTX 4070 12GB, 예상 3~4시간

## 대안 검토
| 방안 | 기각 사유 |
|------|-----------|
| 파츠 조합만 사용 | AI 생성 캐릭터 활용 불가 |
| 캐릭터별 LoRA | 매번 학습 필요, 비효율 |
| img2img 체인 | 포즈 자유도 낮음 |
| 프롬프트/IP-Adapter 튜닝 | 이미 한계 확인 (현재 상태) |

## 코드 영향
- `capability-checker.ts`: LoRA 감지 로직 확장
- `constants.ts`: LORA_PRIORITY + 트리거 워드
- `processor.ts`: LoRA 선택 헬퍼
- 워크플로우 JSON 3개: lora_name 파라미터 추가

## 플랜 파일
`~/.claude/plans/fluffy-meandering-hollerith.md`
