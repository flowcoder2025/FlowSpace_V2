# Decision: 6캐릭터 채택, 5캐릭터 제외

> Date: 2026-02-25
> Epic: chibi-pipeline / Phase 12
> Status: 채택

## 결정
11캐릭터 중 6캐릭터만 채택 (c02/c03/c04/c05/c07/c08).
5캐릭터 제외 (c01/c06/c09/c10/c11).

## 근거 — 제외 사유
| ID | 사유 |
|---|---|
| c01 | IP-Adapter가 back 미디엄 머리 억제 (ref에 없는 요소) |
| c06 | back 배낭 미생성 (IP-Adapter 억제) |
| c09 | 머리길이 불일치 + 셰프모자 미생성 (IP-Adapter 억제) |
| c10 | 망토 커버리지 불충분 (프롬프트/모델 한계) |
| c11 | 롱헤어→핫스위치 변형 (IP-Adapter 억제) |

## 근본 원인
IP-Adapter가 ref(정면)에 보이지 않는 요소(미디엄 뒷머리, 모자, 가방 등)를 억제.
IP-Adapter OFF 테스트(c01/c09)에서 정상 생성 확인 → 모델 한계가 아니라 IP-Adapter 한계.

## 향후
- 제외 캐릭터는 수작업 ref 또는 IP-Adapter 개선 시 재시도 가능
