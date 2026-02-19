# Verification Pipeline

## Overview
3단계 검증 파이프라인으로 코드 품질과 contract 정합성을 보장합니다.

## Level 1: Automatic (매 태스크 완료 시)

### Checks
```bash
# TypeScript 타입 체크
npx tsc --noEmit

# ESLint
npx eslint src/ --quiet

# Build (프로젝트 초기화 후)
npm run build

# Tests (테스트 존재 시)
npm test
```

### Policy
- **실패 시**: 에러 컨텍스트와 함께 에이전트 재spawn (최대 2회)
- **2회 실패**: 사용자에게 에스컬레이션
- **통과**: 다음 태스크 진행

## Level 2: Structural (Phase 완료 시)

### Checks

#### 2.1 Contract 정합성
- 도메인 간 이벤트 발행 ↔ 구독 매칭
- API 엔드포인트 ↔ 호출자 매칭
- 데이터 소유권 위반 없음

#### 2.2 Data Ownership 위반 탐지
```bash
# Prisma import가 허용 경로 외에 존재하는지
grep -r "from.*prisma" src/ --include="*.ts" | grep -v "src/app/api/" | grep -v "src/lib/"
```

#### 2.3 메모리 동기화
- 모든 도메인 MEMORY.md 최신 상태 확인
- 오래된 [DRIFT] 태그 확인

#### 2.4 DocOps 드리프트 체크
- 코드 변경 ↔ 스펙 문서 동기화 확인
- `git diff` 기반 변경 파일 추적

#### 2.5 Event Protocol 매칭
- EventBridge: Published events ↔ Consumed events 매칭
- Socket.io: Client events ↔ Server handlers 매칭

### Policy
- **실패 시**: 다음 Phase 진행 차단
- **모든 체크 통과**: Phase 완료 승인

## Level 3: CI (Epic 완료 시)

### GitHub Actions Workflow
```yaml
name: Contract Gate
on: pull_request

jobs:
  contract-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npx eslint src/ --quiet
      - run: npm run build
      - run: npm test
      - name: Contract Schema Validation
        run: node scripts/validate-contracts.js
      - name: SemVer Check
        run: node scripts/check-semver.js
```

### Policy
- **실패 시**: PR 머지 차단
- **통과**: 머지 승인

## Verification Matrix

| Check | Level 1 | Level 2 | Level 3 |
|-------|---------|---------|---------|
| TypeScript | O | O | O |
| ESLint | O | O | O |
| Build | O | O | O |
| Unit Tests | O | O | O |
| Contract 정합성 | | O | O |
| Data Ownership | | O | O |
| Event Matching | | O | O |
| Memory Sync | | O | |
| DocOps Drift | | O | |
| Integration Tests | | | O |
| SemVer | | | O |
