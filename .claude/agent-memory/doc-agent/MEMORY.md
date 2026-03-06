# DocSpec Agent Memory

## Project: FlowSpace
- Spec root: `.claude/specs/`
- Active epic: `chibi-pipeline` (Phase 12 진행중)
- Phase 12 spec: `.claude/specs/chibi-pipeline/12-3d-to-chibi-pipeline.md`

## Patterns Confirmed

### Spec Update Workflow
- Phase 12 spec의 Task 목록은 `### 게임 적용` 섹션 아래에 순차 추가
- `## 변경된 파일` 테이블은 신규 파일 포함 시 행 추가
- `## 구현 상세` 섹션은 문서 하단, `## 다음 작업` 바로 위에 추가
- header의 `업데이트:` 날짜는 항상 갱신

### _index.md 업데이트 패턴
- Active Epics 테이블의 상태 컬럼: 완료 Task + 다음 작업 1줄 요약
- Drift Tracking의 Last Review Date: 항상 오늘 날짜로 갱신

### Collision System (as of Task 12.31)
- `TileCollisionChecker`: Phaser 의존 없는 순수 클래스
- 충돌 소스: walls + furniture + collision 레이어 (`COLLISION_LAYER_NAMES`)
- 주입 방식: `initTileCollision()` → `localPlayer.setCollisionChecker(checker)`
- 가구 blocked 타일은 아직 미등록 (다음 작업)
