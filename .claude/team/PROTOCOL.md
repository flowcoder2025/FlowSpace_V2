# Orchestrator Dispatch Protocol

## Overview

오케스트레이터는 사용자 요청을 분석하여 적절한 도메인 에이전트에게 작업을 디스패치합니다.

## Dispatch Flow

```
사용자 요청 수신
  → 관련 도메인 분류
  → 의존성 순서 결정
  → 도메인별 순차 spawn
  → Level 1 자동 검증
  → 결과 통합 + 사용자 보고
```

## Domain Priority Order

의존성 기반 실행 순서:
1. **Backend** - 인프라, DB 스키마, API 기반
2. **Asset Pipeline** - 에셋 생성/처리 파이프라인
3. **Communication** - Socket.io, 실시간 동기화
4. **Game Engine** - Phaser 씬, 렌더링
5. **Frontend** - UI 컴포넌트, 페이지

## Spawn Protocol

### Pre-Spawn (준비)
1. 해당 도메인 persona 읽기: `.claude/team/personas/{domain}.md`
2. 해당 도메인 contract 읽기: `.claude/team/contracts/{domain}.md`
3. 관련 shared contract 읽기: `.claude/team/shared/`
4. 도메인 메모리 읽기: `.claude/memory/domains/{domain}/MEMORY.md`
5. 최근 로그 읽기: `.claude/memory/domains/{domain}/logs/`

### Prompt Composition (프롬프트 조합)

토큰 예산: ~12K

```
[페르소나 ~2K]
+ [contract ~2K]
+ [shared 관련부분 ~2K]
+ [도메인 메모리 ~1K]
+ [태스크 지시 ~2K]
+ [완료 프로토콜 ~1K]
```

### Spawn Execution

```
Task(
  subagent_type = "general-purpose",
  prompt = composed_prompt,
  description = "{domain}: {task_summary}"
)
```

### Post-Spawn (후처리)
1. Level 1 자동 검증 실행 (tsc, eslint, build)
2. 실패 시 에러 컨텍스트와 함께 재spawn (최대 2회)
3. 성공 시 도메인 메모리에 작업 결과 기록
4. 다음 도메인으로 진행 또는 결과 통합

## Multi-Domain Task Handling

### 단일 도메인 작업
- 해당 도메인 에이전트 직접 spawn

### 다중 도메인 작업
- 의존성 그래프 분석
- 독립 작업은 병렬 spawn 가능
- 의존 작업은 순차 spawn

### 교차 도메인 변경
- 관련 모든 contract 확인
- 변경 영향 범위 분석
- RACI 매트릭스 참조하여 승인 필요 여부 판단
- 사용자 확인 후 진행

## Error Handling

### Retry Policy
- 최대 재시도: 2회
- 재시도 시 이전 에러 컨텍스트 포함
- 2회 실패 시 사용자에게 에스컬레이션

### Conflict Resolution
- Contract 위반 감지 시 작업 중단
- 도메인 간 충돌 시 오케스트레이터가 중재
- 해결 불가 시 사용자 판단 요청

## Completion Protocol

에이전트 작업 완료 시 반드시:
1. 변경 파일 목록 출력
2. contract 준수 여부 자체 확인
3. 도메인 메모리 업데이트 (MEMORY.md + daily log)
4. 다음 작업 의존성 충족 여부 보고
