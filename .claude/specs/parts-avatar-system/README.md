# Epic: 파츠 조합 캐릭터 시스템

> 상태: ✅ 완료 | 시작: 2026-02-21 | 완료: 2026-02-21

## 목표
24x32 클래식 4색 아바타 → 32x48 ZEP 스타일 파츠 조합 시스템으로 업그레이드.
머리/얼굴/옷 등 6개 카테고리 조합으로 8,640+ 커스터마이징 가능.

## Phase 목록
| Phase | 이름 | 상태 | Task 수 |
|-------|------|------|---------|
| 1 | [Core Engine](./01-core-engine.md) | ✅ 완료 | 4 |
| 2 | [Customization UI](./02-customization-ui.md) | ✅ 완료 | 4 |
| 3 | [In-game Integration](./03-ingame-integration.md) | ✅ 완료 | 3 |

## 핵심 설계 결정
| 결정 | 선택 | 이유 |
|------|------|------|
| 해상도 | 32x48 | ZEP 비율, 32px 타일 정합 |
| 합성 | Canvas 2D 레이어 합성 | GPU 불필요, 기존 패턴 재사용 |
| 드로잉 | 프로시저럴 Canvas | 외부 에셋 없이 즉시 구현 |
| DB | User.avatarConfig (Json?) | 마이그레이션 불필요 |
| 하위호환 | classic/custom/parts 공존 | 기존 유저 아바타 안전 |
| UI | React 독립 프리뷰 | Phaser 의존 없음 |

## 조합 수
3(body) × 6(hair) × 4(eyes) × 6(top) × 4(bottom) × 5(accessory) = **8,640** (색상 무한)
