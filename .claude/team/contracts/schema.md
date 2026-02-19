# Contract Schema Definition

## Overview
모든 도메인 contract는 이 스키마를 따라야 합니다. FlowHR의 contract.yaml 13필드를 Markdown으로 적용합니다.

## Required Sections

### 1. Header
- **Owner**: 담당 도메인 에이전트
- **Version**: SemVer (MAJOR.MINOR.PATCH)
- **Last Updated**: YYYY-MM-DD

### 2. Scope
- **In**: 담당 영역 목록
- **Out**: 비담당 영역 목록

### 3. Entities
- 소유 데이터 엔티티 (DB 테이블/모델)
- 각 엔티티의 CRUD 권한

### 4. API Surface

#### Endpoints (REST)
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| ... | ... | ... | ... |

#### Events Published
| Event | Payload | Channel |
|-------|---------|---------|
| ... | ... | ... |

#### Events Consumed
| Event | Source | Handler |
|-------|--------|---------|
| ... | ... | ... |

### 5. Data Ownership
- 소유 테이블 목록
- 접근 권한 매트릭스 (R/W/RW/None)

### 6. Invariants
- 깨져서는 안 되는 불변 규칙 목록
- 각 규칙의 검증 방법

### 7. Test Plan
- 단위 테스트 범위
- 통합 테스트 시나리오
- 계약 테스트 (contract test)

### 8. Dependencies

#### Upstream (이 도메인이 의존하는)
| Domain | What | How |
|--------|------|-----|
| ... | ... | ... |

#### Downstream (이 도메인에 의존하는)
| Domain | What | How |
|--------|------|-----|
| ... | ... | ... |

### 9. Breaking Changes
- 버전별 breaking change 이력
- 마이그레이션 가이드

### 10. Consumer Impact
- 변경 시 영향받는 도메인 목록
- 영향 범위 및 대응 방법

## Version Rules
- PATCH: 내부 구현 변경 (API 호환)
- MINOR: 새 기능 추가 (하위 호환)
- MAJOR: Breaking change (마이그레이션 필요)
