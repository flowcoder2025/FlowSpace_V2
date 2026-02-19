# Epic: Map Editor (맵 에디터)

> 상태: **완료** | 시작: 2026-02-19 | 완료: 2026-02-19

## 개요
공간 소유자/스태프가 타일을 칠하고 오브젝트를 배치하여 맵을 커스터마이징할 수 있는 에디터 구현.

## 핵심 설계 결정
- **에디터 = MainScene 내 서브시스템** (별도 Scene이 아님)
- **2레벨 편집**: 타일 페인팅 + 오브젝트 배치 (MapObject CRUD)
- **타일 데이터 저장**: Space 모델에 `mapData Json?` 필드
- **React↔Phaser**: EventBridge 패턴 (기존 패턴 유지)
- **권한**: OWNER/STAFF만 에디터 모드 접근

## Phase 목록
| Phase | 이름 | 상태 |
|-------|------|------|
| 8 | 맵 에디터 전체 구현 | 완료 |

## 검증 결과
- `tsc --noEmit` ✅
- `npx next lint` ✅
